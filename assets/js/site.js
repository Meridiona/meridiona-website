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
    const DL = {
      mac: { emailNote: 'macOS 14+ · Apple Silicon (M1 or later)', successTitle: 'Download started', successBody: 'Meridian.dmg is on its way. Drag it to Applications and look for the diamond in your menu bar.' },
      windows: { emailNote: 'Windows 10/11 · 64-bit', successTitle: 'Download started', successBody: 'Meridian-setup.exe is on its way. Run it, and look for the diamond in your system tray.' },
      linux: { emailTitle: 'Get in line', emailPrompt: 'Meridian doesn’t speak penguin yet. Leave your email — you’ll be the first ping when it does.', ctaLabel: 'Join the waitlist', emailNote: 'No spam. One email, the day it ships.', successTitle: 'Saved you a spot', successBody: 'Linux is coming. You’re at the front of the queue — we’ll ping you the day it lands.' },
      other: { emailTitle: 'Get in line', emailPrompt: 'We don’t have a build for your device yet. Leave your email — you’ll be the first to know when we do.', ctaLabel: 'Join the waitlist', emailNote: 'No spam. One email, the day it ships.', successTitle: 'Saved you a spot', successBody: 'We’ll ping you the day Meridian lands on your platform.' },
    };
    const EMAIL_RE = /\S+@\S+\.\S+/;
    const isDownloadOS = (os) => os === 'mac' || os === 'windows';
    // Best-effort client detection so the right build starts downloading without
    // asking — mobile checked first since Android UAs also match /Linux/ and
    // iPadOS reports platform "MacIntel" like a real Mac.
    const detectOS = () => {
      const ua = navigator.userAgent || '';
      const platform = navigator.platform || '';
      if (/Android/i.test(ua)) return null;
      if (/iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return null;
      if (/Mac/i.test(platform)) return 'mac';
      if (/Win/i.test(platform)) return 'windows';
      if (/Linux/i.test(platform)) return 'linux';
      return null;
    };
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
    const phoneCodeLabel = (code) => {
      const cc = COUNTRY_CODES.find((c) => c.code === code);
      return cc ? cc.code + ' ' + cc.name : code;
    };
    // As-you-type US/Canada formatting — (201) 555-0123 — so the number reads
    // as a real US number instead of a raw digit string; other countries are
    // left as typed since their formats vary too much to guess.
    const formatUSPhone = (raw) => {
      const digits = (raw || '').replace(/\D/g, '').slice(0, 10);
      if (!digits) return '';
      if (digits.length < 4) return '(' + digits;
      if (digits.length < 7) return '(' + digits.slice(0, 3) + ') ' + digits.slice(3);
      return '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
    };

    // ── country-code combobox + phone input ──
    // Two forms need this field (the download modal and the waitlist modal), so
    // it's a factory over an id prefix and a state object owning
    // { phoneCode, phone }. bind() attaches delegated handlers to whatever
    // container the field is rendered into, so the container can re-render the
    // markup underneath without rebinding anything.
    const phoneCodeField = (prefix, state) => {
      const codeId = prefix + '-phone-code-input';
      const listId = prefix + '-phone-code-list';
      const phoneId = prefix + '-phone';
      const listEl = () => $(listId);
      const codeEl = () => $(codeId);
      const phoneEl = () => $(phoneId);

      const html = () =>
        '<div class="phone-row">' +
          '<div class="phone-code">' +
            '<input id="' + codeId + '" class="phone-select" type="text" autocomplete="off" spellcheck="false" placeholder="Search" ' +
              'value="' + phoneCodeLabel(state.phoneCode) + '" aria-label="Country code" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="' + listId + '">' +
            '<div id="' + listId + '" class="phone-code-list" role="listbox" hidden></div>' +
          '</div>' +
          '<input id="' + phoneId + '" class="phone-input" type="tel" inputmode="tel" placeholder="' + (COUNTRY_CODE_PLACEHOLDERS[state.phoneCode] || '') + '" value="' + state.phone + '" aria-label="Phone number (optional)">' +
        '</div>';

      const renderList = (query) => {
        const list = listEl();
        if (!list) return;
        const q = (query || '').trim().toLowerCase();
        const matches = q
          ? COUNTRY_CODES.filter((cc) => cc.name.toLowerCase().includes(q) || cc.code.includes(q))
          : COUNTRY_CODES;
        list.innerHTML = matches.length
          ? matches.map((cc) =>
              '<button type="button" class="phone-code-option' + (cc.code === state.phoneCode ? ' is-active' : '') + '" data-code="' + cc.code + '" role="option">' +
                '<span class="phone-code-option__code">' + cc.code + '</span><span class="phone-code-option__name">' + cc.name + '</span>' +
              '</button>').join('')
          : '<div class="phone-code-empty">No matches</div>';
      };
      const openList = () => {
        const list = listEl(), input = codeEl();
        if (!list || !input) return;
        renderList('');
        list.hidden = false;
        input.setAttribute('aria-expanded', 'true');
      };
      const closeList = () => {
        const list = listEl(), input = codeEl();
        if (!list || !input) return;
        list.hidden = true;
        input.setAttribute('aria-expanded', 'false');
      };
      const select = (code) => {
        state.phoneCode = code;
        const input = codeEl();
        if (input) input.value = phoneCodeLabel(code);
        const tel = phoneEl();
        if (tel) {
          tel.placeholder = COUNTRY_CODE_PLACEHOLDERS[code] || '';
          tel.value = code === '+1'
            ? formatUSPhone(tel.value)
            : tel.value.replace(/[()]/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
        }
        closeList();
      };

      const bind = (root) => {
        // focusin/focusout (not focus/blur, which don't bubble) so the combobox
        // opens the instant the field is clicked into.
        root.addEventListener('focusin', (e) => { if (e.target.id === codeId) { e.target.value = ''; openList(); } });
        root.addEventListener('focusout', (e) => {
          if (e.target.id === codeId) { e.target.value = phoneCodeLabel(state.phoneCode); closeList(); }
        });
        // mousedown (fires before blur) + preventDefault so clicking an option
        // selects it instead of the input just losing focus first.
        root.addEventListener('mousedown', (e) => {
          const opt = e.target.closest('.phone-code-option');
          if (opt) { e.preventDefault(); select(opt.dataset.code); }
        });
        root.addEventListener('keydown', (e) => {
          if (e.target.id !== codeId) return;
          if (e.key === 'Escape') { e.target.blur(); return; }
          if (e.key === 'Enter') {
            e.preventDefault();
            const first = listEl() && listEl().querySelector('.phone-code-option');
            if (first) select(first.dataset.code);
          }
        });
        root.addEventListener('input', (e) => {
          if (e.target.id === codeId) { renderList(e.target.value); return; }
          if (e.target.id === phoneId && state.phoneCode === '+1') {
            const formatted = formatUSPhone(e.target.value);
            e.target.value = formatted;
            e.target.setSelectionRange(formatted.length, formatted.length);
          }
        });
      };

      // National number as typed, kept in sync on state so a re-render restores it.
      const digits = () => { const tel = phoneEl(); return tel ? tel.value.trim() : ''; };
      // Dial code + number, or '' when the (optional) field was left blank.
      const value = () => { const d = digits(); return d ? state.phoneCode + ' ' + d : ''; };
      return { html, bind, digits, value };
    };

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

    // ── faq ── (content is server-rendered in index.html so crawlers that don't
    // execute JS still see every question/answer; this just wires up the
    // accordion's expand/collapse interaction on top of it)
    const faqList = $('faq-list');
    if (faqList) {
      const items = [...faqList.querySelectorAll('.faq-item')];
      const setOpen = (item, open) => {
        item.classList.toggle('is-open', open);
        const btn = item.querySelector('[data-faq-idx]');
        btn.setAttribute('aria-expanded', String(open));
        item.querySelector('.faq-item__icon').textContent = open ? '−' : '+';
      };
      faqList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-faq-idx]');
        if (!btn) return;
        const item = btn.closest('.faq-item');
        const opening = !item.classList.contains('is-open');
        items.forEach((el) => setOpen(el, el === item && opening));
      });
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
    // dm.os is auto-detected on open and the real build starts downloading
    // immediately (see fireDownload below) — the email/phone form beneath it
    // is an optional "get updates" ask, not a gate. "see other download
    // options" falls back to the manual os-picker, both for when detection
    // guesses wrong and for browsing what's available/coming soon.
    const dm = { os: null, showPicker: false, email: '', phoneCode: '+1', phone: '', sent: false };
    const dlPhone = phoneCodeField('dl', dm);
    const fireDownload = (ref) => { $('dl-frame').src = '/dl?ref=' + ref + (dm.os === 'windows' ? '&os=windows' : ''); };
    const osPickerHtml = () =>
      '<h3 class="modal-title">Get Meridian</h3><p class="modal-subtitle">What are you running?</p><div class="os-picker">' +
        '<button class="os-option os-option--primary" data-os="mac"><span class="os-option__name">macOS</span><span class="os-option__meta os-option__meta--accent">Apple Silicon · ready today</span></button>' +
        '<button class="os-option" data-os="windows"><span class="os-option__name">Windows</span><span class="os-option__meta os-option__meta--accent">10/11 · ready today</span></button>' +
        '<button class="os-option" data-os="linux"><span class="os-option__name">Linux</span><span class="os-option__meta">coming soon · join waitlist</span></button></div>';
    const backLinkHtml = (marginTop) => '<button id="dl-back" class="btn-text" style="margin-top:' + marginTop + 'px">← see other download options</button>';
    const emailFormHtml = (ctaLabel, required) => {
      return '<form id="dl-form" class="email-form">' +
          '<input id="dl-email" class="email-input" type="email"' + (required ? ' required autofocus' : '') + ' placeholder="you@work.com" value="' + dm.email + '" aria-label="Email address">' +
          '<p id="dl-email-error" class="form-error" style="display:none">Enter a valid email address to continue.</p>' +
          '<p class="phone-hint">📱 Got a number? (Totally optional) Drop it below so we can text you when we ship fixes, ask what broke, or just say thanks — never spam.</p>' +
          dlPhone.html() +
          '<button type="submit" class="btn-primary btn-primary--block">' + ctaLabel + '</button>' +
        '</form>';
    };
    const renderDl = () => {
      const body = $('modal-download-body');
      if (dm.showPicker) { body.innerHTML = osPickerHtml(); return; }
      const c = DL[dm.os];
      if (isDownloadOS(dm.os)) {
        const againLink = '<div class="success-link"><a href="/dl?ref=landing-modal-again' + (dm.os === 'windows' ? '&os=windows' : '') + '">didn’t start? download again</a></div>';
        if (dm.sent) {
          body.innerHTML = '<h3 class="modal-title"><span class="success-check">✓</span> ' + c.successTitle + '</h3><p class="modal-subtitle">' + c.successBody + '</p>' +
            '<div class="form-note">You’re on the list for updates too.</div>' + againLink + backLinkHtml(16);
          return;
        }
        body.innerHTML = '<h3 class="modal-title"><span class="success-check">✓</span> ' + c.successTitle + '</h3><p class="modal-subtitle">' + c.successBody + '</p>' + againLink +
          '<div class="form-note" style="margin-top:20px">Want a ping for updates/fixes? (optional)</div>' +
          emailFormHtml('Join →', false) +
          backLinkHtml(4);
        return;
      }
      if (!dm.sent) {
        body.innerHTML = '<h3 class="modal-title">' + c.emailTitle + '</h3><p class="modal-subtitle">' + c.emailPrompt + '</p>' +
          emailFormHtml(c.ctaLabel, true) +
          '<div class="form-note">' + c.emailNote + '</div>' + backLinkHtml(12);
        return;
      }
      body.innerHTML = '<h3 class="modal-title"><span class="success-check">✓</span> ' + c.successTitle + '</h3><p class="modal-subtitle">' + c.successBody + '</p>' + backLinkHtml(16);
    };
    const openDl = () => {
      dm.os = detectOS() || 'other'; dm.showPicker = false; dm.email = ''; dm.phoneCode = '+1'; dm.phone = ''; dm.sent = false;
      renderDl();
      $('modal-download').classList.add('is-open');
      if (isDownloadOS(dm.os)) fireDownload('landing-modal-auto');
    };
    const closeDl = () => $('modal-download').classList.remove('is-open');
    $('btn-download-nav').addEventListener('click', openDl);
    if ($('btn-download-faq')) $('btn-download-faq').addEventListener('click', openDl);
    $('btn-close-download').addEventListener('click', closeDl);
    $('modal-download').addEventListener('click', (e) => { if (e.target.id === 'modal-download') closeDl(); });
    $('modal-download-body').addEventListener('click', (e) => {
      const os = e.target.closest('[data-os]');
      if (os) {
        dm.os = os.dataset.os; dm.showPicker = false; dm.sent = false;
        renderDl();
        if (isDownloadOS(dm.os)) fireDownload('landing-modal-manual');
        return;
      }
      if (e.target.id === 'dl-back') { dm.showPicker = true; renderDl(); }
    });
    // Country combobox + phone formatting; everything below only deals with email.
    dlPhone.bind($('modal-download-body'));
    // focusin/focusout (not focus/blur, which don't bubble) so the email
    // placeholder disappears the instant the field is clicked into, not just
    // once the user starts typing.
    $('modal-download-body').addEventListener('focusin', (e) => {
      if (e.target.id === 'dl-email' && !e.target.value) {
        e.target.dataset.ph = e.target.placeholder;
        e.target.placeholder = '';
      }
    });
    $('modal-download-body').addEventListener('focusout', (e) => {
      if (e.target.id === 'dl-email' && !e.target.value && e.target.dataset.ph) {
        e.target.placeholder = e.target.dataset.ph;
      }
    });
    $('modal-download-body').addEventListener('input', (e) => {
      if (e.target.id === 'dl-email') {
        e.target.classList.remove('email-input--error');
        const err = $('dl-email-error');
        if (err) err.style.display = 'none';
      }
    });
    $('modal-download-body').addEventListener('submit', (e) => {
      if (e.target.id !== 'dl-form') return; e.preventDefault();
      const input = $('dl-email');
      const v = input.value.trim();
      if (!EMAIL_RE.test(v)) {
        input.classList.add('email-input--error');
        const err = $('dl-email-error');
        if (err) err.style.display = 'block';
        input.focus();
        return;
      }

      const phone = dlPhone.value();
      dm.email = v; dm.phone = dlPhone.digits(); dm.sent = true;

      fetch('/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: v, source: isDownloadOS(dm.os) ? 'download' : 'waitlist', os: dm.os, phone }),
      }).catch(() => { /* non-fatal: the confirmation UI has already been shown */ });

      // The download itself already fired on open/pick for mac/windows (fireDownload) —
      // this form only ever gates the waitlist signup for unsupported platforms.
      renderDl();
    });

    // ── connect modal ──
    $('btn-connect').addEventListener('click', () => $('modal-connect').classList.add('is-open'));
    $('btn-close-connect').addEventListener('click', () => $('modal-connect').classList.remove('is-open'));
    $('modal-connect').addEventListener('click', (e) => { if (e.target.id === 'modal-connect') $('modal-connect').classList.remove('is-open'); });
    // ── waitlist modal ──
    // The form markup is server-rendered in index.html (so it's visible without
    // JS and to crawlers); this only owns the "Other" reveal, validation, submit
    // and the success swap. Unlike the download modal's /subscribe call, a
    // failure here is shown to the user — nothing else captured the lead.
    let closeWaitlist = null;
    if ($('modal-waitlist')) {
      const wl = { phoneCode: '+1', phone: '', sending: false };
      const wlPhone = phoneCodeField('wl', wl);
      const openWl = () => { $('modal-waitlist').classList.add('is-open'); const n = $('wl-name'); if (n) n.focus(); };
      const closeWl = () => $('modal-waitlist').classList.remove('is-open');
      const wlError = (msg) => {
        const err = $('wl-error');
        err.textContent = msg || '';
        err.style.display = msg ? 'block' : 'none';
      };

      $('wl-phone-slot').innerHTML = wlPhone.html();
      wlPhone.bind($('modal-waitlist'));

      document.querySelectorAll('[data-waitlist-open]').forEach((btn) => btn.addEventListener('click', openWl));
      $('btn-close-waitlist').addEventListener('click', closeWl);
      $('modal-waitlist').addEventListener('click', (e) => { if (e.target.id === 'modal-waitlist') closeWl(); });

      // "Other" is a real answer, not a dead end — picking it reveals a free-text
      // field so we learn what the role actually is.
      $('wl-profession').addEventListener('click', (e) => {
        const opt = e.target.closest('[data-profession]');
        if (!opt) return;
        $('wl-profession').querySelectorAll('.profession-option').forEach((b) => {
          b.classList.toggle('is-active', b === opt);
          b.setAttribute('aria-pressed', String(b === opt));
        });
        $('wl-profession-input').value = opt.dataset.profession;
        const other = $('wl-profession-other');
        other.hidden = opt.dataset.profession !== 'other';
        if (!other.hidden) other.focus(); else other.value = '';
        wlError('');
      });

      $('wl-form').addEventListener('input', () => wlError(''));
      $('wl-form').addEventListener('submit', (e) => {
        e.preventDefault();
        if (wl.sending) return;

        const name = $('wl-name').value.trim();
        const email = $('wl-email').value.trim();
        const profession = $('wl-profession-input').value;
        const professionOther = $('wl-profession-other').value.trim();
        const linkedin = $('wl-linkedin').value.trim();

        if (!name) return wlError('What should we call you?');
        if (!EMAIL_RE.test(email)) return wlError('That email address doesn’t look right.');
        if (!profession) return wlError('Pick what you do — it shapes what we build first.');
        if (profession === 'other' && !professionOther) return wlError('Tell us what you do.');

        wl.phone = wlPhone.digits();
        wl.sending = true;
        const submit = $('wl-submit');
        submit.disabled = true;
        submit.textContent = 'Joining…';

        fetch('/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, profession, professionOther, phone: wlPhone.value(), linkedin }),
        })
          .then((res) => res.json().catch(() => ({})).then((data) => ({ ok: res.ok, data })))
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data.error || 'Something went wrong. Please try again.');
            $('wl-form').hidden = true;
            $('wl-intro').hidden = true;
            $('wl-done').hidden = false;
          })
          .catch((err) => wlError(err.message || 'Something went wrong. Please try again.'))
          .finally(() => {
            wl.sending = false;
            submit.disabled = false;
            submit.textContent = 'Join the waitlist →';
          });
      });

      closeWaitlist = closeWl;
    }

    this._esc = (e) => {
      if (e.key !== 'Escape') return;
      closeDl();
      $('modal-connect').classList.remove('is-open');
      if (closeWaitlist) closeWaitlist();
    };
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
