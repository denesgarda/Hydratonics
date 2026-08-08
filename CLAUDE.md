# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static marketing site for Hydratonics, a tiered electrolyte supplement brand. No build system, no package manager, no framework — plain HTML/CSS/JS files deployed as-is via GitHub Pages to `hydratonics.com` (see `CNAME`). There is no dev server, linter, or test suite; "running" the site means opening the HTML files directly or serving the directory statically (e.g. `python3 -m http.server`).

## Structure

Each route is a self-contained `index.html` with its CSS in an inline `<style>` block and any JS in an inline `<script>` block at the bottom — there is no shared CSS/JS file, so styles and design tokens are copy-pasted per page (see below).

- `index.html` — main landing page (hero, formula tiers, mission section [currently commented out], email signup)
- `formula/index.html` — dedicated page detailing the product formula
- `founding/index.html` — Founding Member invite redemption (code check → accept invite → confirmation), backed by its own Google Apps Script Web App (a Sheet of invite codes, separate from the email-signup script)
- `landing/01/index.html` — an alternate/variant landing page (numbered so more variants can be added, e.g. `landing/02/`)
- `feedback/01/`, `feedback/02/`, `feedback/03/` — sequential taste-feedback survey pages; each is a snapshot for a round of testing, kept rather than overwritten so past surveys stay reproducible. When asked to make a new feedback form, copy the most recent numbered folder into the next number rather than editing an old one.
- `404.html` — GitHub Pages custom 404
- `fonts/` — self-hosted `avenir-ultra-bold.woff2` (referenced via relative path, so nesting depth matters — see below)
- `assets/` — misc images (e.g. `line.png`)

## Conventions that matter across files

- **Design tokens are duplicated per page**, not shared. Each page's `<style>` block redefines the same CSS custom properties near the top (`--white`, `--ink`, `--grey-dark`, `--t1-blue`, `--font-display`, `--font-body`, `--font-mono`, etc.). When changing a color, spacing value, or font stack, grep across all `index.html` files and update each occurrence — there is no single source of truth to edit once.
- **Fonts**: Display font is a self-hosted `Avenir` (`fonts/avenir-ultra-bold.woff2`, weight 900), body font is `STIX Two Text` (Google Fonts), mono is `DM Mono` (Google Fonts). The `@font-face` `src` path is relative and must match nesting depth (`fonts/...` at root, `../fonts/...` one level deep like `formula/`, `../../fonts/...` two levels deep like `feedback/01/`).
- **The brand wordmark** is an inline `<svg class="brand-svg">` of fully-outlined paths (not text), so it renders correctly with no font dependency. It's duplicated inline in every page's header/footer.
- **Favicon** is a data-URI SVG (light/dark aware via `prefers-color-scheme`), duplicated identically across every page's `<head>`.
- **Email/signup forms**: any `<form data-form>` with an `input[name="email"]` is wired up by a small inline script that POSTs to a Google Apps Script Web App endpoint (`https://script.google.com/macros/s/.../exec`) using `mode: 'no-cors'` and `application/x-www-form-urlencoded` body, then hides the form and reveals a sibling `[data-confirm]` element. Each page/section can have its own script endpoint — check before assuming they're the same across pages (the feedback pages define `SCRIPT_URL` as a named constant; `index.html` and `landing/01` inline the URL directly in the fetch call).
- **`founding/index.html` is the one exception to the `no-cors` pattern above** — it's the only form on the site that needs to read an actual response back (whether a code is valid, the assigned member number), so it uses GET requests with the default `fetch()` CORS mode instead of POST+`no-cors`. It has its own `SCRIPT_URL` constant pointing at a separate Apps Script deployment (its own Sheet of invite codes) — don't assume it shares an endpoint with the email-signup forms.
- Tier colors are consistent brand constants: `--t1-blue`, `--t2-amber`, `--t3-red` correspond to the three formula tiers (by output/exertion level).

## When editing

- There's no build step — edits to any `index.html` are live immediately on refresh/deploy. Just push to `main` (GitHub Pages serves directly from the repo).
- When adding a new page, copy the closest existing page (same nesting depth) as a starting point rather than writing one from scratch, to keep the head boilerplate (favicon, fonts, tokens) and form-submission pattern consistent.
- Ignore `.DS_Store` files scattered through the tree (macOS artifacts, currently tracked in a few places) — don't intentionally edit or rely on them.
