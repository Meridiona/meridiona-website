/*
 * Meridian landing page behavior: theme switcher, FAQ accordion, hero embed
 * scaling, download modal (mac/windows/linux + /subscribe + /dl), and the
 * social "connect" modal. Vanilla JS, no build step, no dependencies.
 */
(function () {
  'use strict';

  var THEME_STORAGE_KEY = 'meridian-theme';
  var THEMES = [
    { id: 'dawn', label: 'Dawn — light lavender', sw: 'linear-gradient(135deg,#f1edfb 50%,#7c3aed 50%)' },
    { id: 'dusk', label: 'Dusk — dark', sw: 'linear-gradient(135deg,#171226 50%,#8b5cf6 50%)' },
    { id: 'paper', label: 'Paper — warm ink', sw: 'linear-gradient(135deg,#faf8f3 50%,#4f46e5 50%)' },
  ];

  var FAQ = [
    { q: 'Does anything leave my Mac?',
      a: 'No. Capture, analysis, and the journal all run on-device. The only thing that ever leaves your Mac is a worklog you explicitly approved — sent directly to your PM tool.' },
    { q: 'Is it really open source?',
      a: 'Yes — MIT-licensed, every line auditable. No tiers, no trial, no card. If you ever want to know how it works, read the code.' },
    { q: 'What does it capture — and can I exclude apps?',
      a: 'The apps and windows you work in, to build your journal — nothing you can’t see for yourself. Exclude any app, pause anytime from the menu bar, delete anything.' },
    { q: 'Which PM tools does it post to?',
      a: 'Jira, Linear, GitHub Projects, Azure DevOps, and Trello. Connections are read-only until you approve a log — Meridian never writes to your board on its own.' },
    { q: 'Is it useful without a PM tool?',
      a: 'Completely. With nothing connected, Meridian is a private, searchable record of your work — your time, your decisions, your day. That alone is the product.' },
  ];

  var DOWNLOAD_COPY = {
    mac: {
      emailTitle: 'Almost there',
      emailPrompt: 'Drop your email and the download starts right away.',
      ctaLabel: 'Continue → download',
      emailNote: 'macOS 14+ · Apple Silicon (M1 or later)',
      successTitle: 'Download started',
      successBody: 'Meridian.dmg is on its way. Drag it to Applications and look for the diamond in your menu bar.',
    },
    windows: {
      emailTitle: 'Almost there',
      emailPrompt: 'Drop your email and the download starts right away.',
      ctaLabel: 'Continue → download',
      emailNote: 'Windows 10/11 · 64-bit',
      successTitle: 'Download started',
      successBody: 'Meridian-setup.exe is on its way. Run it, and look for the diamond in your system tray.',
    },
    linux: {
      emailTitle: 'Get in line',
      emailPrompt: 'Meridian doesn’t speak penguin yet. Leave your email — you’ll be the first ping when it does.',
      ctaLabel: 'Join the waitlist',
      emailNote: 'No spam. One email, the day it ships.',
      successTitle: 'Saved you a spot',
      successBody: 'Linux is coming. You’re at the front of the queue — we’ll ping you the day it lands.',
    },
  };

  // Which OSes have a real build behind the modal (a download) vs. a waitlist.
  // macOS and Windows download; Linux is still a waitlist. The one place OS
  // support changes — flip an entry here and the copy, the trigger, and the
  // "download again" link all follow.
  function isDownloadOS(os) { return os === 'mac' || os === 'windows'; }

  var $ = function (id) { return document.getElementById(id); };
  var EMAIL_RE = /\S+@\S+\.\S+/;

  var COUNTRY_CODES = [
    { code: '+1', name: 'US/Canada', ph: '201 555 0123' }, { code: '+44', name: 'UK', ph: '7911 123456' },
    { code: '+91', name: 'India', ph: '98765 43210' }, { code: '+61', name: 'Australia', ph: '412 345 678' },
    { code: '+49', name: 'Germany', ph: '1512 3456789' }, { code: '+33', name: 'France', ph: '6 12 34 56 78' },
    { code: '+81', name: 'Japan', ph: '90 1234 5678' }, { code: '+82', name: 'South Korea', ph: '10 1234 5678' },
    { code: '+86', name: 'China', ph: '131 2345 6789' }, { code: '+65', name: 'Singapore', ph: '8123 4567' },
    { code: '+971', name: 'UAE', ph: '50 123 4567' }, { code: '+31', name: 'Netherlands', ph: '6 12345678' },
    { code: '+34', name: 'Spain', ph: '612 345 678' }, { code: '+39', name: 'Italy', ph: '312 345 6789' },
    { code: '+46', name: 'Sweden', ph: '70 123 45 67' }, { code: '+41', name: 'Switzerland', ph: '78 123 45 67' },
    { code: '+52', name: 'Mexico', ph: '55 1234 5678' }, { code: '+55', name: 'Brazil', ph: '11 91234 5678' },
    { code: '+27', name: 'South Africa', ph: '71 123 4567' }, { code: '+64', name: 'New Zealand', ph: '21 123 4567' },
    { code: '+63', name: 'Philippines', ph: '917 123 4567' }, { code: '+62', name: 'Indonesia', ph: '812 3456 789' },
    { code: '+92', name: 'Pakistan', ph: '301 2345678' }, { code: '+880', name: 'Bangladesh', ph: '1712 345678' },
  ];
  var COUNTRY_CODE_PLACEHOLDERS = COUNTRY_CODES.reduce(function (map, c) {
    map[c.code] = c.ph;
    return map;
  }, {});

  // ── theme switcher ───────────────────────────────────────────────────────
  var Theme = {
    current: function () {
      try { return localStorage.getItem(THEME_STORAGE_KEY) || 'dawn'; }
      catch (e) { return 'dawn'; }
    },
    apply: function (id) {
      document.body.dataset.theme = id;
      try { localStorage.setItem(THEME_STORAGE_KEY, id); } catch (e) { /* private mode, ignore */ }
      Theme.renderDots(id);
    },
    renderDots: function (active) {
      var wrap = $('theme-dots');
      wrap.innerHTML = THEMES.map(function (t) {
        var activeClass = active === t.id ? ' is-active' : '';
        return '<button class="theme-dot' + activeClass + '" data-theme-id="' + t.id + '" ' +
          'title="' + t.label + '" aria-label="' + t.label + '" aria-pressed="' + (active === t.id) + '" ' +
          'style="background:' + t.sw + '"></button>';
      }).join('');
    },
    init: function () {
      if (!$('theme-dots')) return;
      $('theme-dots').addEventListener('click', function (e) {
        var el = e.target.closest('[data-theme-id]');
        if (el) Theme.apply(el.dataset.themeId);
      });
      Theme.apply(Theme.current());
    },
  };

  // ── FAQ accordion ─────────────────────────────────────────────────────────
  var Faq = {
    openIndex: -1,
    render: function () {
      var html = FAQ.map(function (f, i) {
        var isOpen = Faq.openIndex === i;
        return (
          '<div class="faq-item">' +
            '<div class="faq-item__q" data-faq-idx="' + i + '" role="button" tabindex="0" aria-expanded="' + isOpen + '">' +
              '<span class="faq-item__q-text">' + f.q + '</span>' +
              '<span class="faq-item__icon">' + (isOpen ? '−' : '+') + '</span>' +
            '</div>' +
            (isOpen ? '<p class="faq-item__a">' + f.a + '</p>' : '') +
          '</div>'
        );
      }).join('');
      $('faq-list').innerHTML = html;
    },
    toggle: function (idx) {
      Faq.openIndex = Faq.openIndex === idx ? -1 : idx;
      Faq.render();
    },
    init: function () {
      var list = $('faq-list');
      if (!list) return;
      list.addEventListener('click', function (e) {
        var el = e.target.closest('[data-faq-idx]');
        if (el) Faq.toggle(Number(el.dataset.faqIdx));
      });
      list.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var el = e.target.closest('[data-faq-idx]');
        if (el) { e.preventDefault(); Faq.toggle(Number(el.dataset.faqIdx)); }
      });
      Faq.render();
    },
  };

  // ── hero embed scaling ────────────────────────────────────────────────────
  // The demo lives at a fixed 1240x868 resolution (its own internal layout is
  // not fluid) and is scaled down with a CSS transform to fit the hero. Sized
  // in JS (not CSS aspect-ratio/container queries) because we also cap height
  // against the viewport so the hero never forces a page scroll.
  var HeroEmbed = {
    DEVICE_W: 1240,
    DEVICE_H: 720,
    size: function () {
      var vw = window.innerWidth || 1440;
      var vh = window.innerHeight || 900;
      var CHROME = 350; // title block + margins + trust strip + section paddings + embed mat, measured empirically
      var MAT_PAD = 18, MAT_BORDER = 2;
      var MAT = (MAT_PAD + MAT_BORDER) * 2;
      // Available content width = the hero's inner box, i.e. its width minus its
      // own horizontal padding (which shrinks at mobile breakpoints). Measuring
      // it — rather than subtracting a hardcoded reservation — is what keeps the
      // matted frame from spilling past the hero and getting clipped by
      // overflow-x:hidden on narrow phones.
      var hero = document.querySelector('.hero');
      var avail = vw - 48; // fallback: default .hero padding is 24px/side
      if (hero) {
        var cs = window.getComputedStyle(hero);
        avail = hero.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      }
      var embedW = Math.max(260, Math.min(1160, Math.min(
        (vh - CHROME) * (HeroEmbed.DEVICE_W / HeroEmbed.DEVICE_H),
        avail - MAT
      )));
      // Hard cap to the available width even when the 260px floor above would
      // otherwise win (very small viewports, ≤320px) so the frame never clips.
      embedW = Math.min(embedW, avail - MAT);
      var scale = embedW / HeroEmbed.DEVICE_W;
      var embedH = Math.round(embedW * HeroEmbed.DEVICE_H / HeroEmbed.DEVICE_W);

      $('hero-embed-wrap').style.width = Math.round(embedW + MAT) + 'px';
      var frame = $('hero-outer-frame');
      frame.style.width = Math.round(embedW + MAT) + 'px';
      frame.style.padding = MAT_PAD + 'px';
      var viewport = $('hero-viewport');
      viewport.style.width = Math.round(embedW) + 'px';
      viewport.style.height = embedH + 'px';
      var iframe = $('hero-embed-frame');
      iframe.style.width = HeroEmbed.DEVICE_W + 'px';
      iframe.style.height = HeroEmbed.DEVICE_H + 'px';
      iframe.style.transform = 'scale(' + scale + ')';
    },
    init: function () {
      if (!$('hero-embed-wrap')) return;
      HeroEmbed.size();
      window.addEventListener('resize', HeroEmbed.size);
    },
  };

  // ── demo fullscreen (mobile) ──────────────────────────────────────────────
  // The inline hero embed is only a scaled-down preview; on a phone it's too
  // small to actually use. Tapping it opens the real demo full screen, laid
  // out in landscape (the demo's canvas is 1240x720, i.e. landscape) so it's
  // legible and interactive. When the phone is held in portrait we rotate the
  // frame 90° to fill the screen; the demo's own pointer handlers live inside
  // the iframe and measure in its local space, so swipe-to-approve keeps
  // working through the rotation. Already-landscape viewports skip the rotate.
  var DemoFullscreen = {
    DEVICE_W: 1240,
    DEVICE_H: 720,
    overlay: null, frame: null, open: false,
    build: function () {
      if (DemoFullscreen.overlay) return;
      var o = document.createElement('div');
      o.id = 'demo-fs';
      o.className = 'demo-fs';
      o.setAttribute('role', 'dialog');
      o.setAttribute('aria-modal', 'true');
      o.setAttribute('aria-label', 'Meridian interactive demo');
      o.innerHTML =
        '<div class="demo-fs__stage">' +
          '<iframe class="demo-fs__frame" title="Meridian product demo" src="/new/demo.html"></iframe>' +
        '</div>' +
        '<button class="demo-fs__close" aria-label="Close demo">✕</button>' +
        '<div class="demo-fs__hint" aria-hidden="true">rotate your phone for the full view</div>';
      document.body.appendChild(o);
      DemoFullscreen.overlay = o;
      DemoFullscreen.frame = o.querySelector('.demo-fs__frame');
      o.querySelector('.demo-fs__close').addEventListener('click', DemoFullscreen.hide);
      o.addEventListener('click', function (e) { if (e.target === o) DemoFullscreen.hide(); });
      // Re-fit when the demo document itself finishes loading (its layout can
      // settle after our first size() call).
      DemoFullscreen.frame.addEventListener('load', DemoFullscreen.size);
    },
    size: function () {
      if (!DemoFullscreen.open || !DemoFullscreen.frame) return;
      // visualViewport is the reliable source for the actually-visible area on
      // mobile Safari (window.innerWidth/Height can be stale right after an
      // orientation change); fall back to innerWidth/documentElement.
      var vv = window.visualViewport;
      var sw = Math.round((vv && vv.width) || window.innerWidth || document.documentElement.clientWidth);
      var sh = Math.round((vv && vv.height) || window.innerHeight || document.documentElement.clientHeight);
      var longEdge = Math.max(sw, sh), shortEdge = Math.min(sw, sh);
      var portrait = sh >= sw;
      // Fit the 1240x720 (landscape) canvas into the screen's landscape box.
      // min() guarantees BOTH axes fit — the demo is letterboxed, never clipped.
      var scale = Math.min(longEdge / DemoFullscreen.DEVICE_W, shortEdge / DemoFullscreen.DEVICE_H);
      var f = DemoFullscreen.frame;
      f.style.width = DemoFullscreen.DEVICE_W + 'px';
      f.style.height = DemoFullscreen.DEVICE_H + 'px';
      // Centred with translate(-50%,-50%) against left/top:50% (in CSS) rather
      // than flexbox — flex-centring an item far wider than its container
      // clips the overflow unpredictably; translate-centring never does.
      f.style.transform = 'translate(-50%,-50%) ' + (portrait ? 'rotate(90deg) ' : '') + 'scale(' + scale + ')';
      DemoFullscreen.overlay.classList.toggle('is-portrait', portrait);
    },
    // iOS reports stale viewport dimensions immediately after an orientation
    // change, so recompute now and again after the rotation settles.
    resize: function () {
      DemoFullscreen.size();
      window.setTimeout(DemoFullscreen.size, 250);
    },
    show: function () {
      DemoFullscreen.build();
      DemoFullscreen.open = true;
      DemoFullscreen.overlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      DemoFullscreen.size();
      window.requestAnimationFrame(DemoFullscreen.size); // after the overlay paints
    },
    hide: function () {
      if (!DemoFullscreen.overlay) return;
      DemoFullscreen.open = false;
      DemoFullscreen.overlay.classList.remove('is-open');
      document.body.style.overflow = '';
    },
    init: function () {
      var opener = $('demo-open');
      if (!opener) return;
      opener.addEventListener('click', DemoFullscreen.show);
      window.addEventListener('resize', DemoFullscreen.resize);
      window.addEventListener('orientationchange', DemoFullscreen.resize);
      if (window.visualViewport) window.visualViewport.addEventListener('resize', DemoFullscreen.size);
    },
  };

  // ── download modal ───────────────────────────────────────────────────────
  var DownloadModal = {
    state: { os: null, email: '', phoneCode: '+1', phone: '', sent: false },
    open: function () {
      DownloadModal.state = { os: null, email: '', phoneCode: '+1', phone: '', sent: false };
      DownloadModal.render();
      $('modal-download').classList.add('is-open');
    },
    close: function () {
      $('modal-download').classList.remove('is-open');
    },
    render: function () {
      var s = DownloadModal.state;
      var body = $('modal-download-body');

      if (!s.os) {
        body.innerHTML =
          '<h3 class="modal-title">Get Meridian</h3>' +
          '<p class="modal-subtitle">First — what are you running?</p>' +
          '<div class="os-picker">' +
            '<button class="os-option os-option--primary" data-os="mac">' +
              '<span class="os-option__name">macOS</span>' +
              '<span class="os-option__meta os-option__meta--accent">Apple Silicon · ready today</span>' +
            '</button>' +
            '<button class="os-option" data-os="windows">' +
              '<span class="os-option__name">Windows</span>' +
              '<span class="os-option__meta os-option__meta--accent">10/11 · ready today</span>' +
            '</button>' +
            '<button class="os-option" data-os="linux">' +
              '<span class="os-option__name">Linux</span>' +
              '<span class="os-option__meta">waitlist</span>' +
            '</button>' +
          '</div>';
        return;
      }

      var copy = DOWNLOAD_COPY[s.os];

      if (!s.sent) {
        var countryOptions = COUNTRY_CODES.map(function (c) {
          var selected = c.code === s.phoneCode ? ' selected' : '';
          return '<option value="' + c.code + '"' + selected + '>' + c.code + ' ' + c.name + '</option>';
        }).join('');
        body.innerHTML =
          '<h3 class="modal-title">' + copy.emailTitle + '</h3>' +
          '<p class="modal-subtitle">' + copy.emailPrompt + '</p>' +
          '<form id="dl-form" class="email-form">' +
            '<input id="dl-email" class="email-input" type="email" required autofocus ' +
              'placeholder="you@work.com" value="' + s.email + '" aria-label="Email address">' +
            '<p class="phone-hint">📱 Got a number? (Totally optional) Drop it below so we can text you when we ship fixes, ask what broke, or just say thanks — never spam.</p>' +
            '<div class="phone-row">' +
              '<select id="dl-phone-code" class="phone-select" aria-label="Country code">' + countryOptions + '</select>' +
              '<input id="dl-phone" class="phone-input" type="tel" placeholder="' + (COUNTRY_CODE_PLACEHOLDERS[s.phoneCode] || '') + '" value="' + s.phone + '" aria-label="Phone number (optional)">' +
            '</div>' +
            '<button type="submit" class="btn-primary btn-primary--block">' + copy.ctaLabel + '</button>' +
          '</form>' +
          '<div class="form-note">' + copy.emailNote + '</div>' +
          '<button id="dl-back" class="btn-text" style="margin-top:12px">← different machine</button>';
        return;
      }

      body.innerHTML =
        '<h3 class="modal-title"><span class="success-check">✓</span> ' + copy.successTitle + '</h3>' +
        '<p class="modal-subtitle">' + copy.successBody + '</p>' +
        (isDownloadOS(s.os)
          ? '<div class="success-link"><a href="/dl?ref=landing-modal-again' +
              (s.os === 'windows' ? '&os=windows' : '') +
              '">didn’t start? download again</a></div>'
          : '');
    },
    handleBodyClick: function (e) {
      var osBtn = e.target.closest('[data-os]');
      if (osBtn) { DownloadModal.state.os = osBtn.dataset.os; DownloadModal.render(); return; }
      if (e.target.id === 'dl-back') { DownloadModal.state.os = null; DownloadModal.render(); }
    },
    handleBodyChange: function (e) {
      if (e.target.id !== 'dl-phone-code') return;
      // Direct DOM update (not a full render()) so the number the user already typed isn't wiped.
      DownloadModal.state.phoneCode = e.target.value;
      var input = $('dl-phone');
      if (input) input.placeholder = COUNTRY_CODE_PLACEHOLDERS[e.target.value] || '';
    },
    handleBodySubmit: function (e) {
      if (e.target.id !== 'dl-form') return;
      e.preventDefault();
      var input = $('dl-email');
      var email = input.value.trim();
      if (!EMAIL_RE.test(email)) return;

      var phoneDigits = ($('dl-phone').value || '').trim();
      var phoneCode = $('dl-phone-code').value;
      var phone = phoneDigits ? (phoneCode + ' ' + phoneDigits) : '';

      DownloadModal.state.email = email;
      DownloadModal.state.phoneCode = phoneCode;
      DownloadModal.state.phone = phoneDigits;
      DownloadModal.state.sent = true;

      fetch('/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          source: isDownloadOS(DownloadModal.state.os) ? 'download' : 'waitlist',
          os: DownloadModal.state.os,
          phone: phone,
        }),
      }).catch(function () { /* non-fatal: the confirmation UI has already been shown */ });

      if (isDownloadOS(DownloadModal.state.os)) {
        $('dl-frame').src = '/dl?ref=landing-modal' +
          (DownloadModal.state.os === 'windows' ? '&os=windows' : '');
      }
      DownloadModal.render();
    },
    init: function () {
      if (!$('modal-download')) return;
      if ($('btn-download-nav')) $('btn-download-nav').addEventListener('click', DownloadModal.open);
      if ($('btn-download-faq')) $('btn-download-faq').addEventListener('click', DownloadModal.open);
      $('btn-close-download').addEventListener('click', DownloadModal.close);
      $('modal-download').addEventListener('click', function (e) {
        if (e.target.id === 'modal-download') DownloadModal.close();
      });
      $('modal-download-body').addEventListener('click', DownloadModal.handleBodyClick);
      $('modal-download-body').addEventListener('submit', DownloadModal.handleBodySubmit);
      $('modal-download-body').addEventListener('change', DownloadModal.handleBodyChange);
    },
  };

  // ── connect modal ─────────────────────────────────────────────────────────
  var ConnectModal = {
    open: function () { $('modal-connect').classList.add('is-open'); },
    close: function () { $('modal-connect').classList.remove('is-open'); },
    init: function () {
      if (!$('modal-connect') || !$('btn-connect')) return;
      $('btn-connect').addEventListener('click', ConnectModal.open);
      $('btn-close-connect').addEventListener('click', ConnectModal.close);
      $('modal-connect').addEventListener('click', function (e) {
        if (e.target.id === 'modal-connect') ConnectModal.close();
      });
    },
  };

  // ── why: scroll-driven panel stage ────────────────────────────────────────
  // The #why section pins one "stage" and swaps a single panel at a time as the
  // reader scrolls through it — one idea per screen, minimal text. Driven by
  // scroll position (getBoundingClientRect), not IntersectionObserver, so it
  // works anywhere; falls back to a plain stacked list when motion is reduced.
  var WhyScroll = {
    // Below this width the pinned, scroll-jacked stage is skipped entirely:
    // the panels fall back to the plain stacked `.scrolly:not(.is-ready)`
    // layout (all panels visible, no fixed-height clipping, no scrolljack),
    // which reads far better on a phone than a pinned viewport that can't
    // fit a tall panel. Kept in sync with the CSS mobile breakpoint.
    MOBILE_MAX: 760,
    el: null, panels: [], rail: [], steps: 0, active: -1,
    init: function () {
      WhyScroll.el = $('why-scrolly');
      if (!WhyScroll.el) return;
      if (window.innerWidth <= WhyScroll.MOBILE_MAX) return; // stacked fallback on mobile
      WhyScroll.panels = [].slice.call(WhyScroll.el.querySelectorAll('.scrolly__panel'));
      WhyScroll.rail = [].slice.call(WhyScroll.el.querySelectorAll('.scrolly__rail-item'));
      WhyScroll.steps = WhyScroll.panels.length;
      if (!WhyScroll.steps) return;

      WhyScroll.el.style.setProperty('--steps', WhyScroll.steps);
      WhyScroll.el.classList.add('is-ready');
      WhyScroll.setActive(0);

      // the sticky intro bar's height varies with text wrap at different
      // widths — measure it so the pinned stage always starts exactly below
      // it, instead of guessing a fixed offset that breaks on some widths.
      WhyScroll.measureIntro();
      window.addEventListener('resize', WhyScroll.measureIntro, { passive: true });

      window.addEventListener('scroll', WhyScroll.update, { passive: true });
      window.addEventListener('resize', WhyScroll.update, { passive: true });
      WhyScroll.update();

      // "docs →" jump: lets a reader click straight from a task in step 1 to
      // its auto-generated doc later in the stage, instead of only scrolling.
      [].slice.call(WhyScroll.el.querySelectorAll('[data-jump-step]')).forEach(function (btn) {
        btn.addEventListener('click', function () {
          WhyScroll.goTo(parseInt(btn.getAttribute('data-jump-step'), 10) || 0);
        });
      });
    },
    measureIntro: function () {
      var intro = document.querySelector('.why__intro');
      if (!intro) return;
      document.documentElement.style.setProperty('--intro-h', intro.offsetHeight + 'px');
    },
    goTo: function (idx) {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var total = WhyScroll.el.offsetHeight - vh;
      if (total <= 0) return;
      var target = WhyScroll.el.offsetTop + total * ((idx + 0.5) / WhyScroll.steps);
      window.scrollTo({ top: target, behavior: 'smooth' });
    },
    update: function () {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var rect = WhyScroll.el.getBoundingClientRect();
      var total = WhyScroll.el.offsetHeight - vh;
      var p = total > 0 ? (-rect.top) / total : 0;
      p = Math.max(0, Math.min(0.99999, p));
      var idx = Math.floor(p * WhyScroll.steps);
      if (idx !== WhyScroll.active) WhyScroll.setActive(idx);
    },
    setActive: function (idx) {
      WhyScroll.active = idx;
      WhyScroll.panels.forEach(function (el, i) { el.classList.toggle('is-active', i === idx); });
      WhyScroll.rail.forEach(function (el, i) {
        var on = i === idx;
        el.classList.toggle('is-active', on);
        el.setAttribute('aria-current', on ? 'step' : 'false');
      });
    },
  };

  // ── lines-shipped ticker: counts up once, then keeps ticking slowly so the
  // stat reads as "live" rather than a static number. setInterval (not rAF —
  // more reliably paced across environments).
  var LinesTicker = {
    init: function () {
      var el = $('lines-ticker');
      if (!el) return;
      var target = parseInt(el.getAttribute('data-target'), 10) || 0;
      var steps = 34, i = 0;
      var cu = setInterval(function () {
        i++;
        var p = Math.min(1, i / steps);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString('en-US');
        if (i >= steps) {
          clearInterval(cu);
          el.textContent = target.toLocaleString('en-US');
          LinesTicker.liveTick(el, target);
        }
      }, 40);
    },
    liveTick: function (el, base) {
      var current = base;
      var tick = function () {
        current += Math.floor(Math.random() * 3) + 1;
        el.textContent = current.toLocaleString('en-US');
        setTimeout(tick, 2200 + Math.random() * 1800);
      };
      setTimeout(tick, 2200 + Math.random() * 1800);
    },
  };

  // ── writing-page subscribe form ("the field notes letter") ───────────────
  var SubscribeForm = {
    init: function () {
      var form = $('subscribe-form');
      if (!form) return;
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = $('subscribe-email');
        var msg = $('subscribe-msg');
        var btn = form.querySelector('button[type="submit"]');
        var email = (input.value || '').trim();
        if (!EMAIL_RE.test(email)) return;
        btn.disabled = true;
        btn.textContent = 'Subscribing…';
        fetch('/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email }),
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.success) {
              form.style.display = 'none';
              msg.textContent = 'You’re on the list. The next essay lands in your inbox.';
            } else {
              msg.textContent = data.error || 'Something went wrong. Please try again.';
              btn.disabled = false;
              btn.textContent = 'Subscribe';
            }
          })
          .catch(function () {
            msg.textContent = 'Something went wrong. Please try again.';
            btn.disabled = false;
            btn.textContent = 'Subscribe';
          });
      });
    },
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { DownloadModal.close(); ConnectModal.close(); DemoFullscreen.hide(); }
  });

  Theme.init();
  Faq.init();
  HeroEmbed.init();
  DemoFullscreen.init();
  DownloadModal.init();
  ConnectModal.init();
  WhyScroll.init();
  LinesTicker.init();
  SubscribeForm.init();
})();
