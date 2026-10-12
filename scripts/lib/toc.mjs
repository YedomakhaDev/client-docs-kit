/**
 * Renders the table-of-contents page for build-manual.mjs. Generated
 * in-memory via page.setContent(), same approach as divider.mjs — it isn't
 * part of any single docs/<name>/ folder, so there's no on-disk template.
 *
 * Vertical clearance comes from the Playwright page margin passed to
 * page.pdf() below (not CSS padding), so a long chapter list that spills
 * onto a second page still gets correct top/bottom clearance there too.
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { escapeHtml } from "./html.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CSS_HREF = pathToFileURL(path.join(ROOT_DIR, "styles", "doc.css")).href;

function tocHtml({ bookTitle, entries }) {
  const items = entries
    .map(
      (e) => `      <li class="toc__item">
        <span class="toc__item-title">${escapeHtml(e.title)}</span>
        <span class="toc__item-leader"></span>
        <span class="toc__item-page">${e.pageNumber}</span>
      </li>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Table of Contents</title>
  <link rel="stylesheet" href="${CSS_HREF}" />
</head>
<body>
  <section class="toc-page">
    <p class="toc-page__kicker">${escapeHtml(bookTitle)}</p>
    <h1 class="toc-page__title">Table of Contents</h1>
    <ul class="toc__list">
${items}
    </ul>
  </section>
</body>
</html>`;
}

/**
 * @param {import("playwright").Page} page
 * @param {{ bookTitle: string, entries: Array<{ title: string, pageNumber: number }> }} data
 * @returns {Promise<Buffer>}
 */
export async function renderToc(page, data) {
  await page.setContent(tocHtml(data), { waitUntil: "networkidle" });
  return page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "25mm", bottom: "18mm", left: "0mm", right: "0mm" },
  });
}
