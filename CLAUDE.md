# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Meridiona** is a Cloudflare Workers-hosted static website. It's a single-page application bundled into a single `index.html` file with embedded JavaScript, CSS, and assets. The site showcases "An AI that knows your company" with a focus on mobile responsiveness and a sophisticated loading experience.

- **Type**: Static website, Cloudflare Workers + Cloudflare Pages
- **Language**: HTML, CSS, JavaScript (vanilla, no framework)
- **Entry Point**: `index.html` (fully bundled)
- **Deployment**: Cloudflare Workers (via `wrangler deploy`)
- **Tests**: Custom test harness (responsive design tests)

## Architecture

### The Custom Bundler System

The site uses a custom bundler that packages the entire application into a single HTML file:

1. **Manifest (`<script type="__bundler/manifest">`)**: Contains base64-encoded, optionally gzip-compressed asset data (images, CSS bundles, etc.). Indexed by UUID.

2. **Template (`<script type="__bundler/template">`)**: The actual HTML/CSS content that gets rendered into the DOM. This is the core page markup.

3. **Runtime (`index.html`)**: On page load, JavaScript in `index.html` unpacks the manifest, decompresses assets, and injects the template into the DOM. There's also a "thumbnail" loading state shown before the full template renders.

### Key Design Decisions

- **Single HTML file**: Simplifies deployment and caching. The entire site fits in one request.
- **Lazy unpack**: Assets are decompressed on the client using the `DecompressionStream` API (with a fallback to `pako` for older browsers).
- **Bundler error overlay**: A red error box in the bottom-left corner (styled with `display:fixed; background:#2a1215; color:#ff8a80`) shows unpack errors. This overlay is suppressed after the template is injected into the DOM so that third-party scripts (e.g., Cloudflare beacon) don't pollute the error log.

## Commands

### Run Tests

```bash
node tests/responsive.test.js
```

Tests validate:
- Viewport meta tag is present (required for mobile scaling)
- Media queries exist at 768px and 480px breakpoints
- Grid layouts collapse to single/dual columns on mobile
- Mobile navigation (hamburger menu) is properly hidden/shown
- CTA form stacks vertically on mobile
- JSON encoding is safe (no unescaped `</script>` tags that break parsing)

**Exit code**: 0 on success, 1 if any test fails.

### Deploy to Cloudflare

```bash
wrangler deploy
```

Deploys `index.html` to Cloudflare Pages via the Cloudflare Workers CLI. The `wrangler.jsonc` config specifies:
- `compatibility_date: 2026-05-21`
- `compatibility_flags: ["nodejs_compat"]`
- `observability: enabled` (sends metrics to Cloudflare analytics)

## File Structure

```
.
├── index.html              # Main bundled application (entry point)
├── wrangler.jsonc          # Cloudflare Workers configuration
├── tests/
│   └── responsive.test.js  # Mobile responsiveness test suite
├── .gitignore
└── CLAUDE.md               # This file
```

## Development Workflow

### Making Changes to Content/Styling

1. Edit the `index.html` file directly. The template is embedded in the `<script type="__bundler/template">` tag as a JSON string.
2. If you add assets (images, fonts), encode them as base64 and add to the manifest with a UUID.
3. Run tests to verify responsive design: `node tests/responsive.test.js`
4. Deploy: `wrangler deploy`

### Common Tasks

**Adding a new HTML section:**
- Locate the template in `index.html` (search for `<script type="__bundler/template">`)
- Edit the HTML/CSS inside the JSON string
- Ensure responsive classes are applied (e.g., `@media (max-width: 768px)`)
- Run tests to check for regressions

**Fixing mobile layout issues:**
- Check the media query at 768px or 480px in the template
- Adjust grid columns (`.grid-cols-N`) or flex properties (`.cta-form`)
- Run tests to ensure the fix is captured: `node tests/responsive.test.js`

**Changing colors or typography:**
- Colors and fonts are defined inline in the `<style>` block within the template
- Update the CSS inside the template JSON string
- No separate CSS files — all styling is embedded

## Known Issues & Patterns

### Bundler Error Overlay
- The error overlay is automatically hidden after the template is successfully injected into the DOM
- This prevents noise from third-party scripts (Cloudflare beacon, analytics)
- If you see persistent errors, check the bundler manifest for corruption

### JSON Encoding in HTML
- The template is stored as a JSON string inside `<script type="__bundler/template">`
- Do not include unescaped `</script>` tags in the JSON (the HTML parser will prematurely close the script tag)
- The test suite validates this: `no unescaped </script> in raw JSON`

### Mobile Breakpoints
- **768px**: Tablet/mobile threshold — grids collapse, nav becomes hamburger
- **480px**: Small phone threshold — further grid reductions, text scaling
- Both breakpoints are tested automatically

## Git & Deployment Notes

> **HARD RULE: Never push directly to `main` or any other default/protected branch. Always create a feature branch, commit there, and open a pull request. No exceptions.**

- `.wrangler` and `.dev.vars*` are ignored (Cloudflare build artifacts)
- `.env*` files are ignored (never commit secrets)
- Use `.env.example` for documenting required environment variables
- Deploy only after tests pass: `node tests/responsive.test.js && wrangler deploy`

## Browser Support

- **Modern browsers** (Chrome, Firefox, Safari, Edge) — primary target
- **Fallback decompression**: `DecompressionStream` is used if available; `pako` library can be added as fallback
- **Mobile**: Full responsive support down to 480px viewport width

## Performance & Observability

- Cloudflare observability is enabled (`observability.enabled: true` in `wrangler.jsonc`)
- Metrics are sent to Cloudflare's analytics dashboard
- The single-file bundle ensures caching works efficiently (one long-lived HTTP request)
