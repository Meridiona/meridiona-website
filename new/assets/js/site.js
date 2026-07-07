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
      emailTitle: 'Get in line',
      emailPrompt: 'Windows is on our map. Leave your email and you’re first through the door.',
      ctaLabel: 'Join the waitlist',
      emailNote: 'No spam. One email, the day it ships.',
      successTitle: 'You’re on the list',
      successBody: 'The moment Meridian crosses over to Windows, your inbox lights up. Until then — we’re building.',
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

  var $ = function (id) { return document.getElementById(id); };
  var EMAIL_RE = /\S+@\S+\.\S+/;

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
      var embedW = Math.max(260, Math.min(1160, Math.min(
        (vh - CHROME) * (HeroEmbed.DEVICE_W / HeroEmbed.DEVICE_H),
        vw - 32 - MAT
      )));
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
      HeroEmbed.size();
      window.addEventListener('resize', HeroEmbed.size);
    },
  };

  // ── download modal ───────────────────────────────────────────────────────
  var DownloadModal = {
    state: { os: null, email: '', sent: false },
    open: function () {
      DownloadModal.state = { os: null, email: '', sent: false };
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
              '<span class="os-option__meta">waitlist</span>' +
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
        body.innerHTML =
          '<h3 class="modal-title">' + copy.emailTitle + '</h3>' +
          '<p class="modal-subtitle">' + copy.emailPrompt + '</p>' +
          '<form id="dl-form" class="email-form">' +
            '<input id="dl-email" class="email-input" type="email" required autofocus ' +
              'placeholder="you@work.com" value="' + s.email + '" aria-label="Email address">' +
            '<button type="submit" class="btn-primary btn-primary--block">' + copy.ctaLabel + '</button>' +
          '</form>' +
          '<div class="form-note">' + copy.emailNote + '</div>' +
          '<button id="dl-back" class="btn-text" style="margin-top:12px">← different machine</button>';
        return;
      }

      body.innerHTML =
        '<h3 class="modal-title"><span class="success-check">✓</span> ' + copy.successTitle + '</h3>' +
        '<p class="modal-subtitle">' + copy.successBody + '</p>' +
        (s.os === 'mac'
          ? '<div class="success-link"><a href="/dl?ref=landing-modal-again">didn’t start? download again</a></div>'
          : '');
    },
    handleBodyClick: function (e) {
      var osBtn = e.target.closest('[data-os]');
      if (osBtn) { DownloadModal.state.os = osBtn.dataset.os; DownloadModal.render(); return; }
      if (e.target.id === 'dl-back') { DownloadModal.state.os = null; DownloadModal.render(); }
    },
    handleBodySubmit: function (e) {
      if (e.target.id !== 'dl-form') return;
      e.preventDefault();
      var input = $('dl-email');
      var email = input.value.trim();
      if (!EMAIL_RE.test(email)) return;

      DownloadModal.state.email = email;
      DownloadModal.state.sent = true;

      fetch('/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email }),
      }).catch(function () { /* non-fatal: the confirmation UI has already been shown */ });

      if (DownloadModal.state.os === 'mac') {
        $('dl-frame').src = '/dl?ref=landing-modal';
      }
      DownloadModal.render();
    },
    init: function () {
      $('btn-download-nav').addEventListener('click', DownloadModal.open);
      $('btn-download-faq').addEventListener('click', DownloadModal.open);
      $('btn-close-download').addEventListener('click', DownloadModal.close);
      $('modal-download').addEventListener('click', function (e) {
        if (e.target.id === 'modal-download') DownloadModal.close();
      });
      $('modal-download-body').addEventListener('click', DownloadModal.handleBodyClick);
      $('modal-download-body').addEventListener('submit', DownloadModal.handleBodySubmit);
    },
  };

  // ── connect modal ─────────────────────────────────────────────────────────
  var ConnectModal = {
    open: function () { $('modal-connect').classList.add('is-open'); },
    close: function () { $('modal-connect').classList.remove('is-open'); },
    init: function () {
      $('btn-connect').addEventListener('click', ConnectModal.open);
      $('btn-close-connect').addEventListener('click', ConnectModal.close);
      $('modal-connect').addEventListener('click', function (e) {
        if (e.target.id === 'modal-connect') ConnectModal.close();
      });
    },
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { DownloadModal.close(); ConnectModal.close(); }
  });

  Theme.init();
  Faq.init();
  HeroEmbed.init();
  DownloadModal.init();
  ConnectModal.init();
})();
