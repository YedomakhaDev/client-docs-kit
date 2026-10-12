---
name: new-doc
description: Build a new client-facing PDF (instructions or report) using client-docs-kit. Use when the user asks to create, draft, document, or generate a PDF guide/instructions/report for a client, or to walk through a feature and turn it into client-facing documentation.
---

This skill wraps the client-docs-kit build loop. It assumes the kit lives at
`client-docs-kit/` relative to the project root (adjust the path below if it
was cloned somewhere else).

Read `client-docs-kit/AGENTS.md` first — it has the full block reference and
config system. The steps below are the sequence; AGENTS.md has the detail.

1. **Clarify the scenario** if the user hasn't given one: what feature/flow is
   being documented, and is there a running dev server / staging URL to drive
   with browser automation, or is this written from a description only?

2. **Scaffold the doc:**
   ```
   node client-docs-kit/scripts/new-doc.mjs <doc-name> "<Document Title>" "<Project Name>"
   ```

3. **If there's a live app to document:** use browser automation (the
   chrome-devtools / Playwright MCP tools) to actually perform the scenario's
   steps, saving a screenshot after each meaningful step into
   `client-docs-kit/docs/<doc-name>/screenshots/` as `01-...png`, `02-...png`,
   etc. Describe in the document exactly what was done — don't invent steps
   that weren't actually performed.

4. **Write `content.html`** for the doc using the block reference in
   `client-docs-kit/AGENTS.md` — assemble from existing classes, don't
   invent new markup.

5. **Fast check before rendering:**
   ```
   node client-docs-kit/scripts/lint-doc.mjs client-docs-kit/docs/<doc-name>
   ```
   Fix anything it flags (usually a missing screenshot path) before moving on.

6. **Build the PDF:**
   ```
   node client-docs-kit/scripts/export-pdf.mjs client-docs-kit/docs/<doc-name> --preview
   ```
   Pass `--theme=dark|light|graphite` and/or `--no-date`/`--no-version`/`--no-author`
   if the user wants non-default settings for just this document.

7. **Spot-check** the result by reading the contact-sheet PNG that `--preview`
   produced (`<doc-name>-preview.png`, next to the PDF) — one image with every
   page, instead of rendering and reading each page separately. Look for
   pagination issues lint can't catch (split steps, separated
   screenshot/caption, header/footer collisions). A full visual review isn't
   needed on every draft; save it for right before calling the document done.
