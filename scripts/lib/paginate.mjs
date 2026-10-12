/**
 * Stamps continuous "N / total" page numbers across an already-merged
 * PDFDocument. Used by build-manual.mjs: each chapter is rendered with its
 * own Chromium footer turned off (renderContentPages(..., { footer: false })),
 * since Chromium's own pageNumber/totalPages counter resets per render —
 * fine for a standalone document, wrong for a book made of several merged
 * chapters. This draws one continuous counter after everything is merged,
 * in roughly the same bottom-right spot the built-in footer template uses.
 */
import { StandardFonts, rgb } from "pdf-lib";

const FONT_SIZE = 8;
const RIGHT_MARGIN_MM = 22;
const BOTTOM_MM = 10;
const MM_TO_PT = 2.83464567;
const GRAY = rgb(0x8a / 255, 0x8a / 255, 0x8a / 255);

/**
 * @param {import("pdf-lib").PDFDocument} pdfDoc
 * @param {{ skipPages?: Set<number> }} [options] page indices (0-based) to leave unnumbered — typically just the cover.
 */
export async function stampPageNumbers(pdfDoc, { skipPages = new Set() } = {}) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const total = pages.length;

  pages.forEach((page, index) => {
    if (skipPages.has(index)) return;

    const label = `${index + 1} / ${total}`;
    const textWidth = font.widthOfTextAtSize(label, FONT_SIZE);
    const { width: pageWidth } = page.getSize();

    page.drawText(label, {
      x: pageWidth - RIGHT_MARGIN_MM * MM_TO_PT - textWidth,
      y: BOTTOM_MM * MM_TO_PT,
      size: FONT_SIZE,
      font,
      color: GRAY,
    });
  });
}
