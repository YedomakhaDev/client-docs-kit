#!/usr/bin/env node
/**
 * Assembles several existing docs/<name>/ chapters into one continuously-
 * paginated book: cover -> table of contents -> per-chapter divider +
 * content, with a sidebar PDF outline (one bookmark per chapter).
 *
 * Each chapter is still a normal doc folder, authored and lint-checked the
 * usual way (see AGENTS.md) — this script only consumes already-written
 * title.html/content.html, it doesn't change how a single chapter is built.
 * Reach for export-pdf.mjs instead when the deliverable is one standalone
 * document; reach for this when it's a multi-chapter manual.
 *
 * Usage:
 *   node scripts/build-manual.mjs <manifest.json> [output.pdf] [--preview] [--theme=dark|light|graphite]
 *
 * Manifest shape (lives next to the chapters it references, and next to its
 * own title.html for the cover — same title-page template as any doc, hand
 * authored the same way: copy template/title.html and fill it in):
 *   {
 *     "title": "Book title",
 *     "chapters": [
 *       { "doc": "chapter-folder-name", "title": "Optional override" }
 *     ]
 *   }
 *
 * "title" is the book's title, used on the table-of-contents page (the
 * cover's own visible title/project/date/version/author text lives in the
 * manifest-adjacent title.html, not here — one source of truth for what the
 * cover actually displays, same as any chapter). "doc" resolves relative to
 * the manifest's own directory. Per-chapter "title" is optional — falls back
 * to that chapter's own content.html <title> if omitted.
 */
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDoc } from "./lib/validate.mjs";
import { buildContactSheet } from "./lib/preview.mjs";
import { renderTitlePage, renderContentPages } from "./lib/render.mjs";
import { renderChapterDivider } from "./lib/divider.mjs";
import { renderToc } from "./lib/toc.mjs";
import { stampPageNumbers } from "./lib/paginate.mjs";
import { addOutline } from "./lib/outline.mjs";
import { VALID_THEMES, readJson, mergeConfig } from "./lib/config.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const rawArgs = process.argv.slice(2);
const positional = rawArgs.filter((a) => !a.startsWith("--"));
const flags = rawArgs.filter((a) => a.startsWith("--"));

const [manifestArg, outputArg] = positional;

if (!manifestArg) {
  console.error("Usage: node scripts/build-manual.mjs <manifest.json> [output.pdf] [--preview] [--theme=dark|light|graphite]");
  process.exit(1);
}

const manifestPath = path.resolve(manifestArg);
if (!existsSync(manifestPath)) {
  console.error(`File not found: ${manifestPath}`);
  process.exit(1);
}

const manifestDir = path.dirname(manifestPath);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (!Array.isArray(manifest.chapters) || manifest.chapters.length === 0) {
  console.error(`${manifestPath}: "chapters" must be a non-empty array.`);
  process.exit(1);
}

const outputPath = path.resolve(outputArg || path.join(manifestDir, `${path.basename(manifestPath, ".json")}.pdf`));

let config = readJson(path.join(ROOT_DIR, "config.default.json"));

let preview = false;
const flagOverride = { title: {} };
for (const flag of flags) {
  if (flag.startsWith("--theme=")) flagOverride.theme = flag.slice("--theme=".length);
  else if (flag === "--preview") preview = true;
  else {
    console.error(`Unknown flag: ${flag}`);
    process.exit(1);
  }
}
config = mergeConfig(config, flagOverride);

if (!VALID_THEMES.includes(config.theme)) {
  console.error(`Unknown theme "${config.theme}". Valid themes: ${VALID_THEMES.join(", ")}`);
  process.exit(1);
}

// Resolve every chapter dir up front and validate all of them before
// touching a browser — same fail-fast principle as export-pdf.mjs --check,
// just aggregated across the whole book instead of one doc.
const chapters = manifest.chapters.map((entry) => ({
  ...entry,
  dir: path.resolve(manifestDir, entry.doc),
}));

