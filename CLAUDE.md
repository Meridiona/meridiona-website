# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Meridiona** is a Cloudflare Workers-hosted static website. It showcases "An AI that knows your company" with a focus on mobile responsiveness and an interactive product demo embedded in the hero. The site is plain, framework-free static HTML/CSS/JS with no build step and no bundler — what's in git is what's deployed.

- **Type**: Static website, Cloudflare Workers + Cloudflare Pages assets
- **Language**: HTML, CSS, JavaScript (vanilla, no framework, no build step)
- **Entry points**: `index.html` (the landing page), `demo.html` (the interactive product demo embedded in the hero)
- **Deployment**: Cloudflare Workers (via `wrangler deploy`)
- **Tests**: `tests/responsive.test.js` (structural + responsiveness checks), `tests/auth-relay.test.js` (Google-SSO relay unit tests) and `tests/waitlist.test.js` (/waitlist validation + Resend payload, against a stubbed fetch)

## Architecture

### Two plain HTML files, no bundler, externalized CSS/JS

`index.html` and `demo.html` are ordinary static HTML with **zero inline `<style>`/`<script>` blocks** — all CSS and JS live under `assets/` as separate, cacheable, reusable files.

- **`index.html`** — the landing page markup only: nav, hero, "Why" section, testimonials/FAQ/footer, download modal, social-connect modal, and the theme-switcher widget. Styled by `assets/css/site.css`, driven by `assets/js/site.js`.
- **`writing/`** — the essays section. `writing/index.html` is the essay list (served at `/writing`); each essay is a flat file (`writing/<slug>.html`, served extensionless at `/writing/<slug>` by the ASSETS binding's default html handling). All pages share `site.css` (tokens, nav, footer, modals) plus `assets/css/writing.css` (the reading experience: `.prose`, `.entry`, `.article-head__*`). Essay body copy is set in **Newsreader** (loaded only on writing pages); headings stay Space Grotesk, metadata JetBrains Mono.
- **`demo.html`** — the markup shell for a self-contained interactive recreation of the Meridian app (daily timeline, insights panel, swipe-to-approve/dismiss review modal, capture/Jira toggles, reset). Styled by `assets/css/demo.css`, driven by `assets/js/demo.js`. Embedded in the landing hero via a fixed-resolution (1240×720) `<iframe>` that `assets/js/site.js`'s `HeroEmbed` module scales with `transform: scale(...)` to fit the viewport.
- **`assets/css/site.css`** — design tokens (3 themes: dawn/dusk/paper, as CSS custom properties on `body`/`body[data-theme=...]`) plus every landing-page component class (`.nav__*`, `.hero__*`, `.feature-card`, `.faq-item__*`, `.modal-*`, `.connect-row--*`, `.theme-dot`, etc.).
- **`assets/js/site.js`** — landing-page behavior, split into small modules (`Theme`, `Faq`, `HeroEmbed`, `DownloadModal`, `ConnectModal`), each owning one piece of UI state and re-rendering only its own DOM region.
- **`assets/css/demo.css`** / **`assets/js/demo.js`** — the embedded demo's own design language (Plus Jakarta Sans, fixed-resolution dashboard chrome) and its state machine (`state` + `render()` → `renderToolbar/renderTimeline/renderPanel/renderFloating/renderReview`).
- **`worker.js`** — Cloudflare Worker handling the Google-SSO relay for the Meridian desktop app (isolated by the `auth.meridiona.com` hostname), `/dl` (redirect to the latest GitHub release + PostHog attribution), `/download` (interstitial page with waitlist opt-in), `/subscribe` (Resend audience signup, called from `assets/js/site.js`'s download modal and the `/download` page), `/waitlist` (the product-waitlist form above the footer — see below), and per-path `<title>`/description rewriting for `/writing/*` essay pages (via `env.ASSETS.fetch` + string replace — this is why `index.html` must keep exactly one `<title>` and one `<meta name="description">` tag).

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
node tests/waitlist.test.js
```

Or all three via `npm test`.

`responsive.test.js` validates: viewport meta tags, worker.js compatibility (title/description/`</head>` regex targets, `/subscribe` + `/waitlist` + `/dl` wiring), all three themes present, key sections present (nav, hero, why, faq, footer, all three modals, waitlist CTA, theme switcher), fluid-responsive patterns (`clamp()`, `auto-fit/minmax`), the embedded demo's interactive affordances, balanced `<script>`/`<style>` tags, and the writing section's structure/links.

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
node tests/responsive.test.js && node tests/auth-relay.test.js && node tests/waitlist.test.js && wrangler deploy
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
├── _headers                # Response headers for statically-served assets (mirrors worker.js's withSecurityHeaders)
├── wrangler.jsonc          # Cloudflare Workers configuration
├── favicon.ico / favicon-512.png / apple-touch-icon.png
├── robots.txt / sitemap.xml
├── tests/
│   ├── responsive.test.js  # Structural + responsiveness test suite
│   ├── auth-relay.test.js  # Google-SSO relay unit tests
│   └── waitlist.test.js    # /waitlist + /subscribe: validation, Resend payload (stubbed fetch)
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

## Public endpoints - hard rule

**Anything publicly reachable that spends money or calls an upstream ships with an
origin check, a per-IP rate limit, and - if it is not a browser form - a shared
secret. No exceptions, and it is not optional follow-up work.**

This rule is written in blood. `hf.meridiona.com` was a Cloudflare Worker that
reverse-proxied huggingface.co so first-run model downloads would cache at the
edge. It was carefully written: its header carried a `SECURITY:` block reasoning
about cache-key poisoning and about never letting an `Authorization` header reach
a shared cache. What it never asked was *who is allowed to call this*. It had no
auth, no path allowlist, and no rate limit.

Then the MLX stack that used it was deleted, and it sat there with no callers, no
owner, and a public DNS record. Cloudflare had published its hostname to the
Certificate Transparency logs the moment it provisioned the TLS certificate, which
is a public, append-only feed that scanners harvest continuously. Someone found an
open HuggingFace mirror with a one-year cache TTL and used it:

| | requests/day |
|---|---|
| Aug 15 | 17,260 |
| Aug 22 | 128,887 |
| Aug 23 | **173,088** |

The free-plan Workers cap is **account-wide**, so this site - which used 5,699
requests that day - went down with Cloudflare Error 1027 for traffic it did not
generate. Meridian's own users could not have accounted for any of it; nothing in
the app ever called that host.

Three habits come out of it:

1. **Assume every hostname you provision is public knowledge immediately.** CT
   logs mean an unadvertised subdomain is not a secret, ever.
2. **Delete infrastructure when its caller dies.** The proxy was harmless while
   the MLX server used it and dangerous the day that was removed. A component with
   no caller in the repo gets deleted, not left running.
3. **Alert on what you cannot see.** Traffic 6x'd over six days in plain sight
   with zero notification policies on the account. The first signal was an outage.

The implementation of this rule for `/subscribe` and `/waitlist` is
`guardPublicPost` in `worker.js`, covered by `tests/rate-limit.test.js`. Read the
comment above it before changing the ceilings: it fails open by design, and it
deliberately stops writing to KV once an IP is over its limit, because the free
plan allows only 1,000 KV writes a day and a limiter that spends one per hostile
request is itself a denial of service.

A per-IP KV counter is a damper, not a boundary - KV is eventually consistent and
a distributed caller walks through it. The hard cap belongs in a zone
rate-limiting rule in the Cloudflare dashboard.

## Known Issues & Patterns

### worker.js's `<title>`/description rewrite

`worker.js` fetches `env.ASSETS` for `/` and does a regex replace on `<title>[^<]*</title>` and `<meta name="description"[^>]*>` for `/writing/*` essay routes, then injects a `<link rel="canonical">` before `</head>`. Keep exactly one of each tag in `index.html`, and keep `</head>` unique — the test suite enforces this.

### The waitlist form stores fields as Resend Contact Properties

`POST /waitlist` (the "Join the waitlist" section above the footer) collects name, profession, email, phone, LinkedIn and an optional free-text comment. Resend's Nov-2025 contacts release added real **Contact Properties**, so the extra fields go in `properties` rather than being smuggled through `first_name`/`last_name` the way `/subscribe` used to do with phone/OS — both routes now use properties.

**Properties must be registered once before they can be set**; unregistered keys are rejected outright. This is ordering-critical, not just a prerequisite for the new route: if it hasn't been done, `resendContact()` strips `properties` and `/subscribe` silently stops capturing OS and phone — data it *does* capture today via the old hack. Run for each of `profession`, `profession_other`, `phone`, `linkedin`, `comment`, `signup_source`, `os` (the list is `WAITLIST_PROPERTIES` in `worker.js`):

```bash
curl -X POST https://api.resend.com/contact-properties \
  -H "Authorization: Bearer $RESEND_API_KEY" -H 'Content-Type: application/json' \
  -d '{"key":"profession","type":"string"}'
```

If they're missing, `resendContact()` logs loudly and retries without properties so the email address is still captured rather than the signup being dropped.

Two other things this route depends on:
- `RESEND_AUDIENCE_ID_PRODUCT_WAITLIST` (a `wrangler secret put` value) — falls back to `RESEND_AUDIENCE_ID`. Keep it distinct from `RESEND_AUDIENCE_ID_WAITLIST`, which means "waiting on an unreleased OS", not this.
- A Resend-**verified sending domain** for `WAITLIST_NOTIFY_FROM`, or the per-signup notification to `WAITLIST_NOTIFY_TO` 403s. The signup still succeeds on the contact write alone; only losing *both* is reported to the user.

Contacts are global by email address, so the same person signing up here and via the download modal is one contact — which is why neither route puts non-name data in the name fields any more.

### `run_worker_first` is an allowlist, and `_headers` is its other half

`assets.run_worker_first` in `wrangler.jsonc` **must stay a path array — never `true`.** `true` invokes `worker.js` for every request, including all ~25 subresources of one landing-page view (CSS, JS, fonts, client logos, favicons, the `/demo` iframe and its own assets). Each is a billable Worker invocation against the Workers Free plan's 100,000 requests/day limit, which is **account-wide** and shared with every other Worker. Requests served straight off the static-asset store are free and unlimited.

For the record, since the incident that prompted this is easy to misattribute: the 429s on 2026-08-23 were **not** caused by this setting. Measured from the Workers analytics API that day, `meridiona-website` served **5,699** requests and `meridian-hf-proxy` served **173,088** - 96.8% of the account total of 178,787. The site was taken down by a sibling Worker, not by its own assets. What this setting did was leave the site with a ~4,000-page-view ceiling it had no reason to have; removing that is headroom for the day real traffic arrives, not the fix for that outage. See "Public endpoints - hard rule" above for what actually happened.

Only paths that genuinely need Worker logic belong in the array (`/dl`, `/download`, `/subscribe`, `/waitlist`, `/writing`, `/writing/*`, `/auth/*`, `/webhooks/*`). **`/` must stay out** — `worker.js` does nothing for it but fall through to `env.ASSETS.fetch()`, and excluding it is the single biggest saving.

The consequence, and the reason `true` was originally set: assets served this way skip `withSecurityHeaders()`. The same baseline (HSTS, CSP, `X-Frame-Options`, nosniff, referrer, permissions) is therefore restated in the **`_headers`** file at the repo root, which applies *only* to statically-served assets — Worker-generated responses still get theirs from `withSecurityHeaders()`. **Change one, change the other.** The `_headers` CSP mirrors the strict branch (no `'unsafe-inline'` in `script-src`), which holds because the static pages carry no inline `<script>` — a property `tests/responsive.test.js` enforces.

Two things to know when adding a route:

- If it needs Worker logic, add it to the array or it will silently serve a static asset (or a 404) instead. Allowlisted paths win even for navigation requests, despite `assets_navigation_prefers_asset_serving` being active at this `compatibility_date` — verified, but re-check with `curl -H 'Sec-Fetch-Mode: navigate'` if you add an HTML-returning route with no matching asset file (`/download` is the existing example).
- Host-based logic can't live in the array — patterns are path-only. The `www.meridiona.com` → apex 301 in `worker.js` no longer fires for asset paths; a zone-level Cloudflare redirect rule handles it (it executes before Workers). `auth.meridiona.com/` consequently serves the marketing site rather than the Worker's 404, though `/auth/*` and `/webhooks/*` still route correctly.

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
- Deploy only after tests pass: `node tests/responsive.test.js && node tests/auth-relay.test.js && node tests/waitlist.test.js && wrangler deploy`

## Browser Support

- **Modern browsers** (Chrome, Firefox, Safari, Edge) — primary target
- `animation-timeline: view()` (scroll-reveal on `[data-rv]` elements) degrades gracefully to "visible immediately" on browsers without support (the `animation` still runs once on load).
- **Mobile**: fluid layout tested down to ~360px viewport width.

## Performance & Observability

- Cloudflare observability is enabled (`observability.enabled: true` in `wrangler.jsonc`)
- Metrics are sent to Cloudflare's analytics dashboard
- PostHog captures `app_download` server-side (via `/dl`) and `download_page_viewed`/`waitlist_signup` client-side (via `/download`)
- Resend stores waitlist/download-modal emails via `/subscribe`
