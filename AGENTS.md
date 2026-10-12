# client-docs-kit

A kit for building PDF instructions and reports for clients. Monochrome style:
dark title page, light content pages, no color and no logo — hierarchy comes
only from weight, size, and spacing.

## Structure

```
styles/doc.css           — all styles (screen + print), block classes
blocks-catalog.html      — open in a browser: visual reference + theme previews (humans only, see note below)
config.default.json      — project-wide defaults (theme, which title-page fields to show)
template/title.html      — blank title page template
template/content.html    — blank content page template with comments
template/doc.config.json — copy-paste starting point for a per-document config override
docs/<doc-name>/         — one document = a folder with title.html + content.html + screenshots/
scripts/new-doc.mjs      — scaffold a new docs/<doc-name>/ from template/
scripts/lint-doc.mjs     — fast structural check, no browser, no PDF
scripts/export-pdf.mjs   — PDF export (supports --check to lint-only, --preview for a contact sheet)
scripts/preview-pdf.mjs  — contact-sheet PNG for an already-built PDF
```

## How to build a new document

1. Scaffold it:

   ```
   node scripts/new-doc.mjs <doc-name> "<Document Title>" "<Project Name>"
   ```

   This creates `docs/<doc-name>/title.html` + `content.html` (title/project
   already filled in, stylesheet path already correct) and an empty
   `screenshots/` folder. `<doc-name>` must be lowercase-with-dashes.

2. Fill in `content.html` using the block reference below — assemble from
   these classes, don't invent new markup.
3. Put screenshots in `docs/<doc-name>/screenshots/` and reference them with
   a relative path (`screenshots/foo.png`).
4. (Optional) Override settings for just this document — see "Settings" below.
5. Fast check while drafting (no browser, no PDF — catches missing images,
   empty `<title>`, bad `doc.config.json`, and warns about likely-incomplete
   blocks, e.g. a `.step` with no `step__text`):

   ```
   node scripts/lint-doc.mjs docs/<doc-name>
   ```

6. Build the PDF:

   ```
   node scripts/export-pdf.mjs docs/<doc-name> --preview
   ```

   The PDF is written to `docs/<doc-name>/<doc-name>.pdf`. `export-pdf.mjs`
   runs the same checks as step 5 first and refuses to render if they fail.
   `--preview` additionally renders every page into one contact-sheet PNG
   (`<doc-name>-preview.png`, next to the PDF) — read that one image instead
   of rendering and reading each page separately. Use it to check things
   lint can't:
   - short steps aren't split across pages;
   - a screenshot and its caption stay together;
   - tall screenshots aren't shrunk to an unreadable size (crop them beforehand instead);
   - tables/notes don't collide with the header or footer.

   `--preview` requires poppler's `pdftoppm` on PATH (macOS: `brew install
   poppler`; Debian/Ubuntu: `apt install poppler-utils`) — the only
   non-npm-managed dependency in this kit. Without it, the PDF still builds
   fine; you just don't get the contact sheet. To preview a PDF you already
   built, without re-exporting: `node scripts/preview-pdf.mjs <pdf-path>`.

   You don't need to re-render and re-check every page on every edit — the
   layout engine is deterministic, so a full visual pass is mainly worth it
   right before calling a document done, not after every small text change.

## Block reference (copy-paste into content.html)

**Section** (repeat for each topic; add `page-break` to force a new page):
```html
<section class="section">
  <p class="section__number">Section N</p>
  <h2 class="section__title">Section title</h2>
  ...
</section>
<section class="section page-break"> ... </section>
```

**Numbered step:**
```html
<div class="step">
  <span class="step__index">1</span>
  <div class="step__body">
    <p class="step__title">Short action name</p>
    <p class="step__text">What to do and why.</p>
  </div>
</div>
```

**Screenshot with caption** (add `figure--wide` on very wide screenshots to bleed past the text margin):
```html
<figure class="figure">
  <img src="screenshots/example.png" alt="..." />
  <p class="figure__caption">Caption</p>
</figure>
```

**Text + screenshot side by side:**
```html
<div class="split">
  <div class="split__text"><p>Short explanation.</p></div>
  <figure class="split__figure"><img src="screenshots/example.png" alt="..." /></figure>
</div>
```

**Note / warning** (`note--warning` for things the client must not miss):
```html
<div class="note">
  <p class="note__label">Note</p>
  <p class="note__text">...</p>
</div>
<div class="note note--warning">
  <p class="note__label">Important</p>
  <p class="note__text">...</p>
</div>
```

**List / checklist:**
```html
<ul class="list"><li>...</li></ul>
<ul class="checklist"><li>...</li></ul>
```

**Table:**
```html
<div class="table-wrap">
  <table class="doc-table">
    <thead><tr><th>Field</th><th>Value</th></tr></thead>
    <tbody><tr><td>...</td><td>...</td></tr></tbody>
  </table>
</div>
```

**Links:**
```html
<div class="links">
  <p class="links__item"><a href="#">Label</a></p>
</div>
```

`blocks-catalog.html` renders all of the above (plus the three themes) for a
human to look at in a browser. It's not needed to write content — this
section is the complete markup reference.

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

## Screenshots from a live project

When documenting a real app rather than writing from a mockup: drive the app
with browser automation (e.g. the chrome-devtools / Playwright MCP tools),
perform the actual steps, and save a screenshot after each meaningful step
straight into `docs/<doc-name>/screenshots/`. Name them in step order
(`01-...`, `02-...`, `03-...`) so the file list matches the document's flow.
Then write `content.html` describing exactly what was done and reference
those real screenshots — don't hand-wave steps that weren't actually performed.

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
- `scripts/lint-doc.mjs` / `export-pdf.mjs --check` only catch structural
  issues (missing images, empty title, bad config) via plain text parsing —
  they don't launch a browser and can't catch layout/pagination problems.
  Those still need an actual rendered PDF to see.

## Claude Code integration

- This file is read automatically by coding agents that support the
  AGENTS.md convention. `CLAUDE.md` in this same folder is a one-line pointer
  to this file, for Claude Code specifically.
- `claude-skill/new-doc/` contains a ready-made Claude Code skill that wraps
  the full build loop (scaffold → fill → lint → screenshots → export) behind
  a `/new-doc` command. It's not auto-discovered from inside a cloned
  subfolder — copy `claude-skill/new-doc/` into your host project's
  `.claude/skills/new-doc/` once to enable it there.
