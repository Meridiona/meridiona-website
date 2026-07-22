// Meridian v2 landing page behavior — theme switching, FAQ accordion, lines
// ticker, hero embed sizing, download/connect modals, cinematic intro replay,
// and the scroll-jacked "why" rail.
document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const THEMES = [
      { id: 'dawn', label: 'Dawn — light lavender', sw: 'linear-gradient(135deg,#f1edfb 50%,#7c3aed 50%)' },
      { id: 'dusk', label: 'Dusk — dark', sw: 'linear-gradient(135deg,#171226 50%,#8b5cf6 50%)' },
      { id: 'paper', label: 'Paper — warm ink', sw: 'linear-gradient(135deg,#faf8f3 50%,#4f46e5 50%)' },
    ];
    const FAQ = [
      { q: 'Does anything leave my Mac?', a: 'No. Capture, analysis, and the journal all run on-device. The only thing that ever leaves your Mac is a worklog you explicitly approved — sent directly to your PM tool.' },
      { q: 'Is it really open source?', a: 'Yes — MIT-licensed, every line auditable. No tiers, no trial, no card. If you ever want to know how it works, read the code.' },
      { q: 'What does it capture — and can I exclude apps?', a: 'The apps and windows you work in, to build your journal — nothing you can’t see for yourself. Exclude any app, pause anytime from the menu bar, delete anything.' },
      { q: 'Which PM tools does it post to?', a: 'Jira, Linear, GitHub Projects, Azure DevOps, and Trello. Connections are read-only until you approve a log — Meridian never writes to your board on its own.' },
      { q: 'Is it useful without a PM tool?', a: 'Completely. With nothing connected, Meridian is a private, searchable record of your work — your time, your decisions, your day. That alone is the product.' },
    ];
    const DL = {
      mac: { emailTitle: 'Almost there', emailPrompt: 'Drop your email and the download starts right away.', ctaLabel: 'Continue → download', emailNote: 'macOS 14+ · Apple Silicon (M1 or later)', successTitle: 'Download started', successBody: 'Meridian.dmg is on its way. Drag it to Applications and look for the diamond in your menu bar.' },
      windows: { emailTitle: 'Almost there', emailPrompt: 'Drop your email and the download starts right away.', ctaLabel: 'Continue → download', emailNote: 'Windows 10/11 · 64-bit', successTitle: 'Download started', successBody: 'Meridian-setup.exe is on its way. Run it, and look for the diamond in your system tray.' },
      linux: { emailTitle: 'Get in line', emailPrompt: 'Meridian doesn’t speak penguin yet. Leave your email — you’ll be the first ping when it does.', ctaLabel: 'Join the waitlist', emailNote: 'No spam. One email, the day it ships.', successTitle: 'Saved you a spot', successBody: 'Linux is coming. You’re at the front of the queue — we’ll ping you the day it lands.' },
    };
    const EMAIL_RE = /\S+@\S+\.\S+/;
    const isDownloadOS = (os) => os === 'mac' || os === 'windows';
    const THEME_STORAGE_KEY = 'meridian-theme';
    const COUNTRY_CODES = [
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
    const COUNTRY_CODE_PLACEHOLDERS = COUNTRY_CODES.reduce((map, c) => { map[c.code] = c.ph; return map; }, {});

    // ── theme ──
    const applyTheme = (id) => {
      document.body.dataset.theme = id;
      try { localStorage.setItem(THEME_STORAGE_KEY, id); } catch (e) {}
      $('theme-dots').innerHTML = THEMES.map((t) =>
        '<button class="theme-dot' + (id === t.id ? ' is-active' : '') + '" data-theme-id="' + t.id + '" title="' + t.label + '" aria-label="' + t.label + '" style="background:' + t.sw + '"></button>').join('');
    };
    let saved = 'dawn'; try { saved = localStorage.getItem(THEME_STORAGE_KEY) || 'dawn'; } catch (e) {}
    applyTheme(saved);
    $('theme-dots').addEventListener('click', (e) => { const el = e.target.closest('[data-theme-id]'); if (el) applyTheme(el.dataset.themeId); });

    // ── obfuscated mailto links (built at runtime so scrapers see no plaintext address) ──
    document.querySelectorAll('.js-email-link').forEach((el) => {
      const addr = el.dataset.user + '@' + el.dataset.domain;
      el.href = 'mailto:' + addr;
      if (el.classList.contains('js-email-link--show')) el.textContent = addr;
    });

    // ── cookie consent ──
    const CONSENT_KEY = 'meridian-consent';
    const consentBar = $('cookie-consent');
    if (consentBar) {
      let storedConsent; try { storedConsent = localStorage.getItem(CONSENT_KEY); } catch (e) {}
      if (storedConsent !== 'granted' && storedConsent !== 'denied') {
        consentBar.classList.add('is-visible');
      }
      const decideConsent = (value) => {
        try { localStorage.setItem(CONSENT_KEY, value); } catch (e) {}
        consentBar.classList.remove('is-visible');
        if (value === 'granted') window.dispatchEvent(new Event('meridian:consent-granted'));
      };
      $('cookie-accept').addEventListener('click', () => decideConsent('granted'));
      $('cookie-decline').addEventListener('click', () => decideConsent('denied'));
    }

    // ── faq ──
    if ($('faq-list')) {
      let faqOpen = -1;
      const renderFaq = () => {
        $('faq-list').innerHTML = FAQ.map((f, i) => {
          const o = faqOpen === i;
          return '<div class="faq-item"><h3 class="faq-item__q-heading"><button type="button" class="faq-item__q" data-faq-idx="' + i + '" aria-expanded="' + o + '"><span class="faq-item__q-text">' + f.q + '</span><span class="faq-item__icon">' + (o ? '−' : '+') + '</span></button></h3>' + (o ? '<p class="faq-item__a">' + f.a + '</p>' : '') + '</div>';
        }).join('');
      };
      renderFaq();
      $('faq-list').addEventListener('click', (e) => { const el = e.target.closest('[data-faq-idx]'); if (el) { const i = +el.dataset.faqIdx; faqOpen = faqOpen === i ? -1 : i; renderFaq(); } });
    }

    // ── lines ticker ──
    const tk = $('lines-ticker');
    if (tk) {
      const target = +tk.getAttribute('data-target') || 0;
      let i = 0; const steps = 34;
      const cu = setInterval(() => {
        i++; const p = Math.min(1, i / steps); const eased = 1 - Math.pow(1 - p, 3);
        tk.textContent = Math.round(target * eased).toLocaleString('en-US');
        if (i >= steps) { clearInterval(cu); tk.textContent = target.toLocaleString('en-US');
          let cur = target; const tick = () => { cur += Math.floor(Math.random() * 3) + 1; tk.textContent = cur.toLocaleString('en-US'); this._tkT = setTimeout(tick, 2200 + Math.random() * 1800); };
          this._tkT = setTimeout(tick, 2200 + Math.random() * 1800);
        }
      }, 40);
    }

    // ── hero embed sizing ──
    const sizeEmbed = () => {
      const wrap = $('hero-embed-wrap'); if (!wrap) return;
      const vw = window.innerWidth || 1440, vh = window.innerHeight || 900;
      const CHROME = 340, MAT_PAD = 18, MAT_BORDER = 2, MAT = (MAT_PAD + MAT_BORDER) * 2;
      const hero = document.querySelector('.hero');
      let avail = vw - 48;
      if (hero) { const cs = getComputedStyle(hero); avail = hero.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); }
      let embedW = Math.max(280, Math.min(1120, Math.min((vh - CHROME) * (1240 / 720), avail - MAT)));
      embedW = Math.min(embedW, avail - MAT);
      const embedH = Math.round(embedW * 720 / 1240);
      wrap.style.width = Math.round(embedW + MAT) + 'px';
      const frame = $('hero-outer-frame'); frame.style.width = Math.round(embedW + MAT) + 'px'; frame.style.padding = MAT_PAD + 'px';
      const vp = $('hero-viewport'); vp.style.width = Math.round(embedW) + 'px'; vp.style.height = embedH + 'px';
    };
    sizeEmbed();
    this._resize = sizeEmbed;
    window.addEventListener('resize', this._resize);

    // ── download modal ──
    const dm = { os: null, email: '', phoneCode: '+1', phone: '', sent: false };
    const renderDl = () => {
      const body = $('modal-download-body');
      if (!dm.os) {
        body.innerHTML = '<h3 class="modal-title">Get Meridian</h3><p class="modal-subtitle">First — what are you running?</p><div class="os-picker">' +
          '<button class="os-option os-option--primary" data-os="mac"><span class="os-option__name">macOS</span><span class="os-option__meta os-option__meta--accent">Apple Silicon · ready today</span></button>' +
          '<button class="os-option" data-os="windows"><span class="os-option__name">Windows</span><span class="os-option__meta os-option__meta--accent">10/11 · ready today</span></button>' +
          '<button class="os-option" data-os="linux"><span class="os-option__name">Linux</span><span class="os-option__meta">waitlist</span></button></div>';
        return;
      }
      const c = DL[dm.os];
      if (!dm.sent) {
        const countryOptions = COUNTRY_CODES.map((cc) =>
          '<option value="' + cc.code + '"' + (cc.code === dm.phoneCode ? ' selected' : '') + '>' + cc.code + ' ' + cc.name + '</option>').join('');
        body.innerHTML = '<h3 class="modal-title">' + c.emailTitle + '</h3><p class="modal-subtitle">' + c.emailPrompt + '</p>' +
          '<form id="dl-form" class="email-form">' +
            '<input id="dl-email" class="email-input" type="email" required autofocus placeholder="you@work.com" value="' + dm.email + '" aria-label="Email address">' +
            '<p class="phone-hint">📱 Got a number? (Totally optional) Drop it below so we can text you when we ship fixes, ask what broke, or just say thanks — never spam.</p>' +
            '<div class="phone-row">' +
              '<select id="dl-phone-code" class="phone-select" aria-label="Country code">' + countryOptions + '</select>' +
              '<input id="dl-phone" class="phone-input" type="tel" placeholder="' + (COUNTRY_CODE_PLACEHOLDERS[dm.phoneCode] || '') + '" value="' + dm.phone + '" aria-label="Phone number (optional)">' +
            '</div>' +
            '<button type="submit" class="btn-primary btn-primary--block">' + c.ctaLabel + '</button>' +
          '</form>' +
          '<div class="form-note">' + c.emailNote + '</div><button id="dl-back" class="btn-text" style="margin-top:12px">← different machine</button>';
        return;
      }
      body.innerHTML = '<h3 class="modal-title"><span class="success-check">✓</span> ' + c.successTitle + '</h3><p class="modal-subtitle">' + c.successBody + '</p>' +
        (isDownloadOS(dm.os)
          ? '<div class="success-link"><a href="/dl?ref=landing-modal-again' + (dm.os === 'windows' ? '&os=windows' : '') + '">didn’t start? download again</a></div>'
          : '');
    };
    const openDl = () => { dm.os = null; dm.email = ''; dm.phoneCode = '+1'; dm.phone = ''; dm.sent = false; renderDl(); $('modal-download').classList.add('is-open'); };
    const closeDl = () => $('modal-download').classList.remove('is-open');
    $('btn-download-nav').addEventListener('click', openDl);
    if ($('btn-download-faq')) $('btn-download-faq').addEventListener('click', openDl);
    $('btn-close-download').addEventListener('click', closeDl);
    $('modal-download').addEventListener('click', (e) => { if (e.target.id === 'modal-download') closeDl(); });
    $('modal-download-body').addEventListener('click', (e) => {
      const os = e.target.closest('[data-os]'); if (os) { dm.os = os.dataset.os; renderDl(); return; }
      if (e.target.id === 'dl-back') { dm.os = null; renderDl(); }
    });
    $('modal-download-body').addEventListener('change', (e) => {
      if (e.target.id !== 'dl-phone-code') return;
      // Direct DOM update (not a full render()) so the number the user already typed isn't wiped.
      dm.phoneCode = e.target.value;
      const input = $('dl-phone');
      if (input) input.placeholder = COUNTRY_CODE_PLACEHOLDERS[e.target.value] || '';
    });
    $('modal-download-body').addEventListener('submit', (e) => {
      if (e.target.id !== 'dl-form') return; e.preventDefault();
      const v = $('dl-email').value.trim(); if (!EMAIL_RE.test(v)) return;

      const phoneDigits = ($('dl-phone').value || '').trim();
      const phoneCode = $('dl-phone-code').value;
      const phone = phoneDigits ? (phoneCode + ' ' + phoneDigits) : '';

      dm.email = v; dm.phoneCode = phoneCode; dm.phone = phoneDigits; dm.sent = true;

      fetch('/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: v, source: isDownloadOS(dm.os) ? 'download' : 'waitlist', os: dm.os, phone }),
      }).catch(() => { /* non-fatal: the confirmation UI has already been shown */ });

      if (isDownloadOS(dm.os)) {
        $('dl-frame').src = '/dl?ref=landing-modal' + (dm.os === 'windows' ? '&os=windows' : '');
      }
      renderDl();
    });

    // ── connect modal ──
    $('btn-connect').addEventListener('click', () => $('modal-connect').classList.add('is-open'));
    $('btn-close-connect').addEventListener('click', () => $('modal-connect').classList.remove('is-open'));
    $('modal-connect').addEventListener('click', (e) => { if (e.target.id === 'modal-connect') $('modal-connect').classList.remove('is-open'); });
    this._esc = (e) => { if (e.key === 'Escape') { closeDl(); $('modal-connect').classList.remove('is-open'); } };
    document.addEventListener('keydown', this._esc);

    // ── intro cinematic ──
    if ($('intro-cinema')) {
    const INTRO_SEEN_KEY = 'meridian-intro-seen';
    let introSeen = false; try { introSeen = localStorage.getItem(INTRO_SEEN_KEY) === '1'; } catch (e) {}
    const markIntroSeen = () => { try { localStorage.setItem(INTRO_SEEN_KEY, '1'); } catch (e) {} };
    const introEl = $('intro-cinema'), introFrame = $('intro-frame'), introStmt = $('intro-statement'), replayBtn = $('replay-intro');
    const heroTitle = document.querySelector('.hero__title');
    const noteMon = document.querySelector('.hero__note-monitor');
    const heroEls = [document.querySelector('.hero__subtitle'), document.querySelector('.hero__pointer'), $('hero-embed-wrap'), document.querySelector('.trust-strip')];
    const buildStatement = () => {
      const mk = (text, grad, base) => text.split(' ').map((w, i) => '<span class="intro-word' + (grad ? ' intro-word--grad' : '') + '" style="animation-delay:' + (base + i * 0.2).toFixed(2) + 's">' + w + '</span>').join(' ');
      introStmt.innerHTML =
        '<div class="intro-statement__l1">' + mk('You did more than you think', false, 0) + '<span class="intro-ellipsis" id="intro-dots"><span></span><span></span><span></span></span></div>' +
        '<div class="intro-statement__l2">' + mk('Don’t let your work go unnoticed.', true, 2.7) + '</div>';
    };
    let introActive = false, introEnding = false, introTimers = [];
    const clearIntroTimers = () => { introTimers.forEach(clearTimeout); introTimers = []; };
    const heroHide = () => {
      if (heroTitle) { heroTitle.style.transition = 'none'; heroTitle.style.transform = ''; heroTitle.style.opacity = '0'; }
      heroEls.forEach((el) => { if (el) { el.style.transition = 'none'; el.style.opacity = '0'; } });
      if (noteMon) noteMon.classList.remove('is-in');
    };
    const heroClear = () => {
      if (heroTitle) { heroTitle.style.transition = ''; heroTitle.style.transform = ''; heroTitle.style.transformOrigin = ''; heroTitle.style.opacity = ''; }
      heroEls.forEach((el) => { if (el) { el.style.transition = ''; el.style.opacity = ''; } });
    };
    const startIntro = (reload) => {
      clearIntroTimers(); introEnding = false; introActive = true;
      document.documentElement.classList.add('intro-lock');
      window.scrollTo(0, 0);
      heroHide();
      introStmt.classList.remove('is-on');
      introFrame.classList.remove('is-dim');
      introEl.classList.remove('is-hidden');
      introEl.style.display = 'flex'; void introEl.offsetWidth;
      replayBtn.classList.remove('is-visible');
      if (reload) introFrame.src = '/demo?t=' + Date.now();
    };
    const endIntro = (instant) => {
      if (!introActive || introEnding) return; introEnding = true;
      markIntroSeen();
      if (instant) {
        // "Skip intro" — drop straight into the site, no cinematic wind-down,
        // and no lingering full-screen overlay left silently eating clicks.
        clearIntroTimers();
        const d = document.getElementById('intro-dots'); if (d) d.style.display = '';
        introEl.style.display = 'none';
        introEl.classList.remove('is-hidden');
        introStmt.classList.remove('is-on');
        heroClear();
        if (noteMon) noteMon.classList.add('is-in');
        document.documentElement.classList.remove('intro-lock');
        introActive = false;
        replayBtn.classList.add('is-visible');
        return;
      }
      introFrame.classList.add('is-dim');
      // 1. the statement reveals word by word, line one, then a beat, then line two
      introTimers.push(setTimeout(() => { buildStatement(); introStmt.classList.add('is-on'); }, 460));
      // 2. hand the motion to the REAL headline: start it exactly where the statement is,
      //    then glide it up to its resting place while the dark overlay fades away.
      const SETTLE = 460 + 5100;
      introTimers.push(setTimeout(() => {
        const d = document.getElementById('intro-dots'); if (d) d.style.display = 'none';
        if (heroTitle) {
          const hr = heroTitle.getBoundingClientRect(), sr = introStmt.getBoundingClientRect();
          const scale = hr.width ? Math.min(1.7, Math.max(1, sr.width / hr.width)) : 1;
          const dx = (sr.left + sr.width / 2) - (hr.left + hr.width / 2);
          const dy = (sr.top + sr.height / 2) - (hr.top + hr.height / 2);
          heroTitle.style.transition = 'none';
          heroTitle.style.transformOrigin = 'center center';
          heroTitle.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + scale + ')';
          heroTitle.style.opacity = '1';
          void heroTitle.offsetWidth;
          heroTitle.style.transition = 'transform 1.05s cubic-bezier(.16,.84,.3,1)';
          heroTitle.style.transform = 'none';
        }
        introEl.classList.add('is-hidden');
      }, SETTLE));
      // 3. the rest of the page eases in beneath the settling headline
      introTimers.push(setTimeout(() => {
        heroEls.forEach((el) => { if (el) { el.style.transition = 'opacity .7s ease'; el.style.opacity = '1'; } });
        if (noteMon) noteMon.classList.add('is-in');
      }, SETTLE + 520));
      // 4. clean up
      introTimers.push(setTimeout(() => {
        introEl.style.display = 'none'; introEl.classList.remove('is-hidden'); introStmt.classList.remove('is-on');
        heroClear();
        document.documentElement.classList.remove('intro-lock'); introActive = false; replayBtn.classList.add('is-visible');
      }, SETTLE + 1250));
    };
    this._introMsg = (e) => { if (e && e.data && e.data.type === 'meridian-intro-done') endIntro(false); };
    window.addEventListener('message', this._introMsg);
    $('intro-skip').addEventListener('click', () => endIntro(true));
    replayBtn.addEventListener('click', () => startIntro(true));
    if (introSeen) {
      // Returning visitor — the intro already played once; go straight to the
      // site instead of autoplaying the cinematic again.
      introEl.style.display = 'none';
      if (noteMon) noteMon.classList.add('is-in');
      replayBtn.classList.add('is-visible');
    } else {
      startIntro(false);
    }
    }

    // ── why: scroll-jacked stage ──
    const scr = $('why-scrolly');
    if (scr && window.innerWidth > 760) {
      const panels = [...scr.querySelectorAll('.scrolly__panel')];
      const rail = [...scr.querySelectorAll('.scrolly__rail-item')];
      const steps = panels.length;
      if (steps) {
        scr.style.setProperty('--steps', steps);
        scr.classList.add('is-ready');
        let active = -1;
        const setActive = (idx) => {
          active = idx;
          panels.forEach((el, i) => el.classList.toggle('is-active', i === idx));
          rail.forEach((el, i) => el.classList.toggle('is-active', i === idx));
        };
        const measureIntro = () => { const intro = document.querySelector('.why__intro'); if (intro) document.documentElement.style.setProperty('--intro-h', intro.offsetHeight + 'px'); };
        const update = () => {
          const vh = window.innerHeight; const rect = scr.getBoundingClientRect(); const total = scr.offsetHeight - vh;
          let p = total > 0 ? (-rect.top) / total : 0; p = Math.max(0, Math.min(0.99999, p));
          const idx = Math.floor(p * steps); if (idx !== active) setActive(idx);
        };
        setActive(0); measureIntro(); update();
        this._scroll = update; this._introM = measureIntro;
        window.addEventListener('scroll', this._scroll, { passive: true });
        window.addEventListener('resize', this._scroll, { passive: true });
        window.addEventListener('resize', this._introM, { passive: true });
        scr.querySelectorAll('[data-jump-step]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-jump-step'), 10) || 0;
            const vh = window.innerHeight; const total = scr.offsetHeight - vh; if (total <= 0) return;
            window.scrollTo({ top: scr.offsetTop + total * ((idx + 0.5) / steps), behavior: 'smooth' });
          });
        });
      }
    }

    // ── writing-page subscribe form ("the field notes letter") ──
    const subForm = $('subscribe-form');
    if (subForm) {
      subForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = $('subscribe-email');
        const msg = $('subscribe-msg');
        const btn = subForm.querySelector('button[type="submit"]');
        const email = (input.value || '').trim();
        if (!EMAIL_RE.test(email)) return;
        btn.disabled = true;
        btn.textContent = 'Subscribing…';
        fetch('/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.success) {
              subForm.style.display = 'none';
              msg.textContent = 'You’re on the list. The next essay lands in your inbox.';
            } else {
              msg.textContent = data.error || 'Something went wrong. Please try again.';
              btn.disabled = false;
              btn.textContent = 'Subscribe';
            }
          })
          .catch(() => {
            msg.textContent = 'Something went wrong. Please try again.';
            btn.disabled = false;
            btn.textContent = 'Subscribe';
          });
      });
    }
});
