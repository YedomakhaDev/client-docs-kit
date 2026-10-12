# Backlog after the first real-world runs

## Context

The kit has been through three real passes (not synthetic test content):

1. **A single instruction document** — "How to Add an FAQ Block to a Page"
   for a client project, with real wp-admin screenshots (`docs/add-faq-block/`
   in the working copy — deliberately not committed to this repo, since real
   client content doesn't belong in the generic kit).
2. **A multi-chapter manual** — `scripts/build-manual.mjs`, assembling several
   `docs/<name>/` into one book with continuous pagination, a table of
   contents, and PDF bookmarks. Exercised against a synthetic 2-chapter smoke
   test (`docs/_manual-example/`); the bookmarks were personally verified in
   Preview.app.
3. **A single report document** — "How Medication Search & Filters Work"
   for a client project, using the "report" framing (describing current
   behavior) rather than "instruction" (how to do something) — same real
   wp-admin/front-end screenshot workflow, also not committed to this repo.

Both levels work. Below is what's still untested or clearly missing,
prioritized for the next pass.

## 1. Batch screenshot capture — priority #1

Screenshot capture is still fully manual/interactive: navigate → snapshot the
DOM → find the element → click → snapshot → screenshot → read the image back
to verify. For a single FAQ block this was ~20 steps and dominated the time
spent, more than writing the document's own text.

For a manual with 10-15 chapters (real full-project documentation) this
doesn't scale — it should become bottleneck #1.

**Direction:** write this as one Playwright script per chapter (a list of
steps → a screenshot filename in `docs/<name>/screenshots/`), run headless in
one pass, instead of a series of manual tool calls. Might be worth adding a
reference example of such a script to the kit (not hardcoded to a specific
project, since the kit stays platform-agnostic).

## 2. TOC overflow past one page — code exists, never exercised

`build-manual.mjs` has a two-pass correction for page offsets in case the
table of contents doesn't fit on one page (see `buildTocEntries` + a TOC
re-render with the corrected page count). But in practice there were only 2
chapters — the TOC always fit on one page on the first try. The logic should
be correct in theory, but has never actually been exercised.

**To verify:** build a manifest with 10+ chapters (synthetic is fine) and
confirm the correction actually triggers and produces correct page numbers.

## 3. Dense real content hasn't been tested

All test content (both add-faq-block and manual-example) was short — 3-5
sections, 1-2 screenshots per page. Untested:
- long tables (`doc-table`);
- wide retina screenshots (`figure--wide`);
- chapters with many sections back to back (page-break behavior —
  `break-inside`/`page-break` — under dense material).

## 4. Bookmarks are flat, chapter-level only

A deliberate v1 decision (see `scripts/lib/outline.mjs`) — one bookmark per
chapter plus the TOC, no nesting. If a real manual ends up with a large
chapter that has several subsections (e.g. "Managing Medications"), the
sidebar can't jump to a specific subsection — only to the start of the
chapter.

**Not a bug, but a real boundary** to keep in mind when designing a future
manual's chapter structure (split into smaller chapters rather than relying
on nested bookmarks).

## 5. Real client content has no permanent home yet

The finished client document (`docs/add-faq-block/` in the working copy)
only lives locally on disk, committed nowhere (deliberately — see "Context"
above). If the local clone is wiped, the document is gone.

**To decide:** where final client PDFs/sources should actually live — inside
the client project itself (e.g. `docs/client-deliverables/` with `*.pdf`
gitignored, sources only), or somewhere outside git entirely (local disk /
cloud folder). Not decided yet.

## 6. WP-specific helpers are still ad hoc chat commands

Capturing wp-admin screenshots used two tricks, neither ever turned into a
reusable script:
- generating an auth cookie via `wp eval` (`wp_generate_auth_cookie` +
  the `AUTH_COOKIE`/`LOGGED_IN_COOKIE` constants) and injecting it into the
  Playwright context — logging in without the client's password, without
  changing any account state;
- hiding `#wpadminbar` via injected CSS before a front-end screenshot.

Both are WordPress-specific, so deliberately NOT in this kit (the kit stays
platform-agnostic) — they should live in the specific client project instead
(e.g. `bin/wp-login-cookie.sh` plus a ready-made hide-admin-bar snippet). Not
written yet — the next run will redo this by hand again.

## 7. No scaffold script for a manual

`new-doc.mjs` scaffolds a single document. There's no equivalent for a
manual — the cover `title.html` and `manifest.json` are currently created by
hand, copying `template/title.html`. A straightforward addition modeled on
`new-doc.mjs` (`scripts/new-manual.mjs <manual-folder> "<Book Title>"
"<Project>"`).

## 8. No regression tests/CI

The smoke test (`docs/_manual-example/`) has to be remembered and rerun by
hand after changes under `scripts/lib/*`. No `npm test`, no CI workflow. For
a kit meant to outlive several projects, this is a gap in regression
protection — not critical right now, but worth keeping in mind.

## 9. Running header always says "Client instructions", regardless of document type

`HEADER_TEMPLATE` in `scripts/lib/render.mjs` hardcodes the right-hand label
in the running header to "Client instructions" on every content page. The
title page's kicker (`title-page__kicker`) is free text and gets set
correctly per document (e.g. "Client report" for a report-framed document),
but the content-page header doesn't follow it — so a report built today
shows "Client report" on its cover and "Client instructions" on every page
after that.

**Direction:** either make the header label configurable (another
`config.default.json`/`doc.config.json` key, e.g. `title.kicker`, reused for
both the cover and the running header), or derive it from the title page's
own kicker text at render time instead of hardcoding it in the template
string.

## Already closed (for reference, don't re-pick these up)

- Refactoring `export-pdf.mjs` onto shared `render.mjs`/`config.mjs` — done,
  verified via byte-identical output comparison.
- TOC + PDF bookmarks + continuous page numbering — done and working (see
  items 2 and 4 above for the remaining boundaries/untested cases).
- `scripts/build-manual.mjs` — done, exercised via the smoke test.
- `AGENTS.md` and `README.md` — updated, documenting both workflows (single
  document and multi-chapter manual).
