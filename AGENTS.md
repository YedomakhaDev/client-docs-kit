# client-docs-kit

A kit for building PDF instructions and reports for clients. Monochrome style:
dark title page, light content pages, no color and no logo — hierarchy comes
only from weight, size, and spacing.

## Structure

```
styles/doc.css          — all styles (screen + print), block classes
blocks-catalog.html     — open in a browser: visual reference of every block + theme previews
config.default.json     — project-wide defaults (theme, which title-page fields to show)
template/title.html     — blank title page template
template/content.html   — blank content page template with comments
template/doc.config.json — copy-paste starting point for a per-document config override
docs/<doc-name>/        — one document = a folder with title.html + content.html + screenshots/
scripts/export-pdf.mjs  — PDF export
```

## How to build a new document

1. Copy `template/title.html` and `template/content.html` into `docs/<new-doc-name>/`.
2. Fill in `title.html`: document title, project, date, version.
3. Fill in `content.html` using the ready-made blocks from `blocks-catalog.html`
   (the class name is shown under each example). Don't invent new markup —
   assemble the document from existing classes.
4. Put screenshots in `docs/<doc-name>/screenshots/` and reference them with a relative path.
5. (Optional) Override settings for just this document — see "Settings" below.
6. Build the PDF:

   ```
   node scripts/export-pdf.mjs docs/<doc-name>
   ```

   The PDF is written to `docs/<doc-name>/<doc-name>.pdf`. Open it and check that:
   - short steps aren't split across pages;
   - a screenshot and its caption stay together;
   - tall screenshots aren't shrunk to an unreadable size (crop them beforehand instead);
   - tables/notes don't collide with the header or footer.

## Settings (theme, which title-page fields to show)

Three layers, each overriding the one before it:

1. **`config.default.json`** (project root) — the project-wide default. Edit
   this once to change the look for every document going forward.
2. **`docs/<doc-name>/doc.config.json`** (optional, per document) — copy
   `template/doc.config.json` into the doc's folder and change only the keys
   that should differ from the default for this one document.
3. **CLI flags** — a one-off override for a single export run, without
   touching any file:

   ```
   node scripts/export-pdf.mjs docs/<doc-name> --theme=light --no-author
   ```

Available keys:

```json
{
  "theme": "dark",            // "dark" | "light" | "graphite" — title page only
  "title": {
    "showDate": true,
    "showVersion": true,
    "showAuthor": true
  }
}
```

Flag equivalents: `--theme=dark|light|graphite`, `--no-date`, `--no-version`, `--no-author`.

All three themes are previewed side by side at the top of `blocks-catalog.html`
— open it in a browser to pick one before exporting. Content pages always stay
light regardless of theme; only the title page changes.

## Block set

Section heading, numbered step, screenshot with caption, text + screenshot side
by side (`.split`), note/warning (`.note`, `.note--warning`), list/checklist,
table, links. Full reference with markup — `blocks-catalog.html`.

Forced page break — the `.page-break` class on `<section class="section">`.
Without it, sections flow across pages naturally.

## Implementation notes

- The title page and content pages are rendered and exported **separately**,
  then merged (`pdf-lib`). This is the only reliable way to give the title
  page a dark background with no page number while the rest of the pages get
  a header/footer with a page number: Chromium applies its PDF header/footer
  to every page of a single render identically, with no per-page exceptions.
- `styles/doc.css` intentionally has **no** `@page { margin: ... }` rule. A
  CSS `@page` margin overrides the margin passed to Playwright's `page.pdf()`
  and zeroes out the space reserved for the header/footer. If margins need
  adjusting, do it in `scripts/export-pdf.mjs` (`margin: {...}`), not in CSS.
- The header/footer shows the document title (the page's `<title>`) and the
  page number. The section name doesn't appear in the header — Chromium has
  no way to know which section lands on which page without manually splitting
  the document into per-section files.
