#!/usr/bin/env node
/**
 * Renders every page of an existing PDF to a single contact-sheet PNG.
 * Useful for re-reviewing a PDF you already built without re-exporting.
 *
 * Usage:
 *   node scripts/preview-pdf.mjs <pdf-path> [output.png]
 */
import path from "node:path";
import { buildContactSheet } from "./lib/preview.mjs";

const [, , pdfArg, outArg] = process.argv;

if (!pdfArg) {
  console.error("Usage: node scripts/preview-pdf.mjs <pdf-path> [output.png]");
  process.exit(1);
}

const pdfPath = path.resolve(pdfArg);
const outPath = path.resolve(outArg || pdfPath.replace(/\.pdf$/i, "-preview.png"));

try {
  const { pageCount } = await buildContactSheet(pdfPath, outPath);
  console.log(`Preview ready: ${outPath} (${pageCount} page(s))`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
