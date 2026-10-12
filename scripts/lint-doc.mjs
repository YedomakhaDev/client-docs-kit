#!/usr/bin/env node
/**
 * Standalone structural check for a doc folder. No browser, no PDF, no
 * image tokens — just fast text validation. Run this while drafting
 * content.html, before paying for a full `export-pdf.mjs` render.
 *
 * Usage:
 *   node scripts/lint-doc.mjs <doc-dir>
 */
import path from "node:path";
import { validateDoc } from "./lib/validate.mjs";

const [, , docDirArg] = process.argv;

if (!docDirArg) {
  console.error("Usage: node scripts/lint-doc.mjs <doc-dir>");
  process.exit(1);
}

const docDir = path.resolve(docDirArg);
const { problems, warnings } = validateDoc(docDir);

for (const w of warnings) console.warn(`⚠ ${w}`);
for (const p of problems) console.error(`✗ ${p}`);

if (problems.length) {
  console.error(`\n${problems.length} problem(s) found.`);
  process.exit(1);
}

console.log(`✓ ${path.relative(process.cwd(), docDir) || "."} looks structurally OK${warnings.length ? ` (${warnings.length} warning(s))` : ""}.`);
