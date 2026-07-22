/*
 * PostHog product analytics — same project/key as the root site's
 * (../../index.html). The <script> tag itself loads async; PostHog only
 * actually boots and starts capturing once the visitor has accepted the
 * cookie consent banner (CookieConsent in site.js) — see CONSENT_KEY below.
 */
(function () {
  var KEY = 'phc_zaKjKC5K7GoexwGJH9kePAq56PbA2EdcemKMMrthivmD'; // PostHog write-only key (safe in public apps)
  var HOST = 'https://us.i.posthog.com'; // use https://eu.i.posthog.com for EU
  var CONSENT_KEY = 'meridian-consent';
  if (!KEY) return;

  function boot() {
  !function (t, e) {
    var o, n, p, r;
    e.__SV || (window.posthog = e, e._i = [], e.init = function (i, s, a) {
      function g(t, e) {
        var o = e.split('.');
        2 == o.length && (t = t[o[0]], e = o[1]);
        t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); };
      }
      (p = t.createElement('script')).type = 'text/javascript';
      p.crossOrigin = 'anonymous';
      p.async = !0;
      p.src = s.api_host.replace('.i.posthog.com', '-assets.i.posthog.com') + '/static/array.js';
      (r = t.getElementsByTagName('script')[0]).parentNode.insertBefore(p, r);
      var u = e;
      for (void 0 !== a ? u = e[a] = [] : a = 'posthog', u.people = u.people || [],
        u.toString = function (t) { var e = 'posthog'; return 'posthog' !== a && (e += '.' + a), t || (e += ' (stub)'), e; },
        u.people.toString = function () { return u.toString(1) + '.people (stub)'; },
        o = 'init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId'.split(' '),
        n = 0; n < o.length; n++) g(u, o[n]);
      e._i.push([i, s, a]);
    }, e.__SV = 1);
  }(document, window.posthog || []);
  posthog.init(KEY, { api_host: HOST, defaults: '2026-05-30', person_profiles: 'identified_only' });
  }

  var consent;
  try { consent = localStorage.getItem(CONSENT_KEY); } catch (e) {}
  if (consent === 'granted') {
    boot();
  } else if (consent !== 'denied') {
    window.addEventListener('meridian:consent-granted', boot, { once: true });
  }
})();
