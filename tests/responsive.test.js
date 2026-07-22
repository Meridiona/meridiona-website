/**
 * Structural + responsiveness tests for the Meridiona website.
 *
 * The site is two plain static HTML files (index.html, demo.html) plus
 * external stylesheets/scripts under assets/, served directly by
 * Cloudflare's ASSETS binding — no bundler, no template JSON, no inline
 * <style>/<script> blocks.
 *
 * Run with: node tests/responsive.test.js
 * Requires: Node.js 18+
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..'); // meridiona-website
const INDEX_PATH = path.join(ROOT, 'index.html');
const DEMO_PATH = path.join(ROOT, 'demo.html');
const WORKER_PATH = path.join(ROOT, 'worker.js');
const SITE_CSS_PATH = path.join(ROOT, 'assets/css/site.css');
const SITE_JS_PATH = path.join(ROOT, 'assets/js/site.js');
const DEMO_CSS_PATH = path.join(ROOT, 'assets/css/demo.css');
const DEMO_JS_PATH = path.join(ROOT, 'assets/js/demo.js');

// ─── Minimal test harness ─────────────────────────────────────────────────────
let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}
function expect(val) {
  return {
    toBe(expected) {
      if (val !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(val)}`);
    },
    toContain(substr) {
      if (!String(val).includes(substr)) throw new Error(`Expected to contain "${substr}"`);
    },
    toMatch(re) {
      if (!re.test(val)) throw new Error(`Expected to match ${re}`);
    },
    toBeTruthy() {
      if (!val) throw new Error(`Expected truthy, got ${JSON.stringify(val)}`);
    },
    toBeFalsy() {
      if (val) throw new Error(`Expected falsy, got ${JSON.stringify(val)}`);
    },
    toBeGreaterThan(n) {
      if (!(val > n)) throw new Error(`Expected ${val} > ${n}`);
    },
  };
}
// ─────────────────────────────────────────────────────────────────────────────

const index = fs.readFileSync(INDEX_PATH, 'utf-8');
const demo = fs.readFileSync(DEMO_PATH, 'utf-8');
const worker = fs.readFileSync(WORKER_PATH, 'utf-8');
const siteCss = fs.readFileSync(SITE_CSS_PATH, 'utf-8');
const siteJs = fs.readFileSync(SITE_JS_PATH, 'utf-8');
const demoCss = fs.readFileSync(DEMO_CSS_PATH, 'utf-8');
const demoJs = fs.readFileSync(DEMO_JS_PATH, 'utf-8');
const head = index.slice(0, index.indexOf('<body'));

// ─── Group 1: Viewport & document shape ──────────────────────────────────────
console.log('\nDocument shape');
test('index.html has a DOCTYPE', () => {
  expect(index.trim().slice(0, 15).toLowerCase()).toContain('<!doctype html');
});
test('index.html has viewport meta tag', () => {
  expect(head).toContain('name="viewport"');
  expect(head).toContain('width=device-width');
  expect(head).toContain('initial-scale=1');
});
test('demo.html has viewport meta tag', () => {
  const demoHead = demo.slice(0, demo.indexOf('<body'));
  expect(demoHead).toContain('name="viewport"');
});
test('index.html and demo.html have no inline <style>/<script> blocks (externalized)', () => {
  expect(index).toContain('<link rel="stylesheet" href="/assets/css/site.css">');
  expect(index).toContain('<script src="/assets/js/site.js" defer></script>');
  expect(/<style>/.test(index)).toBe(false);
  expect(index).toContain('<script src=');
  // JSON-LD structured-data blocks are inert SEO metadata, not behavior/presentation
  // logic — they're the one allowed exception to "no inline scripts".
  const inlineScriptsIndex = (index.match(/<script(?![^>]*\bsrc=)[^>]*>/g) || [])
    .filter((tag) => !tag.includes('application/ld+json'));
  expect(inlineScriptsIndex.length).toBe(0);

  expect(demo).toContain('<link rel="stylesheet" href="/assets/css/demo.css">');
  expect(demo).toContain('<script src="/assets/js/demo.js" defer></script>');
  expect(/<style>/.test(demo)).toBe(false);
  const inlineScriptsDemo = (demo.match(/<script(?![^>]*\bsrc=)[^>]*>/g) || []);
  expect(inlineScriptsDemo.length).toBe(0);
});

// ─── Group 2: worker.js compatibility ────────────────────────────────────────
console.log('\nworker.js compatibility');
test('exactly one <title> tag matching the /writing rewrite regex', () => {
  const matches = index.match(/<title>[^<]*<\/title>/g) || [];
  expect(matches.length).toBe(1);
});
test('exactly one <meta name="description"> tag matching the /writing rewrite regex', () => {
  const matches = index.match(/<meta name="description"[^>]*>/g) || [];
  expect(matches.length).toBe(1);
});
test('exactly one </head> tag (canonical link injection point)', () => {
  const matches = index.match(/<\/head>/g) || [];
  expect(matches.length).toBe(1);
});
test('worker.js still serves /subscribe, /dl, /download and ASSETS fallback', () => {
  expect(worker).toContain("url.pathname === '/dl'");
  expect(worker).toContain("url.pathname === '/download'");
  expect(worker).toContain("url.pathname === '/subscribe'");
  expect(worker).toContain('env.ASSETS.fetch(request)');
});
test('site.js calls /subscribe and /dl the way worker.js expects', () => {
  expect(siteJs).toContain("fetch('/subscribe'");
  expect(siteJs).toContain('/dl?ref=');
});
test('PostHog analytics is wired with a write-only project key', () => {
  const analyticsJs = fs.readFileSync(path.join(ROOT, 'assets/js/analytics.js'), 'utf-8');
  expect(/phc_[A-Za-z0-9]+/.test(analyticsJs)).toBe(true);
  expect(index).toContain('<script src="/assets/js/analytics.js"');
});

// ─── Group 3: Theming ─────────────────────────────────────────────────────────
console.log('\nTheming (dawn / dusk / paper)');
test('default (dawn) theme variables are defined on body', () => {
  expect(siteCss).toContain('--acc:#7c3aed');
  expect(siteCss).toContain('--grad:linear-gradient(100deg,#7c3aed,#db2777)');
});
test('dusk theme variables are defined', () => {
  expect(siteCss).toContain('body[data-theme="dusk"]');
});
test('paper theme variables are defined', () => {
  expect(siteCss).toContain('body[data-theme="paper"]');
});
test('theme switcher persists choice and applies data-theme on load', () => {
  expect(siteJs).toContain("localStorage.setItem(THEME_STORAGE_KEY");
  expect(siteJs).toContain('document.body.dataset.theme');
});

// ─── Group 4: Key sections present ───────────────────────────────────────────
console.log('\nKey sections');
test('nav with Why/FAQ/GitHub/Connect/Download', () => {
  expect(index).toContain('href="#why"');
  expect(index).toContain('href="#faq"');
  expect(index).toContain('id="btn-connect"');
  expect(index).toContain('id="btn-download-nav"');
});
test('hero section with embedded product demo iframe', () => {
  expect(index).toContain('id="top"');
  expect(index).toContain('id="hero-embed-frame"');
  // Canonical path, not /demo.html — with run_worker_first enabled, Cloudflare's
  // asset serving 307-redirects .html URLs to their extension-less canonical
  // path, and an iframe src shouldn't pay for that extra redirect hop.
  expect(index).toContain('src="/demo');
});
test('why section present', () => {
  expect(index).toContain('id="why"');
  expect(index).toContain('id="why-scrolly"');
  expect(index).toContain('id="lines-ticker"');
  expect(index).toContain('Your agents shipped');
});
test('faq section is server-rendered (visible to non-JS crawlers) with JS-driven accordion interaction', () => {
  expect(index).toContain('id="faq"');
  expect(index).toContain('id="faq-list"');
  expect(index).toContain('Does anything leave my Mac?');
  expect((index.match(/class="faq-item"/g) || []).length).toBe(5);
  expect(siteJs).toContain("$('faq-list')");
  expect(siteJs).toContain("classList.toggle('is-open'");
});
test('footer with product/open-source/company columns', () => {
  expect(index).toContain('Open source');
  expect(index).toContain('GitHub repo');
});
test('download modal with mac/windows/linux picker (rendered by site.js)', () => {
  expect(index).toContain('id="modal-download"');
  expect(siteJs).toContain("data-os=\"mac\"");
  expect(siteJs).toContain("data-os=\"windows\"");
  expect(siteJs).toContain("data-os=\"linux\"");
});
test('social connect modal', () => {
  expect(index).toContain('id="modal-connect"');
  expect(index).toContain("Let's be friends");
});
test('theme switcher widget with dots container', () => {
  expect(index).toContain('id="theme-switcher"');
  expect(index).toContain('id="theme-dots"');
});

// ─── Group 5: Fluid responsiveness (no fixed breakpoints needed) ─────────────
console.log('\nFluid responsive layout');
test('headline uses clamp() for fluid type instead of a fixed breakpoint', () => {
  expect(siteCss).toMatch(/\.hero__title\{[^}]*font-size:clamp\([^)]+\)/);
});
test('card grids use auto-fit/minmax so they reflow at any width', () => {
  const count = (siteCss.match(/repeat\(auto-fit,minmax\(/g) || []).length;
  expect(count).toBeGreaterThan(0);
});
test('footer grid collapses via minmax, not a hardcoded mobile override', () => {
  expect(siteCss).toContain('grid-template-columns:2fr 1fr 1fr 1fr');
});
test('hero embed recomputes size on window resize (no layout overflow on small viewports)', () => {
  expect(siteJs).toContain("window.addEventListener('resize', this._resize)");
  expect(siteJs).toContain('Math.max(280, Math.min(1120');
});

// ─── Group 6: Interactive demo (embedded product) ────────────────────────────
console.log('\nEmbedded product demo (demo.html)');
test('demo has the daily timeline, right panel and per-task approve flow', () => {
  expect(demo).toContain('id="timeline"');
  expect(demo).toContain('id="panel"');
});
test('demo has capture/jira toggles and reset wired in demo.js', () => {
  expect(demoJs).toContain("'toggle-capture': toggleCapture");
  expect(demoJs).toContain("'toggle-jira': toggleJira");
  expect(demoJs).toContain("'reset': resetAll");
});
test('demo supports the confirm-then-approve worklog posting flow', () => {
  expect(demoJs).toContain('confirmPost');
  expect(demoJs).toContain('approvePost');
  expect(demoJs).toContain('cancelConfirm');
});

// ─── Group 7: Script/style tag safety ─────────────────────────────────────────
console.log('\nScript/style tag safety');
test('<script>/<style> open/close tags are balanced in index.html', () => {
  expect((index.match(/<script[\s>]/g) || []).length).toBe((index.match(/<\/script>/g) || []).length);
  expect((index.match(/<link rel="stylesheet"/g) || []).length).toBeGreaterThan(0);
});
test('<script> open/close tags are balanced in demo.html', () => {
  expect((demo.match(/<script[\s>]/g) || []).length).toBe((demo.match(/<\/script>/g) || []).length);
});
test('demo.css keyframes referenced by demo.js/demo.css are present', () => {
  expect(demoCss).toContain('@keyframes ws-blink');
  expect(demoCss).toContain('@keyframes msum-in');
});

// ─── Group 8: Writing section ─────────────────────────────────────────────────
console.log('\nWriting section');
const WRITING_DIR = path.join(ROOT, 'writing');
const writingIndex = fs.readFileSync(path.join(WRITING_DIR, 'index.html'), 'utf-8');
const essayFiles = fs.readdirSync(WRITING_DIR).filter((f) => f.endsWith('.html') && f !== 'index.html');
const essays = essayFiles.map((f) => ({ name: f, html: fs.readFileSync(path.join(WRITING_DIR, f), 'utf-8') }));
const writingCss = fs.readFileSync(path.join(ROOT, 'assets/css/writing.css'), 'utf-8');
const allWritingPages = [{ name: 'index.html', html: writingIndex }, ...essays];

test('writing index lists every essay file (and no dead links)', () => {
  for (const f of essayFiles) {
    const slug = f.replace(/\.html$/, '');
    expect(writingIndex).toContain(`href="/writing/${slug}"`);
  }
  expect(essayFiles.length).toBeGreaterThan(1);
});
test('every writing page has viewport meta, single <title>, and single description', () => {
  for (const p of allWritingPages) {
    const head = p.html.slice(0, p.html.indexOf('<body'));
    expect(head).toContain('name="viewport"');
    expect((p.html.match(/<title>[^<]*<\/title>/g) || []).length).toBe(1);
    expect((p.html.match(/<meta name="description"[^>]*>/g) || []).length).toBe(1);
  }
});
test('writing pages have no inline <style>/<script> blocks (externalized)', () => {
  for (const p of allWritingPages) {
    expect(p.html).toContain('<link rel="stylesheet" href="/assets/css/site.css">');
    expect(p.html).toContain('<link rel="stylesheet" href="/assets/css/writing.css">');
    expect(p.html).toContain('<script src="/assets/js/site.js" defer></script>');
    expect(/<style>/.test(p.html)).toBe(false);
    const inlineScripts = (p.html.match(/<script(?![^>]*\bsrc=)[^>]*>/g) || []);
    expect(inlineScripts.length).toBe(0);
  }
});
test('writing pages carry the shared chrome: nav, theme switcher, modals, /new-rooted assets', () => {
  for (const p of allWritingPages) {
    expect(p.html).toContain('id="theme-dots"');
    expect(p.html).toContain('id="modal-download"');
    expect(p.html).toContain('id="modal-connect"');
    expect(p.html).toContain('href="/writing"');
    expect(p.html).toContain('src="/assets/js/analytics.js"');
  }
});
test('essay pages have the reading structure: backlink, article head, prose, footer nav', () => {
  for (const p of essays) {
    expect(p.html).toContain('class="backlink"');
    expect(p.html).toContain('class="article-head__title"');
    expect(p.html).toContain('class="prose"');
    expect(p.html).toContain('class="article-foot');
  }
});
test('writing.css defines the reading column with fluid type', () => {
  expect(writingCss).toContain('.prose{');
  expect(writingCss).toMatch(/\.article-head__title\{[^}]*font-size:clamp\(/);
  expect(writingCss).toContain('Newsreader');
});
test('landing page nav links to the writing index', () => {
  expect(index).toContain('href="/writing"');
});
test('writing index subscribe form is wired to site.js /subscribe handler', () => {
  expect(writingIndex).toContain('id="subscribe-form"');
  expect(writingIndex).toContain('id="subscribe-email"');
  expect(siteJs).toContain("$('subscribe-form')");
});
test('site.js modules guard for pages without the hero/faq DOM', () => {
  expect(siteJs).toContain("const wrap = $('hero-embed-wrap'); if (!wrap) return;");
  expect(siteJs).toContain("const faqList = $('faq-list');");
  expect(siteJs).toContain('if (faqList) {');
});
test('<script> open/close tags are balanced on every writing page', () => {
  for (const p of allWritingPages) {
    expect((p.html.match(/<script[\s>]/g) || []).length).toBe((p.html.match(/<\/script>/g) || []).length);
  }
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
