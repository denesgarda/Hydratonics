# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read these too

- `project_context.txt` — product, formula, business, and website history. The owner maintains this across many chats (not just Claude Code) as the durable memory of the whole project. When asked to update it: read the actual current file first, preserve all existing content unless something is specifically wrong, only change what's needed, and report every change made afterward as an explicit changelog. Never delete historical information.

Open decisions, working-style preferences, and technical gotchas from past sessions are kept in Claude Code's persistent memory rather than a repo file — no separate handoff doc to check here.

## What this is

A static marketing site for Hydratonics, a tiered electrolyte supplement brand. No build system, no package manager, no framework — plain HTML/CSS/JS files deployed as-is via GitHub Pages to `hydratonics.com` (see `CNAME`). There is no dev server, linter, or test suite; "running" the site means opening the HTML files directly or serving the directory statically (e.g. `python3 -m http.server`).

## Structure

Each route is a self-contained `index.html` with its CSS in an inline `<style>` block and any JS in an inline `<script>` block at the bottom — there is no shared CSS/JS file, so styles and design tokens are copy-pasted per page (see below).

- `index.html` — main landing page (hero, formula tiers, mission section [currently commented out], email signup)
- `formula/index.html` — dedicated page detailing the product formula
- `sugar/index.html` — deep-dive on the SGLT1/dextrose rationale (why there's sugar in the formula)
- `founding/index.html` — Founding Member invite redemption (code check → accept invite → confirmation), backed by its own Google Apps Script Web App (a Sheet of invite codes, separate from the email-signup script). Fully dark-themed, unlike the rest of the site, deliberately. Reference copy of its backend script lives at `founding/apps-script.gs` (not executed by the site — the real deployment is in the owner's Google account).
- `faq/index.html` — FAQ, sectioned (Ingredients & Safety / What Sets This Apart / Using It), accordion UI, deep-linkable by URL hash to individual questions or whole sections
- `privacy/index.html` — privacy policy, audited against actual data collection (not generic boilerplate)
- `terms/index.html` — Terms of Service (acceptance, acceptable use, IP, health/FDA disclaimer, no warranties, liability, governing law, contact)
- `compare/index.html` — "Where We Stand" competitor deep-dive (SkyMD, Protekt, Magna, Cadence, Source Minerals). Built, but currently fully unavailable by design: not linked anywhere, excluded from `sitemap.xml` and `llms.txt`, `noindex, nofollow`'d, and `Disallow`'d in `robots.txt`. File is intentionally kept (not deleted) but should be treated as if it doesn't exist until told otherwise.
- `landing/01/index.html` — an alternate/variant landing page (numbered so more variants can be added, e.g. `landing/02/`). `noindex`'d and excluded from the sitemap — see the New page SEO/legal checklist below.
- `feedback/01/`, `feedback/02/`, `feedback/03/` — sequential taste-feedback survey pages; each is a snapshot for a round of testing, kept rather than overwritten so past surveys stay reproducible. When asked to make a new feedback form, copy the most recent numbered folder into the next number rather than editing an old one. `noindex`'d and excluded from the sitemap — same reasoning as `landing/`.
- `404.html` — GitHub Pages custom 404
- `fonts/` — self-hosted `avenir-ultra-bold.woff2` (referenced via relative path, so nesting depth matters — see below)
- `assets/` — misc images (e.g. `line.png`), plus the real favicon files (`favicon.svg`, `favicon-32.png`, `favicon-48.png`, `apple-touch-icon.png`, `logo.png`)
- `robots.txt`, `sitemap.xml`, `llms.txt`, `favicon.ico` — SEO/AEO infrastructure at repo root, all absolute-path referenced so nesting depth doesn't matter for them

## Conventions that matter across files

- **Design tokens are duplicated per page**, not shared. Each page's `<style>` block redefines the same CSS custom properties near the top (`--white`, `--ink`, `--grey-dark`, `--t1-blue`, `--font-display`, `--font-body`, `--font-mono`, etc.). When changing a color, spacing value, or font stack, grep across all `index.html` files and update each occurrence — there is no single source of truth to edit once.
- **Fonts**: Display font is a self-hosted `Avenir` (`fonts/avenir-ultra-bold.woff2`, weight 900), body font is `STIX Two Text` (Google Fonts), mono is `DM Mono` (Google Fonts). The `@font-face` `src` path is relative and must match nesting depth (`fonts/...` at root, `../fonts/...` one level deep like `formula/`, `../../fonts/...` two levels deep like `feedback/01/`).
- **The brand wordmark** is an inline `<svg class="brand-svg">` of fully-outlined paths (not text), so it renders correctly with no font dependency. It's duplicated inline in every page's header/footer.
- **Favicon**: every page carries both the original dark/light-aware `data:` URI SVG `rel="icon"` tag (kept as-is, still the one that actually renders in-browser) *and*, added alongside it, real file-based tags pointing at `/assets/favicon.svg`, `/assets/favicon-32.png`, `/assets/favicon-48.png`, and `/assets/apple-touch-icon.png`, plus `/favicon.ico` at the repo root (no `<link>` tag needed for that one — browsers/Google auto-discover it by convention). The file-based versions exist because Google Search doesn't reliably pick up `data:` URI favicons for search results; don't remove the `data:` URI tag when touching this, it's additive.
- **Email/signup forms**: any `<form data-form>` with an `input[name="email"]` is wired up by a small inline script that POSTs to a Google Apps Script Web App endpoint (`https://script.google.com/macros/s/.../exec`) using `mode: 'no-cors'` and `application/x-www-form-urlencoded` body, then hides the form and reveals a sibling `[data-confirm]` element. Each page/section can have its own script endpoint — check before assuming they're the same across pages (the feedback pages define `SCRIPT_URL` as a named constant; `index.html` and `landing/01` inline the URL directly in the fetch call).
- **`founding/index.html` is the one exception to the `no-cors` pattern above** — it's the only form on the site that needs to read an actual response back (whether a code is valid, the assigned member number), so it uses GET requests with the default `fetch()` CORS mode instead of POST+`no-cors`. It has its own `SCRIPT_URL` constant pointing at a separate Apps Script deployment (its own Sheet of invite codes) — don't assume it shares an endpoint with the email-signup forms.
- Tier colors are consistent brand constants: `--t1-blue`, `--t2-amber`, `--t3-red` correspond to the three formula tiers (by output/exertion level).

## When editing

- There's no build step — edits to any `index.html` are live immediately on refresh/deploy. Just push to `main` (GitHub Pages serves directly from the repo).
- When adding a new page, copy the closest existing page (same nesting depth) as a starting point rather than writing one from scratch, to keep the head boilerplate (favicon, fonts, tokens) and form-submission pattern consistent.
- Ignore `.DS_Store` files scattered through the tree (macOS artifacts, currently tracked in a few places) — don't intentionally edit or rely on them.

### SEO/legal maintenance checklist

Added 2026-08-13 alongside the site's first real SEO/AEO/legal pass, so this infrastructure doesn't silently rot as the site grows or changes. Two situations trigger it: adding a new page, or editing something that already exists. Each item needs a conscious yes/no, not an assumption.

**New pages** (the "copy the closest existing page" boilerplate above carries most of this forward automatically, but still check each item):

1. **`sitemap.xml`** — does this page belong in it? A real content page (like `/formula/`) goes in. A utility form, an A/B landing variant, a page deliberately kept unavailable (like `/compare/`), or anything that duplicates existing content does not — give it `<meta name="robots" content="noindex, follow" />` in its `<head>` instead (see `/landing/01/` and `/feedback/0N/` for the pattern) and leave it out of the sitemap.
2. **Head boilerplate** — copied from the sibling page, then edit per-page: `<title>`, `<meta name="description">`, `<link rel="canonical">`, and the matching `og:*`/`twitter:*` tags. Don't leave another page's canonical URL or description in place.
3. **Footer** — the FDA disclaimer paragraph and the Terms of Service link are part of the shared footer block being copied. Confirm they came along; don't let a hand-trimmed footer silently drop them.
4. **New claims** — if the page says anything new about what the product does for the body (not just what's in it), don't assume the standard footer disclaimer alone covers it. Flag it for a human look rather than trusting the boilerplate by default.
5. **Structured data (JSON-LD)** — only add it if the page is a genuinely new content type that has a real schema.org match (an FAQ page, eventually a real Product page once there's an actual purchase flow). Most new pages need none; don't add schema just because the last page had some.
6. **JS-rendered content** — if any of the page's substantive content (not just animation/interaction) is generated by JS rather than present as static HTML, add a fallback for it in the same pass, not as a follow-up later: real text in the DOM, readable by any crawler, most AI crawlers (and some other bots) don't execute JS. Whether that text is visible on the page or not is a separate, per-case design call — see the `.sr-only` class in `index.html`'s `#comparison` section for the visually-hidden-but-crawlable pattern (used there after the owner twice found a visible version too visually intrusive). Prefer this over `display:none`, which search engines can discount as manipulative hidden content.

**Editing existing content** — nothing here auto-syncs; each of these can silently go stale:

7. **FAQ edits** — if any question or answer text in `faq/index.html` changes, regenerate the `FAQPage` JSON-LD block to match it exactly. Google's structured data guidelines require the schema to match visible content; a stale mismatch risks Google quietly disabling rich results for the page rather than erroring anywhere visible.
8. **New/changed claims on an existing page** — same concern as item 4 above, not just for brand-new pages. If an edit adds or changes what's claimed about what the product does for the body, re-check whether the standard footer disclaimer still covers it.
9. **Formula, tiers, or competitive-positioning changes** — check `llms.txt` for staleness. It's a hand-written summary; nothing regenerates it automatically when the underlying facts change.
10. **Taking a page out of circulation without deleting it** — the reusable pattern (used for `/compare/`, 2026-08-13): remove every link to it, remove its entry from `sitemap.xml`, remove/trim its section in `llms.txt`, add `<meta name="robots" content="noindex, nofollow" />` to the page itself, add a `Disallow:` line for it in `robots.txt`, and leave the file in place unless explicitly told to delete it.
11. **Brand facts change** (name, logo, social handles) — the `Organization` JSON-LD on `index.html` hardcodes name/url/logo/`sameAs`; update it if any of those actually change.
12. **`sitemap.xml`'s `<lastmod>`** — bump the date for a page when its content meaningfully changes. Not critical, but it's a real (if minor) freshness signal and costs nothing to keep current.
