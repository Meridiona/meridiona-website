# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**This is the new Meridian marketing site**, served at **`/new`** on the same Cloudflare Worker as the existing (old) site at `meridiona-website`'s repo root — see `../CLAUDE.md` for the old site. It's two plain, framework-free static HTML files served through Cloudflare's ASSETS binding (from this `new/` subdirectory), reusing the root `worker.js` for dynamic bits (download attribution, waitlist signup) that are global regardless of which site variant is being served.

**Why it lives under `/new` instead of the repo root:** the old site stays live and unaffected at `/` while this one is being built out and validated — nothing here overwrites or risks the existing production site. All asset/script/iframe references in this subtree are rooted at `/new/...` (not `/...`) for exactly this reason; don't "clean up" them back to root-absolute paths without moving the whole site to the repo root first.

- **Type**: Static website (subpath), Cloudflare Workers + Pages assets
- **Language**: HTML, CSS, JavaScript (vanilla, no framework, no build step)
- **Entry points**: `new/index.html` (the landing page, served at `/new/`), `new/demo.html` (the interactive product demo embedded in the hero, served at `/new/demo.html`)
- **Deployment**: Same Cloudflare Worker as the old site (via `wrangler deploy` from the repo root)
- **Tests**: `new/tests/responsive.test.js` — structural + responsiveness checks, run independently of the old site's `../tests/responsive.test.js`

## Architecture

### Two plain HTML files, no bundler, externalized CSS/JS

Earlier versions of this site used a custom single-file bundler (manifest + template JSON + runtime unpacking). That's gone. `index.html` and `demo.html` are ordinary static HTML with **zero inline `<style>`/`<script>` blocks** — all CSS and JS live under `assets/` as separate, cacheable, reusable files. There is no build step; what you edit is what ships.

