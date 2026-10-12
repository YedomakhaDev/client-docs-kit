/**
 * Cheap, text-only structural checks for a doc folder — no browser launch,
 * no image tokens. Meant to catch the most common real mistakes (broken
 * screenshot path, bad config) before paying for a full Playwright render.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const VALID_THEMES = ["dark", "light", "graphite"];

function checkHtmlFile(docDir, fileName, problems, warnings) {
  const filePath = path.join(docDir, fileName);
  if (!existsSync(filePath)) {
    problems.push(`${fileName}: file not found`);
    return;
  }
  const html = readFileSync(filePath, "utf8");

  if (!/<title>[^<]+<\/title>/.test(html)) {
    warnings.push(`${fileName}: <title> is missing or empty`);
  }

  const srcRe = /src="([^"]+)"/g;
  let m;
  while ((m = srcRe.exec(html))) {
    const src = m[1];
    if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) continue;
    if (!existsSync(path.join(docDir, src))) {
      problems.push(`${fileName}: missing image "${src}"`);
    }
  }

  checkBlockShapes(html, fileName, warnings);
}

function count(html, re) {
  return (html.match(re) ?? []).length;
}

/**
 * Heuristic, count-based checks — not a real HTML parser. They compare how
 * many times a block's wrapper class appears against how many times its
 * required inner piece appears. Cheap and good enough to catch a forgotten
 * step__text or note__label; not meant to catch everything.
 */
function checkBlockShapes(html, fileName, warnings) {
  const steps = count(html, /class="step"/g);
  const stepTitles = count(html, /step__title/g);
  const stepTexts = count(html, /step__text/g);
  if (stepTitles < steps) warnings.push(`${fileName}: ${steps - stepTitles} .step block(s) may be missing a step__title`);
  if (stepTexts < steps) warnings.push(`${fileName}: ${steps - stepTexts} .step block(s) may be missing a step__text`);

  const figures = count(html, /<figure/g);
  const figureImgs = count(html, /<img/g);
  if (figureImgs < figures) warnings.push(`${fileName}: ${figures - figureImgs} <figure> block(s) may be missing an <img>`);

  const notes = count(html, /class="note(?=["\s])/g);
  const noteLabels = count(html, /note__label/g);
  const noteTexts = count(html, /note__text/g);
  if (noteLabels < notes) warnings.push(`${fileName}: ${notes - noteLabels} .note block(s) may be missing a note__label`);
  if (noteTexts < notes) warnings.push(`${fileName}: ${notes - noteTexts} .note block(s) may be missing a note__text`);
}

export function validateDoc(docDir) {
  const problems = [];
  const warnings = [];

  checkHtmlFile(docDir, "title.html", problems, warnings);
  checkHtmlFile(docDir, "content.html", problems, warnings);

  const configPath = path.join(docDir, "doc.config.json");
  if (existsSync(configPath)) {
    try {
      const cfg = JSON.parse(readFileSync(configPath, "utf8"));
      if (cfg.theme && !VALID_THEMES.includes(cfg.theme)) {
        problems.push(`doc.config.json: unknown theme "${cfg.theme}" (valid: ${VALID_THEMES.join(", ")})`);
      }
    } catch (err) {
      problems.push(`doc.config.json: invalid JSON (${err.message})`);
    }
  }

  return { problems, warnings };
}
