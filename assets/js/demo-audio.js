/* Meridiona demo — synthesized UI foley.
   No audio files: every cue is generated with the Web Audio API so it can be
   tuned per event and layered cleanly under a voiceover / background music.
   Exposes window.MeridianAudio.play(name) plus setMuted / isMuted. */
(function () {
  var ctx = null, master = null, muted = false;
  try { muted = localStorage.getItem('meridian-sfx-muted') === '1'; } catch (e) {}

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }

  // one shaped oscillator voice
  function voice(opts) {
    if (!ensure()) return;
    var t0 = ctx.currentTime + (opts.delay || 0);
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(opts.f0, t0);
    if (opts.f1 != null) o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.f1), t0 + opts.dur);
    if (opts.detune) o.detune.value = opts.detune;
    var peak = opts.gain == null ? 0.08 : opts.gain;
    var atk = opts.attack == null ? 0.006 : opts.attack;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    var node = o;
    if (opts.filter) {
      var bp = ctx.createBiquadFilter();
      bp.type = opts.filter; bp.frequency.value = opts.filterFreq || 1200; bp.Q.value = opts.q || 1;
      o.connect(bp); bp.connect(g);
    } else { o.connect(g); }
    g.connect(master);
    o.start(t0); o.stop(t0 + opts.dur + 0.02);
  }

  // short filtered-noise burst (whoosh / texture)
  function noise(opts) {
    if (!ensure()) return;
    var t0 = ctx.currentTime + (opts.delay || 0);
    var dur = opts.dur || 0.3;
    var buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(opts.f0 || 700, t0);
    if (opts.f1 != null) bp.frequency.exponentialRampToValueAtTime(opts.f1, t0 + dur);
    bp.Q.value = opts.q || 0.8;
    var g = ctx.createGain();
    var peak = opts.gain == null ? 0.05 : opts.gain;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  var CUES = {
    // cursor click — clean, soft rounded click
    click: function () {
      voice({ type: 'sine', f0: 1120, f1: 760, dur: 0.045, gain: 0.05, attack: 0.001, filter: 'lowpass', filterFreq: 2400 });
      voice({ type: 'sine', f0: 2400, dur: 0.02, gain: 0.02, attack: 0.001 });
    },
    // click-to-action confirmed — clean rising two-note "ti-dink"
    posted: function () {
      voice({ type: 'sine', f0: 987.77, dur: 0.1, gain: 0.05, attack: 0.003 });
      voice({ type: 'sine', f0: 1318.51, dur: 0.24, gain: 0.05, attack: 0.004, delay: 0.085 });
    }
  };

  window.MeridianAudio = {
    play: function (name) { if (muted) return; var c = CUES[name]; if (c) { try { c(); } catch (e) {} } },
    unlock: function () { ensure(); },
    isMuted: function () { return muted; },
    setMuted: function (m) {
      muted = !!m;
      try { localStorage.setItem('meridian-sfx-muted', muted ? '1' : '0'); } catch (e) {}
      return muted;
    },
    toggle: function () { return this.setMuted(!muted); }
  };

  // resume the context on the first real user gesture (autoplay policy)
  function kick() { ensure(); }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, kick, { once: false, passive: true });
  });
})();