- **`index.html`** — the landing page markup only: nav, hero, "Why" section, testimonials/FAQ/footer, download modal, social-connect modal, and the theme-switcher widget. Styled by `assets/css/site.css`, driven by `assets/js/site.js`.
- **`demo.html`** — the markup shell for a self-contained interactive recreation of the Meridian app (daily timeline, insights panel, swipe-to-approve/dismiss review modal, capture/Jira toggles, reset). Styled by `assets/css/demo.css`, driven by `assets/js/demo.js`. Embedded in the landing hero via a fixed-resolution (1240×720) `<iframe>` that `assets/js/site.js`'s `HeroEmbed` module scales with `transform: scale(...)` to fit the viewport.
- **`assets/css/site.css`** — design tokens (3 themes: dawn/dusk/paper, as CSS custom properties on `body`/`body[data-theme=...]`) plus every landing-page component class (`.nav__*`, `.hero__*`, `.feature-card`, `.faq-item__*`, `.modal-*`, `.connect-row--*`, `.theme-dot`, etc.).
- **`assets/js/site.js`** — landing-page behavior, split into small modules (`Theme`, `Faq`, `HeroEmbed`, `DownloadModal`, `ConnectModal`), each owning one piece of UI state and re-rendering only its own DOM region.
- **`assets/css/demo.css`** / **`assets/js/demo.js`** — the embedded demo's own design language (Plus Jakarta Sans, fixed-resolution dashboard chrome) and its state machine (`state` + `render()` → `renderToolbar/renderTimeline/renderPanel/renderFloating/renderReview`).
- **`worker.js`** — Cloudflare Worker handling `/dl` (redirect to the latest GitHub release + PostHog attribution), `/download` (interstitial page with waitlist opt-in), `/subscribe` (Resend audience signup, called from `assets/js/site.js`'s download modal and the `/download` page), and per-path `<title>`/description rewriting for `/writing/*` essay pages (via `env.ASSETS.fetch` + string replace — this is why `index.html` must keep exactly one `<title>` and one `<meta name="description">` tag).

### Key design decisions

- **No bundler, no build step**: what's in git is what's deployed. Simpler to review, edit, and reason about than a base64/gzip manifest.
- **Externalized, component-classed CSS/JS**: no inline `style="..."` soup or per-page `<script>` blocks — structure lives in HTML, presentation in `assets/css/*.css` (BEM-ish component classes), behavior in `assets/js/*.js` (small named modules, each rendering its own DOM region). This is what makes the codebase reusable and reviewable rather than one giant one-off file.
- **Fluid layout, not breakpoints**: responsiveness comes from `clamp()` type sizing and `repeat(auto-fit,minmax(...))` grids, so sections reflow continuously rather than snapping at fixed breakpoints. There's no hamburger nav — the nav is compact enough to stay inline at all widths tested.
- **iframe-embedded demo, not inlined markup**: keeping `demo.html` as a separate document (rather than inlining its DOM into `index.html`) keeps its own event handling and CSS self-contained, and mirrors how the original Claude Design prototype scaled a fixed-resolution "device" into the hero. It intentionally has its own design language (Plus Jakarta Sans, fixed dashboard colors) rather than sharing `site.css`'s theme tokens — it's a mock of the *product*, not the marketing site.

## Commands

### Run tests

```bash
cd new && node tests/responsive.test.js
```

(Run `node tests/responsive.test.js` from the repo root separately to check the *old* site — the two suites are independent.)

Tests validate: viewport meta tags, worker.js compatibility (title/description/`</head>` regex targets, `/subscribe` + `/dl` wiring), all three themes present, key sections present (nav, hero, why, faq, footer, both modals, theme switcher), fluid-responsive patterns (`clamp()`, `auto-fit/minmax`), the embedded demo's interactive affordances, and balanced `<script>` tags.

**Exit code**: 0 on success, 1 if any test fails.

### Local preview

```bash
npx wrangler dev
```

or, for a quick static preview without Workers semantics:

```bash
python3 -m http.server 8080
```

### Deploy to Cloudflare

```bash
(cd new && node tests/responsive.test.js) && node ../tests/responsive.test.js && wrangler deploy
```

Run from the repo root. Deploys via the Cloudflare Workers CLI — `wrangler.jsonc` (repo root) specifies `compatibility_date`, `compatibility_flags: ["nodejs_compat"]`, `observability.enabled`, and the `ASSETS` binding pointing at the repo root, so both the old site (`/`) and this one (`/new`) ship in the same deploy.

## File Structure (this subtree)

```
new/
├── index.html                 # Landing page markup, served at /new/ — no inline CSS/JS
├── demo.html                   # Embedded interactive product demo markup, served at /new/demo.html — no inline CSS/JS
├── assets/
│   ├── css/
│   │   ├── site.css            # Landing page: theme tokens (dawn/dusk/paper) + component classes
│   │   └── demo.css            # Embedded demo: its own fixed dashboard design language
│   ├── js/
│   │   ├── site.js             # Landing page behavior: Theme, Faq, HeroEmbed, DownloadModal, ConnectModal
│   │   ├── demo.js             # Embedded demo state machine + render pipeline
│   │   └── analytics.js        # PostHog snippet — same project/key as ../../index.html, loaded eagerly in <head>
│   └── images/
│       └── meridian-mark.png   # Official logo (copied from meridian/ui/app/icon.png)
├── favicon.ico / favicon-512.png / apple-touch-icon.png   # Generated from meridian-mark.png
├── tests/
│   └── responsive.test.js      # Structural + responsiveness test suite for THIS site only
└── CLAUDE.md                    # This file

../worker.js, ../wrangler.jsonc  # Shared with the old site — not duplicated here
```

## Development Workflow

### Making changes to content/styling

1. Edit markup in `index.html`/`demo.html`, styles in `assets/css/site.css`/`assets/css/demo.css`, and behavior in `assets/js/site.js`/`assets/js/demo.js`. Don't add inline `<style>`/`<script>` blocks back — the test suite fails the build if it finds any.
2. Prefer reusing or extending an existing component class (`.feature-card`, `.modal-*`, `.faq-item__*`, ...) over adding new one-off inline styles. If a pattern repeats 2+ times, promote it to a class.
3. Run `node tests/responsive.test.js` to catch regressions (missing sections, broken worker.js contract, unbalanced tags).
4. Preview with `wrangler dev` before deploying.

### Common tasks

**Adding a new landing-page section:**
- Add the `<section>` in `index.html` using existing classes from `assets/css/site.css` (`.section`, `.section__inner`, `.card-grid`, `.eyebrow`, `.section-title`, etc.) — add new component classes to `site.css` following the existing `.block__element--modifier` naming, not new inline styles.
- If it needs interactivity, add a small named module to `assets/js/site.js` (see `Faq`/`DownloadModal`/`ConnectModal` for the shape: an object with `init()`, its own render function, and event handlers), following the render-on-state-change pattern.

**Changing the interactive demo:**
- All state lives in the `state` object in `assets/js/demo.js`; `render()` re-renders the affected DOM regions after every mutation. Follow the existing `renderToolbar/renderTimeline/renderPanel/renderFloating/renderReview` split rather than a single monolithic re-render. Add new component classes to `assets/css/demo.css`.

**Changing colors/typography:**
- Theme colors are CSS custom properties on `body` / `body[data-theme="dusk"]` / `body[data-theme="paper"]` in `assets/css/site.css`. Never hardcode a theme-sensitive color inline — use `var(--acc)`, `var(--card)`, etc. The embedded demo (`assets/css/demo.css`) is a fixed light dashboard mock and intentionally does not use these tokens.

## Known Issues & Patterns

### worker.js's `<title>`/description rewrite

`worker.js` fetches `env.ASSETS` for `/` and does a regex replace on `<title>[^<]*</title>` and `<meta name="description"[^>]*>` for `/writing/*` essay routes, then injects a `<link rel="canonical">` before `</head>`. Keep exactly one of each tag in `index.html`, and keep `</head>` unique — the test suite enforces this.

### Fluid responsiveness, not media queries

Unlike the old bundler-era site, this design intentionally has no `@media (max-width: 768px)` breakpoints — layout is fluid via `clamp()` and `auto-fit` grids. If you add a component that doesn't reflow well at narrow widths, prefer fixing it with fluid sizing over bolting on a breakpoint, to stay consistent with the rest of the page.

### Mobile Nav

There's no hamburger menu; the nav is deliberately minimal (4 items) so it stays inline down to small viewports. If nav items grow, revisit this.

## Git & Deployment Notes

> **HARD RULE: Never push directly to `main` or any other default/protected branch. Always create a feature branch, commit there, and open a pull request. No exceptions.**

- `.wrangler` and `.dev.vars*` are ignored (Cloudflare build artifacts)
- `.env*` files are ignored (never commit secrets)
- Use `.env.example` for documenting required environment variables
- Deploy only after tests pass: `node tests/responsive.test.js && wrangler deploy`

## Browser Support

- **Modern browsers** (Chrome, Firefox, Safari, Edge) — primary target
- `animation-timeline: view()` (scroll-reveal on `[data-rv]` elements) degrades gracefully to "visible immediately" on browsers without support (the `animation` still runs once on load).
- **Mobile**: fluid layout tested down to ~360px viewport width.

## Performance & Observability

- Cloudflare observability is enabled (`observability.enabled: true` in `wrangler.jsonc`)
- PostHog captures `app_download` server-side (via `/dl`) and `download_page_viewed`/`waitlist_signup` client-side (via `/download`)
- Resend stores waitlist/download-modal emails via `/subscribe`
