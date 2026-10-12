/**
 * Shared Playwright render helpers for a doc's title and content pages.
 * Used by both export-pdf.mjs (single document) and build-manual.mjs
 * (multi-chapter book) so the two don't maintain separate copies of the
 * same Chromium print logic.
 */
import { pathToFileURL } from "node:url";

// Chromium anchors the header template to the bottom of the top margin box
// (i.e. right next to the content) and the footer template to the top of the
// bottom margin box — both closest to the content by default. height:100%
// plus flex alignment pushes them toward the outer page edge instead, so
// they don't collide with content that runs close to the margin boundary.
export const HEADER_TEMPLATE = `
  <div style="width:100%; height:100%; font-family:-apple-system,'Segoe UI',Arial,sans-serif; font-size:8px; color:#8a8a8a; padding:0 22mm; box-sizing:border-box; display:flex; align-items:flex-start; justify-content:space-between;">
    <span class="title"></span>
    <span>Client instructions</span>
  </div>`;

export const FOOTER_TEMPLATE = `
  <div style="width:100%; height:100%; font-family:-apple-system,'Segoe UI',Arial,sans-serif; font-size:8px; color:#8a8a8a; padding:0 22mm; box-sizing:border-box; display:flex; align-items:flex-end; justify-content:flex-end;">
    <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`;

/**
 * Renders a title.html file to a single full-bleed PDF page (no
 * header/footer), applying theme + which meta fields to show.
 */
export async function renderTitlePage(page, titlePath, config) {
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
  return page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
  });
}

/**
 * Renders a content.html file to its PDF pages, with a running header
 * (document title) always on. `footer: true` (the default, used by
 * export-pdf.mjs for standalone documents) bakes Chromium's own
 * pageNumber/totalPages into the footer. `footer: false` (used by
 * build-manual.mjs chapters) omits the footer entirely, since the manual
 * stamps its own continuous page numbers after merging every chapter.
 */
export async function renderContentPages(page, contentPath, { footer = true } = {}) {
  await page.goto(pathToFileURL(contentPath).href, { waitUntil: "networkidle" });
  return page.pdf({
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: HEADER_TEMPLATE,
    footerTemplate: footer ? FOOTER_TEMPLATE : `<div></div>`,
    margin: { top: "20mm", bottom: "18mm", left: "0mm", right: "0mm" },
  });
}
