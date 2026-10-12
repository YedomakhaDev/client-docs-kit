/**
 * Renders every page of a PDF to a single contact-sheet PNG, so reviewing a
 * multi-page document costs one image read instead of one per page.
 *
 * Requires `pdftoppm` (poppler-utils) on PATH — it's the one piece of this
 * kit that isn't npm-managed. macOS: `brew install poppler`. Debian/Ubuntu:
 * `apt install poppler-utils`. The core export pipeline (export-pdf.mjs
 * without --preview) does not need it.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

const THUMB_WIDTH = 360;
const GAP = 14;
const COLUMNS = 4;
const SHEET_BG = { r: 230, g: 230, b: 230 };

export async function buildContactSheet(pdfPath, outPath) {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "docs-kit-preview-"));
  const prefix = path.join(tmpDir, "page");

  try {
    try {
      await execFileAsync("pdftoppm", ["-png", "-r", "90", pdfPath, prefix]);
    } catch (err) {
      if (err.code === "ENOENT") {
        throw new Error(
          "pdftoppm not found. Install poppler (macOS: `brew install poppler`, " +
          "Debian/Ubuntu: `apt install poppler-utils`) to use --preview."
        );
      }
      throw err;
    }

    const files = (await readdir(tmpDir)).filter((f) => f.endsWith(".png")).sort();
    if (!files.length) {
      throw new Error("pdftoppm produced no pages.");
    }

    const thumbs = [];
    for (const file of files) {
      const buf = await sharp(path.join(tmpDir, file)).resize({ width: THUMB_WIDTH }).toBuffer();
      const { height } = await sharp(buf).metadata();
      thumbs.push({ buf, height });
    }

    const columns = Math.min(COLUMNS, thumbs.length);
    const rows = Math.ceil(thumbs.length / columns);
    const rowHeight = Math.max(...thumbs.map((t) => t.height)) + GAP;
    const sheetWidth = columns * THUMB_WIDTH + (columns + 1) * GAP;
    const sheetHeight = rows * rowHeight + GAP;

    const composites = thumbs.map((t, i) => ({
      input: t.buf,
      left: GAP + (i % columns) * (THUMB_WIDTH + GAP),
      top: GAP + Math.floor(i / columns) * rowHeight,
    }));

    await sharp({
      create: { width: sheetWidth, height: sheetHeight, channels: 3, background: SHEET_BG },
    })
      .composite(composites)
      .png()
      .toFile(outPath);

    return { pageCount: files.length, outPath };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
