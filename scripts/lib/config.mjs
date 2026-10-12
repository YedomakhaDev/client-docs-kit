/**
 * Shared config helpers: theme + which title-page fields to show, layered as
 * config.default.json -> optional per-doc override -> CLI flag override.
 * Used by export-pdf.mjs (per-document override) and build-manual.mjs
 * (book-level override, no per-doc file since the cover isn't a doc folder).
 */
import { readFileSync } from "node:fs";

export const VALID_THEMES = ["dark", "light", "graphite"];

export function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

export function mergeConfig(base, override = {}) {
  return {
    theme: override.theme ?? base.theme,
    title: { ...base.title, ...override.title },
  };
}