let hadProblems = false;
for (const chapter of chapters) {
  if (!existsSync(chapter.dir)) {
    console.error(`✗ ${chapter.doc}: directory not found (${chapter.dir})`);
    hadProblems = true;
    continue;
  }
  const { problems, warnings } = validateDoc(chapter.dir);
  for (const w of warnings) console.warn(`⚠ ${chapter.doc}: ${w}`);
  for (const p of problems) {
    console.error(`✗ ${chapter.doc}: ${p}`);
    hadProblems = true;
  }
}
if (hadProblems) {
  console.error("\nFix the problem(s) above before building the manual.");
  process.exit(1);
}

const coverTitlePath = path.join(manifestDir, "title.html");
if (!existsSync(coverTitlePath)) {
  console.error(
    `${coverTitlePath} not found. A manual's cover reuses the normal title-page ` +
    `template — copy template/title.html next to the manifest and fill in the ` +
    `book's title/project/date/version/author.`
  );
  process.exit(1);
}

function titleFromContentHtml(contentPath) {
  const html = readFileSync(contentPath, "utf8");
  const match = html.match(/<title>([^<]+)<\/title>/);
  return match ? match[1] : path.basename(path.dirname(contentPath));
}

const browser = await chromium.launch();

try {
  const page = await browser.newPage();

  const coverPdf = await renderTitlePage(page, coverTitlePath, config);

  const renderedChapters = [];
  for (const [i, chapter] of chapters.entries()) {
    const contentPath = path.join(chapter.dir, "content.html");
    const title = chapter.title || titleFromContentHtml(contentPath);

    const dividerPdf = await renderChapterDivider(page, { number: i + 1, title });
    const contentPdf = await renderContentPages(page, contentPath, { footer: false });

    const dividerDoc = await PDFDocument.load(dividerPdf);
    const contentDoc = await PDFDocument.load(contentPdf);
    const pageCount = dividerDoc.getPageCount() + contentDoc.getPageCount();

    renderedChapters.push({ title, dividerPdf, contentPdf, pageCount });
  }

  // Cover is page 1. TOC page count depends on how many chapters there are;
  // render once to measure it, then re-render with correct offsets if it
  // spilled past the guessed page count (cheap either way, it's just text).
  const coverPages = (await PDFDocument.load(coverPdf)).getPageCount();

  function buildTocEntries(tocPageCount) {
    let cursor = coverPages + tocPageCount + 1; // 1-based page number of chapter 1's divider
    const entries = [];
    for (const chapter of renderedChapters) {
      entries.push({ title: chapter.title, pageNumber: cursor });
      cursor += chapter.pageCount;
    }
    return entries;
  }

  let tocPdf = await renderToc(page, { bookTitle: manifest.title, entries: buildTocEntries(1) });
  let tocPages = (await PDFDocument.load(tocPdf)).getPageCount();
  if (tocPages !== 1) {
    tocPdf = await renderToc(page, { bookTitle: manifest.title, entries: buildTocEntries(tocPages) });
    tocPages = (await PDFDocument.load(tocPdf)).getPageCount();
  }

  await browser.close();

  const merged = await PDFDocument.create();
  async function appendPdf(buf) {
    const src = await PDFDocument.load(buf);
    const copied = await merged.copyPages(src, src.getPageIndices());
    copied.forEach((p) => merged.addPage(p));
  }

  await appendPdf(coverPdf);
  const tocPageIndex = merged.getPageCount();
  await appendPdf(tocPdf);

  const outlineItems = [{ title: "Table of Contents", pageIndex: tocPageIndex }];
  for (const chapter of renderedChapters) {
    const dividerPageIndex = merged.getPageCount();
    await appendPdf(chapter.dividerPdf);
    await appendPdf(chapter.contentPdf);
    outlineItems.push({ title: chapter.title, pageIndex: dividerPageIndex });
  }

  await stampPageNumbers(merged, { skipPages: new Set([0]) });
  addOutline(merged, outlineItems);

  await writeFile(outputPath, await merged.save());
  console.log(`Manual ready: ${outputPath} (${merged.getPageCount()} page(s), ${renderedChapters.length} chapter(s))`);

  if (preview) {
    const previewPath = outputPath.replace(/\.pdf$/i, "-preview.png");
    try {
      const { pageCount } = await buildContactSheet(outputPath, previewPath);
      console.log(`Preview ready: ${previewPath} (${pageCount} page(s))`);
    } catch (err) {
      console.error(`Preview skipped: ${err.message}`);
    }
  }
} catch (err) {
  await browser.close();
  throw err;
}
