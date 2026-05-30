/**
 * Mobile responsiveness tests for the Meridiona website.
 *
 * Run with: node tests/responsive.test.js
 * Requires: Node.js 18+ (for fetch/structuredClone)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_PATH = path.join(__dirname, '..', 'index.html');

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

const html = fs.readFileSync(HTML_PATH, 'utf-8');

// Extract the template JSON from the bundled HTML
function extractTemplate(html) {
  const tag = '<script type="__bundler/template">';
  const start = html.indexOf(tag) + tag.length;
  const end = html.indexOf('</script>', start);
  return JSON.parse(html.slice(start, end).trim());
}

const template = extractTemplate(html);

// ─── Group 1: Viewport meta ───────────────────────────────────────────────────
console.log('\nViewport meta tag');
test('outer bundler wrapper has viewport meta tag', () => {
  // The wrapper HTML shown before JS executes must also declare the viewport
  // so mobile browsers don't scale the loading thumbnail incorrectly.
  const head = html.slice(0, html.indexOf('<body'));
  expect(head).toContain('name="viewport"');
  expect(head).toContain('width=device-width');
  expect(head).toContain('initial-scale=1');
});
test('template has viewport meta tag', () => {
  expect(template).toContain('name="viewport"');
  expect(template).toContain('width=device-width');
});

// ─── Group 2: Responsive CSS ─────────────────────────────────────────────────
console.log('\nResponsive CSS');
test('template contains 768px media query', () => {
  expect(template).toContain('@media (max-width: 768px)');
});
test('template contains 480px media query', () => {
  expect(template).toContain('@media (max-width: 480px)');
});
test('12-col grid is overridden to single column on mobile', () => {
  const idx = template.indexOf('@media (max-width: 768px)');
  const mobile = template.slice(idx, idx + 3500);
  expect(mobile).toContain('.grid-cols-12 { grid-template-columns: 1fr; }');
  // Child elements must also be forced full-width to prevent implicit track creation
  expect(mobile).toContain('.grid-cols-12 > * { grid-column: 1 / -1; }');
});
test('3-col grid is overridden to single column on mobile', () => {
  const idx = template.indexOf('@media (max-width: 768px)');
  const mobile = template.slice(idx, idx + 3500);
  expect(mobile).toContain('.grid-cols-3 { grid-template-columns: 1fr; }');
  expect(mobile).toContain('.grid-cols-3 > * { grid-column: 1 / -1; }');
});
test('4-col grid is overridden to 2 columns on mobile', () => {
  const idx = template.indexOf('@media (max-width: 768px)');
  const mobile = template.slice(idx, idx + 3000);
  expect(mobile).toContain('.grid-cols-4 { grid-template-columns: 1fr 1fr; }');
});
test('left-border rule removed on mobile (stacked columns)', () => {
  const idx = template.indexOf('@media (max-width: 768px)');
  const mobile = template.slice(idx, idx + 3000);
  expect(mobile).toContain('.rule-l {');
  expect(mobile).toContain('border-left: none');
});
test('display type (88px) is scaled down on mobile', () => {
  const idx = template.indexOf('@media (max-width: 768px)');
  const mobile = template.slice(idx, idx + 3000);
  expect(mobile).toContain('.text-\\[88px\\]');
});
test('CTA form stacks vertically on mobile', () => {
  const idx = template.indexOf('@media (max-width: 768px)');
  const mobile = template.slice(idx, idx + 3000);
  expect(mobile).toContain('.cta-form { flex-direction: column; }');
});

// ─── Group 3: Mobile navigation ──────────────────────────────────────────────
console.log('\nMobile navigation');
test('hamburger button is in the template', () => {
  expect(template).toContain('id="nav-toggle"');
  expect(template).toContain('nav-hamburger');
  expect(template).toContain('aria-label="Toggle menu"');
  expect(template).toContain('aria-expanded="false"');
});
test('hamburger has 3 child spans', () => {
  const btnIdx = template.indexOf('id="nav-toggle"');
  const btnEnd = template.indexOf('</button>', btnIdx);
  const btnHtml = template.slice(btnIdx, btnEnd);
  const spans = (btnHtml.match(/<span>/g) || []).length;
  expect(spans).toBe(3);
});
test('hamburger is hidden on desktop via CSS', () => {
  expect(template).toContain('.nav-hamburger { display: none');
});
test('hamburger is shown on mobile via CSS', () => {
  const idx = template.indexOf('@media (max-width: 768px)');
  const mobile = template.slice(idx, idx + 3000);
  expect(mobile).toContain('.nav-hamburger { display: flex; }');
});
test('nav CTA button hidden on mobile', () => {
  const idx = template.indexOf('@media (max-width: 768px)');
  const mobile = template.slice(idx, idx + 3000);
  expect(mobile).toContain('.nav-cta { display: none; }');
});
test('site-nav has absolute positioning on mobile', () => {
  const idx = template.indexOf('@media (max-width: 768px)');
  const mobile = template.slice(idx, idx + 3000);
  expect(mobile).toContain('position: absolute;');
});
test('hamburger JS toggle is in the template', () => {
  expect(template).toContain("nav.classList.toggle");
  expect(template).toContain("nav-open");
});
test('hamburger JS closes nav on outside click', () => {
  expect(template).toContain("nav.classList.remove('nav-open')");
});
test('header has relative positioning class', () => {
  expect(template).toContain('justify-between relative');
});

// ─── Group 4: HTML classes ────────────────────────────────────────────────────
console.log('\nHTML responsive classes');
test('masthead subtitle has masthead-hide-mobile class', () => {
  expect(template).toContain('masthead-hide-mobile');
  expect(template).toContain('A quarterly brief on intelligent organisations');
  const idx = template.indexOf('A quarterly brief');
  const before = template.slice(Math.max(0, idx - 200), idx);
  expect(before).toContain('masthead-hide-mobile');
});
test('CTA form has cta-form class', () => {
  expect(template).toContain('class="mt-8 max-w-[440px] mx-auto flex gap-2 cta-form"');
});
test('nav link to CTA has nav-cta class', () => {
  expect(template).toContain('class="text-[13px] mono px-3 py-1.5 rounded-full nav-cta"');
});

// ─── Group 5: JSON encoding safety ───────────────────────────────────────────
console.log('\nJSON encoding safety');
test('no unescaped </script> in raw JSON (prevents HTML parsing issues)', () => {
  const tag = '<script type="__bundler/template">';
  const start = html.indexOf(tag) + tag.length;
  const end = html.indexOf('</script>', start);
  const rawJson = html.slice(start, end).trim();
  // </ should never appear unescaped in the JSON string
  const unescaped = rawJson.match(/(?<!\\)<\//g);
  expect(unescaped).toBeFalsy();
});
test('template JSON parses successfully', () => {
  expect(typeof template).toBe('string');
  expect(template.length).toBeGreaterThan(1000);
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
