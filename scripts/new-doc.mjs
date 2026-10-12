#!/usr/bin/env node
/**
 * Scaffolds a new document folder from template/, with the fiddly part
 * already handled: template/ is one directory shallower than docs/<name>/,
 * so the stylesheet link needs an extra "../" — this script fixes that and
 * fills in the title/project placeholders, instead of that being redone by
 * hand (and occasionally gotten wrong) every time.
 *
 * Usage:
 *   node scripts/new-doc.mjs <doc-name> "<Document Title>" "<Project Name>"
 *   node scripts/new-doc.mjs onboarding-guide "Onboarding Guide" "Acme Inc."
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const [, , docName, docTitle, projectName] = process.argv;

if (!docName || !docTitle || !projectName) {
  console.error('Usage: node scripts/new-doc.mjs <doc-name> "<Document Title>" "<Project Name>"');
  process.exit(1);
}

if (!/^[a-z0-9][a-z0-9-]*$/.test(docName)) {
  console.error(`<doc-name> should be lowercase-with-dashes (got "${docName}") — it becomes a folder name and PDF filename.`);
  process.exit(1);
}

const docDir = path.join(ROOT_DIR, "docs", docName);
if (existsSync(docDir)) {
  console.error(`${path.relative(ROOT_DIR, docDir)} already exists.`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);

function render(templateFile) {
  let html = readFileSync(path.join(ROOT_DIR, "template", templateFile), "utf8");
  html = html.replace('href="../styles/doc.css"', 'href="../../styles/doc.css"');
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${docTitle}</title>`);
  html = html.replaceAll("Document title", docTitle);
  html = html.replaceAll("Project name", projectName);
  html = html.replace(/(<dt>Date<\/dt>\s*<dd>)[^<]*(<\/dd>)/, `$1${today}$2`);
  return html;
}

mkdirSync(path.join(docDir, "screenshots"), { recursive: true });
writeFileSync(path.join(docDir, "title.html"), render("title.html"));
writeFileSync(path.join(docDir, "content.html"), render("content.html"));

console.log(`Created docs/${docName}/`);
console.log(`  title.html, content.html — title: "${docTitle}", project: "${projectName}"`);
console.log(`  screenshots/ (empty)`);
console.log(`\nNext steps:`);
console.log(`  1. Fill in content.html — block reference is in AGENTS.md`);
console.log(`  2. Add screenshots to docs/${docName}/screenshots/`);
console.log(`  3. node scripts/lint-doc.mjs docs/${docName}      (fast structural check)`);
console.log(`  4. node scripts/export-pdf.mjs docs/${docName}    (build the PDF)`);
