# client-docs-kit

A kit for building polished, client-facing PDF instructions and reports —
single documents or full multi-chapter manuals — from plain HTML, with real
screenshots from a live app.

**Design philosophy:** monochrome editorial style. Dark title page, light
content pages, no color accents, no logo. Hierarchy comes only from weight,
size, and spacing — the kind of document that reads as deliberately designed
rather than a Word export.

## Features

- **Plain-HTML authoring.** Content is a handful of copy-paste block classes
  (steps, screenshots, notes, tables, checklists) — no visual editor, no
  proprietary format. See [Block reference](#block-reference).
- **Fast feedback loop.** `lint-doc.mjs` catches missing screenshots, empty
  titles, and incomplete blocks in milliseconds, no browser involved. Save
  the slow, full Chromium render for right before a document is done.
- **One-image review.** `--preview` renders every page of the built PDF into
  a single contact-sheet PNG, so reviewing a 10-page document costs one image
  read instead of ten.
- **Three built-in themes** (dark / light / graphite) for the title page,
  configurable per-project, per-document, or per-run.
- **Multi-chapter manuals.** Assemble several independently-authored
  documents into one continuously-paginated book, with a generated table of
  contents and a clickable PDF bookmark sidebar. See
  [Building a multi-chapter manual](#building-a-multi-chapter-manual).
- **Built for screenshotting a real app.** The intended workflow is: drive a
  live dev server with browser automation, capture a screenshot after each
  step, and write the document around what was actually done — not a
  description of what the app is supposed to do.
- **Claude Code integration.** `AGENTS.md` is a complete reference for coding
  agents, and an optional `/new-doc` skill wraps the whole build loop behind
  one command. See [Claude Code integration](#claude-code-integration).

## Requirements

- Node.js (any reasonably recent version — the kit uses native ESM, no
  build step)
- [Playwright](https://playwright.dev/)'s Chromium, for rendering HTML to PDF
- Optionally, [poppler](https://poppler.freedesktop.org/)'s `pdftoppm` on
  `PATH`, for the `--preview` contact sheet. The only dependency in this kit
  that isn't npm-managed.
  - macOS: `brew install poppler`
  - Debian/Ubuntu: `apt install poppler-utils`

  Without it, PDFs still build fine — you just don't get the contact sheet.

## Install

Clone it into a subfolder of whatever project you're documenting (not the
project root, to avoid clashing with that project's own tooling):

```
git clone https://github.com/YedomakhaDev/client-docs-kit.git client-docs-kit
cd client-docs-kit
npm install
npx playwright install chromium
```

## Quick start

```
node scripts/new-doc.mjs how-to-publish "How to Publish a Page" "Acme Inc."
# -> fill in docs/how-to-publish/content.html, add screenshots

node scripts/lint-doc.mjs docs/how-to-publish
node scripts/export-pdf.mjs docs/how-to-publish --preview
# -> docs/how-to-publish/how-to-publish.pdf
# -> docs/how-to-publish/how-to-publish-preview.png (contact sheet)
```

`docs/example-instruction/` and `docs/demo-walkthrough/` are working,
synthetic examples shipped with the kit — read their `content.html` as a
second reference alongside the block syntax below.

## Project structure

```
styles/doc.css           — all styles (screen + print), every block class
blocks-catalog.html      — open in a browser: visual reference + theme previews (humans only)
config.default.json      — project-wide defaults (theme, which title-page fields to show)
template/title.html      — blank title page template
template/content.html    — blank content page template with comments
template/doc.config.json — copy-paste starting point for a per-document config override
docs/<doc-name>/         — one document = a folder with title.html + content.html + screenshots/
scripts/new-doc.mjs      — scaffold a new docs/<doc-name>/ from template/
scripts/lint-doc.mjs     — fast structural check, no browser, no PDF
scripts/export-pdf.mjs   — PDF export for a single document
scripts/preview-pdf.mjs  — contact-sheet PNG for an already-built PDF
scripts/build-manual.mjs — assemble several docs/<name>/ chapters into one
                            continuously-paginated, bookmarked PDF
scripts/lib/             — shared rendering, config, pagination, and outline code
claude-skill/new-doc/    — optional Claude Code skill (see below)
```

## Anatomy of a document

A document is a folder, `docs/<name>/`, with three things:

- **`title.html`** — the cover page. Full-bleed, themed, shows the document
  title, project name, and optional date/version/author metadata.
- **`content.html`** — everything else, assembled from the block classes
  below. Gets a running header (document title) and footer (page number)
  automatically.
- **`screenshots/`** — PNGs referenced from `content.html` with a relative
  path (`screenshots/01-foo.png`). Name them in step order so the file list
  matches the document's flow.

`scripts/new-doc.mjs` scaffolds all three from `template/` with the
boilerplate (stylesheet path, title, project name, date) already filled in.

## Block reference

Copy-paste these into `content.html` — don't invent new markup, the
stylesheet only styles these classes.

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

**Screenshot with caption** (add `figure--wide` on very wide screenshots to
bleed past the text margin):
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

Open `blocks-catalog.html` directly in a browser for a visual reference of
all of the above plus the three title-page themes side by side.

## Configuration

Theme and which title-page metadata fields to show, layered — each one
overriding the one before it:

1. **`config.default.json`** (kit root) — the project-wide default.
2. **`docs/<doc-name>/doc.config.json`** (optional, per document) — copy
   `template/doc.config.json` and override only what should differ for this
   one document.
3. **CLI flags** — a one-off override for a single run:
   ```
   node scripts/export-pdf.mjs docs/<doc-name> --theme=light --no-author
   ```

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

Content pages always stay light regardless of theme — only the title page
changes.

## Screenshots from a live project

When documenting a real app rather than writing from a mockup: drive it with
browser automation (e.g. the chrome-devtools / Playwright MCP tools), perform
the actual steps, and save a screenshot after each meaningful step straight
into `docs/<doc-name>/screenshots/`, named in step order (`01-...`, `02-...`).
Then write `content.html` describing exactly what was done and reference
those real screenshots — don't hand-wave steps that weren't actually
performed.

## Building a multi-chapter manual

For a deliverable that covers much more ground than one document — a full
site-administration guide at the end of a build, say — don't write one giant
`content.html`. Author each topic as its own normal document (scaffold →
lint → export, same as above), then assemble the finished chapters into one
book:

```
node scripts/build-manual.mjs docs/<manifest-folder>/manifest.json --preview
```

Given a manifest next to a cover `title.html`:

```json
{
  "title": "Book title",
  "chapters": [
    { "doc": "../pages-and-blocks" },
    { "doc": "../managing-faq", "title": "Optional title override" }
  ]
}
```

`build-manual.mjs` validates every chapter up front (same checks as
`lint-doc.mjs`, aggregated across all of them), then renders: cover → table
of contents (with real page numbers) → one divider page + content per
chapter — with continuous page numbers across the whole book and a PDF
bookmark sidebar (one entry per chapter, plus the table of contents).

See `docs/_manual-example/` for a working two-chapter example, and
`AGENTS.md` for the full writeup including advice on scoping a large manual
by how often the client actually touches each part of the site.

## Claude Code integration

- `AGENTS.md` is read automatically by coding agents that support the
  AGENTS.md convention — it's the single source of truth for the block
  reference, scripts, and config system. `CLAUDE.md` is a one-line pointer to
  it for Claude Code specifically.
- `claude-skill/new-doc/` is a ready-made Claude Code skill wrapping the full
  build loop (scaffold → fill → lint → screenshot → export) behind a
  `/new-doc` command. It isn't auto-discovered from inside a cloned
  subfolder — copy it into the host project once to enable it there:
  ```
  cp -r client-docs-kit/claude-skill/new-doc .claude/skills/new-doc
  ```

## Architecture notes

A few non-obvious decisions, in more detail in `AGENTS.md`:

- The title page and content pages are rendered and merged separately
  (`pdf-lib`) — the only reliable way to give the title page a dark,
  page-number-free background while content pages get a running
  header/footer, since Chromium applies its print header/footer to every
  page of a single render identically.
- `styles/doc.css` intentionally has no `@page { margin: ... }` — that would
  override the margin passed to Playwright's `page.pdf()` and zero out the
  space reserved for the header/footer.
- A multi-chapter manual's PDF outline/bookmarks are hand-built via pdf-lib's
  low-level primitives (no high-level bookmark API exists). If that ever
  breaks across a pdf-lib upgrade, the manual still works without it — the
  printed table of contents has the same titles and page numbers, just
  without sidebar jump links.
