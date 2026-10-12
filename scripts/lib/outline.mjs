/**
 * Builds a flat PDF outline (bookmarks sidebar) for build-manual.mjs.
 *
 * pdf-lib has no high-level bookmark API, so this hand-builds the /Outlines
 * dictionary tree with its low-level PDFContext primitives: a root dict
 * (Type /Outlines, First/Last/Count) and one sibling dict per item, linked
 * via Parent/Next/Prev and pointing at a page with /Dest [pageRef /XYZ ...].
 * Flat only (no nested sections) — the 80% case for a chapter list, and
 * nesting would mean tracking per-parent counts through a real tree.
 *
 * If this ever needs to be ripped out (e.g. a pdf-lib upgrade breaks the
 * low-level shape this relies on), the book still works without it — the
 * printed table of contents has the same titles and page numbers, just
 * without sidebar jump links.
 */
import { PDFName, PDFNumber, PDFString } from "pdf-lib";

/**
 * @param {import("pdf-lib").PDFDocument} pdfDoc
 * @param {Array<{ title: string, pageIndex: number }>} items in display order
 */
export function addOutline(pdfDoc, items) {
  if (!items.length) return;

  const context = pdfDoc.context;

  const itemDicts = items.map(() => context.obj({}));
  const itemRefs = itemDicts.map((dict) => context.register(dict));

  const outlineDict = context.obj({});
  const outlineRef = context.register(outlineDict);

  items.forEach((item, i) => {
    const dict = itemDicts[i];
    const pageRef = pdfDoc.getPage(item.pageIndex).ref;

    dict.set(PDFName.of("Title"), PDFString.of(item.title));
    dict.set(PDFName.of("Parent"), outlineRef);
    if (i > 0) dict.set(PDFName.of("Prev"), itemRefs[i - 1]);
    if (i < items.length - 1) dict.set(PDFName.of("Next"), itemRefs[i + 1]);
    dict.set(PDFName.of("Dest"), context.obj([pageRef, "XYZ", null, null, null]));
  });

  outlineDict.set(PDFName.of("Type"), PDFName.of("Outlines"));
  outlineDict.set(PDFName.of("First"), itemRefs[0]);
  outlineDict.set(PDFName.of("Last"), itemRefs[itemRefs.length - 1]);
  outlineDict.set(PDFName.of("Count"), PDFNumber.of(items.length));

  pdfDoc.catalog.set(PDFName.of("Outlines"), outlineRef);
}
