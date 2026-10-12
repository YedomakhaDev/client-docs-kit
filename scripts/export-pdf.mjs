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
 */
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const rawArgs = process.argv.slice(2);
const positional = rawArgs.filter((a) => !a.startsWith("--"));
const flags = rawArgs.filter((a) => a.startsWith("--"));

const [docDirArg, outputArg] = positional;

if (!docDirArg) {
  console.error("Usage: node scripts/export-pdf.mjs <doc-dir> [output.pdf] [--theme=dark|light|graphite] [--no-date] [--no-version] [--no-author]");
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

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function mergeConfig(base, override = {}) {
  return {
    theme: override.theme ?? base.theme,
    title: { ...base.title, ...override.title },
  };
}

let config = readJson(path.join(ROOT_DIR, "config.default.json"));

const docConfigPath = path.join(docDir, "doc.config.json");
if (existsSync(docConfigPath)) {
  config = mergeConfig(config, readJson(docConfigPath));
}

const flagOverride = { title: {} };
for (const flag of flags) {
  if (flag.startsWith("--theme=")) flagOverride.theme = flag.slice("--theme=".length);
  else if (flag === "--no-date") flagOverride.title.showDate = false;
  else if (flag === "--no-version") flagOverride.title.showVersion = false;
  else if (flag === "--no-author") flagOverride.title.showAuthor = false;
  else {
    console.error(`Unknown flag: ${flag}`);
    process.exit(1);
  }
}
config = mergeConfig(config, flagOverride);

const VALID_THEMES = ["dark", "light", "graphite"];
if (!VALID_THEMES.includes(config.theme)) {
  console.error(`Unknown theme "${config.theme}". Valid themes: ${VALID_THEMES.join(", ")}`);
  process.exit(1);
}

// Chromium anchors the header template to the bottom of the top margin box
// (i.e. right next to the content) and the footer template to the top of the
// bottom margin box — both closest to the content by default. height:100%
// plus flex alignment pushes them toward the outer page edge instead, so
// they don't collide with content that runs close to the margin boundary.
const HEADER_TEMPLATE = `
  <div style="width:100%; height:100%; font-family:-apple-system,'Segoe UI',Arial,sans-serif; font-size:8px; color:#8a8a8a; padding:0 22mm; box-sizing:border-box; display:flex; align-items:flex-start; justify-content:space-between;">
    <span class="title"></span>
    <span>Client instructions</span>
  </div>`;

const FOOTER_TEMPLATE = `
  <div style="width:100%; height:100%; font-family:-apple-system,'Segoe UI',Arial,sans-serif; font-size:8px; color:#8a8a8a; padding:0 22mm; box-sizing:border-box; display:flex; align-items:flex-end; justify-content:flex-end;">
    <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`;

const browser = await chromium.launch();

try {
  const page = await browser.newPage();

  await page.goto(pathToFileURL(titlePath).href, { waitUntil: "networkidle" });
  await page.evaluate(({ theme, fields }) => {
    document.documentElement.setAttribute("data-theme", theme);
    for (const [field, show] of Object.entries(fields)) {
      if (show) continue;
      document.querySelector(`[data-field="${field}"]`)?.remove();
    }
  }, {
    theme: config.theme,
    fields: {
      date: config.title.showDate,
      version: config.title.showVersion,
      author: config.title.showAuthor,
    },
  });
  const titlePdf = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
  });

  await page.goto(pathToFileURL(contentPath).href, { waitUntil: "networkidle" });
  const contentPdf = await page.pdf({
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: HEADER_TEMPLATE,
    footerTemplate: FOOTER_TEMPLATE,
    margin: { top: "20mm", bottom: "18mm", left: "0mm", right: "0mm" },
  });

  await browser.close();

  const merged = await PDFDocument.create();
  for (const buf of [titlePdf, contentPdf]) {
    const src = await PDFDocument.load(buf);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }

  await writeFile(outputPath, await merged.save());
  console.log(`PDF ready: ${outputPath} (theme: ${config.theme})`);
} catch (err) {
  await browser.close();
  throw err;
}
