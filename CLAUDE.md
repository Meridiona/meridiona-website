# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Meridiona** is a Cloudflare Workers-hosted static website. It showcases "An AI that knows your company" with a focus on mobile responsiveness and an interactive product demo embedded in the hero. The site is plain, framework-free static HTML/CSS/JS with no build step and no bundler — what's in git is what's deployed.

- **Type**: Static website, Cloudflare Workers + Cloudflare Pages assets
- **Language**: HTML, CSS, JavaScript (vanilla, no framework, no build step)
- **Entry points**: `index.html` (the landing page), `demo.html` (the interactive product demo embedded in the hero)
- **Deployment**: Cloudflare Workers (via `wrangler deploy`)
- **Tests**: `tests/responsive.test.js` (structural + responsiveness checks) and `tests/auth-relay.test.js` (Google-SSO relay unit tests)

## Architecture

### Two plain HTML files, no bundler, externalized CSS/JS

`index.html` and `demo.html` are ordinary static HTML with **zero inline `<style>`/`<script>` blocks** — all CSS and JS live under `assets/` as separate, cacheable, reusable files.

- **`index.html`** — the landing page markup only: nav, hero, "Why" section, testimonials/FAQ/footer, download modal, social-connect modal, and the theme-switcher widget. Styled by `assets/css/site.css`, driven by `assets/js/site.js`.
- **`writing/`** — the essays section. `writing/index.html` is the essay list (served at `/writing`); each essay is a flat file (`writing/<slug>.html`, served extensionless at `/writing/<slug>` by the ASSETS binding's default html handling). All pages share `site.css` (tokens, nav, footer, modals) plus `assets/css/writing.css` (the reading experience: `.prose`, `.entry`, `.article-head__*`). Essay body copy is set in **Newsreader** (loaded only on writing pages); headings stay Space Grotesk, metadata JetBrains Mono.
- **`demo.html`** — the markup shell for a self-contained interactive recreation of the Meridian app (daily timeline, insights panel, swipe-to-approve/dismiss review modal, capture/Jira toggles, reset). Styled by `assets/css/demo.css`, driven by `assets/js/demo.js`. Embedded in the landing hero via a fixed-resolution (1240×720) `<iframe>` that `assets/js/site.js`'s `HeroEmbed` module scales with `transform: scale(...)` to fit the viewport.
- **`assets/css/site.css`** — design tokens (3 themes: dawn/dusk/paper, as CSS custom properties on `body`/`body[data-theme=...]`) plus every landing-page component class (`.nav__*`, `.hero__*`, `.feature-card`, `.faq-item__*`, `.modal-*`, `.connect-row--*`, `.theme-dot`, etc.).
- **`assets/js/site.js`** — landing-page behavior, split into small modules (`Theme`, `Faq`, `HeroEmbed`, `DownloadModal`, `ConnectModal`), each owning one piece of UI state and re-rendering only its own DOM region.
- **`assets/css/demo.css`** / **`assets/js/demo.js`** — the embedded demo's own design language (Plus Jakarta Sans, fixed-resolution dashboard chrome) and its state machine (`state` + `render()` → `renderToolbar/renderTimeline/renderPanel/renderFloating/renderReview`).
- **`worker.js`** — Cloudflare Worker handling the Google-SSO relay for the Meridian desktop app (isolated by the `auth.meridiona.com` hostname), `/dl` (redirect to the latest GitHub release + PostHog attribution), `/download` (interstitial page with waitlist opt-in), `/subscribe` (Resend audience signup, called from `assets/js/site.js`'s download modal and the `/download` page), and per-path `<title>`/description rewriting for `/writing/*` essay pages (via `env.ASSETS.fetch` + string replace — this is why `index.html` must keep exactly one `<title>` and one `<meta name="description">` tag).

### Key design decisions

- **No bundler, no build step**: what's in git is what's deployed. Simpler to review, edit, and reason about than a base64/gzip manifest.
- **Externalized, component-classed CSS/JS**: no inline `style="..."` soup or per-page `<script>` blocks — structure lives in HTML, presentation in `assets/css/*.css` (BEM-ish component classes), behavior in `assets/js/*.js` (small named modules, each rendering its own DOM region).
- **Fluid layout, not breakpoints**: responsiveness comes from `clamp()` type sizing and `repeat(auto-fit,minmax(...))` grids, so sections reflow continuously rather than snapping at fixed breakpoints. There's no hamburger nav — the nav is compact enough to stay inline at all widths tested.
- **iframe-embedded demo, not inlined markup**: keeping `demo.html` as a separate document (rather than inlining its DOM into `index.html`) keeps its own event handling and CSS self-contained. It intentionally has its own design language (Plus Jakarta Sans, fixed dashboard colors) rather than sharing `site.css`'s theme tokens — it's a mock of the *product*, not the marketing site.

## Commands

### Run Tests

```bash
node tests/responsive.test.js
node tests/auth-relay.test.js
```

Or both via `npm test`.

`responsive.test.js` validates: viewport meta tags, worker.js compatibility (title/description/`</head>` regex targets, `/subscribe` + `/dl` wiring), all three themes present, key sections present (nav, hero, why, faq, footer, both modals, theme switcher), fluid-responsive patterns (`clamp()`, `auto-fit/minmax`), the embedded demo's interactive affordances, balanced `<script>`/`<style>` tags, and the writing section's structure/links.

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
node tests/responsive.test.js && node tests/auth-relay.test.js && wrangler deploy
```

Deploys the whole repo to Cloudflare via the Cloudflare Workers CLI. The `wrangler.jsonc` config specifies:
- `compatibility_date: 2026-05-21`
- `compatibility_flags: ["nodejs_compat"]`
- `observability: enabled` (sends metrics to Cloudflare analytics)
- `assets.directory: "."` — the ASSETS binding serves the whole repo root as static files
- the `auth.meridiona.com` custom-domain route for the Google-SSO relay

## File Structure

```
.
├── index.html              # Landing page markup, served at / — no inline CSS/JS
├── demo.html                # Embedded interactive product demo markup, served at /demo.html — no inline CSS/JS
├── assets/
│   ├── css/
│   │   ├── site.css          # Landing page: theme tokens (dawn/dusk/paper) + component classes
│   │   ├── demo.css          # Embedded demo: its own fixed dashboard design language
│   │   └── writing.css       # Essay reading experience
│   ├── js/
│   │   ├── site.js           # Landing page behavior: Theme, Faq, HeroEmbed, DownloadModal, ConnectModal
│   │   ├── demo.js           # Embedded demo state machine + render pipeline
│   │   └── analytics.js      # PostHog snippet, loaded eagerly in <head>
│   └── images/
│       └── meridian-mark.png # Official logo
├── writing/
│   ├── index.html            # Essay list, served at /writing
│   └── <slug>.html           # Individual essays, served at /writing/<slug>
├── worker.js               # Cloudflare Worker: Google-SSO relay, /dl, /download, /subscribe, writing-page meta rewriting
├── wrangler.jsonc          # Cloudflare Workers configuration
├── favicon.ico / favicon-512.png / apple-touch-icon.png
├── robots.txt / sitemap.xml
├── tests/
│   ├── responsive.test.js  # Structural + responsiveness test suite
│   └── auth-relay.test.js  # Google-SSO relay unit tests
├── .gitignore
└── CLAUDE.md               # This file
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

**Adding a new essay:**
- Copy an existing essay file (e.g. `writing/velocity-visibility.html`) to `writing/<new-slug>.html`; replace the `<title>`, description, `.article-head` block, and the `.prose` body. Available prose building blocks (all in `assets/css/writing.css`): `.prose__lede` opener, `h2` with a `<span class="sec-index">§ 0N</span>` marker, `ul` (accent-dot bullets), `blockquote` (pull quote), `pre>code` / inline `code`, `.findings` (numbered key-findings card), `.prose__coda` closing lines.
- Add an `.entry` block for it at the top of `writing/index.html` (move the `entry__stamp-new` "Latest" badge to it) and update the essay count in `.writing-more`.
- The test suite automatically picks up every `writing/*.html` file and checks its structure and that the index links to it.

**Changing the interactive demo:**
- All state lives in the `state` object in `assets/js/demo.js`; `render()` re-renders the affected DOM regions after every mutation. Follow the existing `renderToolbar/renderTimeline/renderPanel/renderFloating/renderReview` split rather than a single monolithic re-render. Add new component classes to `assets/css/demo.css`.

**Changing colors/typography:**
- Theme colors are CSS custom properties on `body` / `body[data-theme="dusk"]` / `body[data-theme="paper"]` in `assets/css/site.css`. Never hardcode a theme-sensitive color inline — use `var(--acc)`, `var(--card)`, etc. The embedded demo (`assets/css/demo.css`) is a fixed light dashboard mock and intentionally does not use these tokens.

## Known Issues & Patterns

### worker.js's `<title>`/description rewrite

`worker.js` fetches `env.ASSETS` for `/` and does a regex replace on `<title>[^<]*</title>` and `<meta name="description"[^>]*>` for `/writing/*` essay routes, then injects a `<link rel="canonical">` before `</head>`. Keep exactly one of each tag in `index.html`, and keep `</head>` unique — the test suite enforces this.

### Fluid first, breakpoints where fluid can't reach

Default to fluid sizing — `clamp()` type and `repeat(auto-fit,minmax(...))` grids — so sections reflow continuously; that's still the bulk of the layout. But a few things genuinely can't be made responsive with sizing alone, and those have explicit mobile `@media` breakpoints (the demo/why/spacing rules are grouped at the bottom of `site.css`; the nav has its own at 760/560px; breakpoints used across the file are 760/640/560px):

- **The hero product demo** is a fixed 1240×720 canvas scaled with a transform (`HeroEmbed` in `site.js`); at phone widths that scale is illegible. So ≤640px the inline embed becomes a **tap target** (`#demo-open`) that opens the demo full screen in landscape via the `DemoFullscreen` module — rotated 90° when the phone is portrait. `HeroEmbed.size()` measures the hero's real inner width (not a hardcoded reservation) so the matted frame never clips under `overflow-x:hidden`.
- **The "why" scroll-jacked stage** pins a fixed-height viewport and can't fit a tall panel on a short phone screen, so `WhyScroll.init()` skips the pin ≤760px (`MOBILE_MAX`) and the panels fall back to the plain stacked `.scrolly:not(.is-ready)` layout.
- **`.worklog-flow`** (a wide non-wrapping row) stacks ≤760px.

When you add a component, still prefer fluid sizing first; only reach for a breakpoint when a component structurally can't reflow (fixed-resolution embed, pinned stage, wide non-wrapping row). Keep the JS width gates (`WhyScroll.MOBILE_MAX`, the `.demo-open` 640px rule) in sync with the CSS breakpoints if you move them.

### Mobile Nav

There's no hamburger menu; the nav is deliberately minimal (4 items) so it stays inline down to small viewports. If nav items grow, revisit this.

## Git & Deployment Notes

> **HARD RULE: Never push directly to `main` or any other default/protected branch. Always create a feature branch, commit there, and open a pull request. No exceptions.**

- `.wrangler` and `.dev.vars*` are ignored (Cloudflare build artifacts)
- `.env*` files are ignored (never commit secrets)
- Use `.env.example` for documenting required environment variables
- Deploy only after tests pass: `node tests/responsive.test.js && node tests/auth-relay.test.js && wrangler deploy`

## Browser Support

- **Modern browsers** (Chrome, Firefox, Safari, Edge) — primary target
- `animation-timeline: view()` (scroll-reveal on `[data-rv]` elements) degrades gracefully to "visible immediately" on browsers without support (the `animation` still runs once on load).
- **Mobile**: fluid layout tested down to ~360px viewport width.

## Performance & Observability

- Cloudflare observability is enabled (`observability.enabled: true` in `wrangler.jsonc`)
- Metrics are sent to Cloudflare's analytics dashboard
- PostHog captures `app_download` server-side (via `/dl`) and `download_page_viewed`/`waitlist_signup` client-side (via `/download`)
- Resend stores waitlist/download-modal emails via `/subscribe`; a `source: 'download'` signup also gets a short, personal welcome email (`sendDownloadWelcomeEmail` in `worker.js`), sent via `ctx.waitUntil` so it never blocks the signup response
