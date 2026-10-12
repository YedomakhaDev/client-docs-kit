#!/usr/bin/env node
/**
 * Renders a doc folder (title.html + content.html) to a single PDF.
 *
 * Title page is rendered without header/footer so the dark background
 * stays full-bleed and clean. Content pages are rendered separately with
 * a running header (document title) and footer (page number), then the
 * two PDFs are merged — Chromium's print header/footer applies to every
 * page uniformly, so this is the only reliable way to keep the title
 * page free of a page number.
 *
 * Settings (theme, which title-page fields to show) come from three
 * layers, each overriding the previous one:
 *   1. config.default.json         (project-wide defaults)
 *   2. docs/<doc>/doc.config.json  (per-document override, optional)
 *   3. CLI flags                   (one-off override for this run)
 *
 * Usage:
 *   node scripts/export-pdf.mjs <doc-dir> [output.pdf] [flags]
 *   node scripts/export-pdf.mjs docs/example-instruction
 *   node scripts/export-pdf.mjs docs/example-instruction --theme=light --no-author
 *
 * Flags:
 *   --theme=dark|light|graphite
 *   --no-date      hide the Date field on the title page
 *   --no-version   hide the Version field on the title page
 *   --no-author    hide the Author field on the title page
 *   --check        run the fast structural checks (see lint-doc.mjs) and
 *                  exit — no browser, no PDF. Use this while drafting.
 *   --preview      after building the PDF, also render a single contact-sheet
 *                  PNG (<output>-preview.png) with every page as a thumbnail —
 *                  one image to review instead of one per page. Requires
 *                  poppler's pdftoppm on PATH (see scripts/lib/preview.mjs).
 */
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDoc } from "./lib/validate.mjs";
import { buildContactSheet } from "./lib/preview.mjs";
import { renderTitlePage, renderContentPages } from "./lib/render.mjs";
import { VALID_THEMES, readJson, mergeConfig } from "./lib/config.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const rawArgs = process.argv.slice(2);
const positional = rawArgs.filter((a) => !a.startsWith("--"));
const flags = rawArgs.filter((a) => a.startsWith("--"));

const [docDirArg, outputArg] = positional;

if (!docDirArg) {
  console.error("Usage: node scripts/export-pdf.mjs <doc-dir> [output.pdf] [--theme=dark|light|graphite] [--no-date] [--no-version] [--no-author] [--check] [--preview]");
  process.exit(1);
}

const docDir = path.resolve(docDirArg);
const titlePath = path.join(docDir, "title.html");
const contentPath = path.join(docDir, "content.html");
const outputPath = path.resolve(outputArg || path.join(docDir, `${path.basename(docDir)}.pdf`));

for (const p of [titlePath, contentPath]) {
  if (!existsSync(p)) {
    console.error(`File not found: ${p}`);
    process.exit(1);
  }
}

let config = readJson(path.join(ROOT_DIR, "config.default.json"));

const docConfigPath = path.join(docDir, "doc.config.json");
if (existsSync(docConfigPath)) {
  config = mergeConfig(config, readJson(docConfigPath));
}

let checkOnly = false;
let preview = false;
const flagOverride = { title: {} };
for (const flag of flags) {
  if (flag.startsWith("--theme=")) flagOverride.theme = flag.slice("--theme=".length);
  else if (flag === "--no-date") flagOverride.title.showDate = false;
  else if (flag === "--no-version") flagOverride.title.showVersion = false;
  else if (flag === "--no-author") flagOverride.title.showAuthor = false;
  else if (flag === "--check") checkOnly = true;
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

if (checkOnly) {
  const { problems, warnings } = validateDoc(docDir);
  for (const w of warnings) console.warn(`⚠ ${w}`);
  for (const p of problems) console.error(`✗ ${p}`);
  if (problems.length) {
    console.error(`\n${problems.length} problem(s) found.`);
    process.exit(1);
  }
  console.log(`✓ ${path.relative(process.cwd(), docDir) || "."} looks structurally OK${warnings.length ? ` (${warnings.length} warning(s))` : ""}. (theme: ${config.theme})`);
  process.exit(0);
}

const browser = await chromium.launch();

try {
  const page = await browser.newPage();

  const titlePdf = await renderTitlePage(page, titlePath, config);
  const contentPdf = await renderContentPages(page, contentPath, { footer: true });

  await browser.close();

  const merged = await PDFDocument.create();
  for (const buf of [titlePdf, contentPdf]) {
    const src = await PDFDocument.load(buf);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }

  await writeFile(outputPath, await merged.save());
  console.log(`PDF ready: ${outputPath} (theme: ${config.theme})`);

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
