/**
 * Renders a chapter-divider page for build-manual.mjs — a full-bleed, light
 * page marking the start of a chapter (no header/footer, same treatment as
 * the title page). Generated in-memory via page.setContent() rather than a
 * scaffolded template file, since it doesn't belong to any single doc folder.
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { escapeHtml } from "./html.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CSS_HREF = pathToFileURL(path.join(ROOT_DIR, "styles", "doc.css")).href;

function dividerHtml({ number, title }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${CSS_HREF}" />
</head>
<body>
  <section class="chapter-divider">
    <p class="chapter-divider__number">Chapter ${number}</p>
    <h1 class="chapter-divider__title">${escapeHtml(title)}</h1>
  </section>
</body>
</html>`;
}

/**
 * @param {import("playwright").Page} page
 * @param {{ number: number, title: string }} chapter
 * @returns {Promise<Buffer>}
 */
export async function renderChapterDivider(page, chapter) {
  await page.setContent(dividerHtml(chapter), { waitUntil: "networkidle" });
  return page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
  });
}
