/*
 * Meridian hero timeline — the CURRENT dashboard timeline UI (ported verbatim
 * from new/assets/js/demo.js: multi-lane duration-proportional task bands +
 * "today at a glance" panel) wrapped in an animated INTRO sequence:
 *
 *   1. teaser  — a clock sweeps from morning through to night while the
 *                timeline sits dark behind a scrim
 *   2. question — a relatable "what did you actually get done?" prompt
 *   3. rewind  — the clock spins back to 9 AM
 *   4. build   — the clock ticks hour by hour; a descending "now" line
 *                replays the day, dropping each task row in as it's reached,
 *                merging multi-sitting tasks into one card
 *   5. handoff — everything stabilises into the exact static timeline, the
 *                panel slides in, an "it's live — poke around" note appears,
 *                and the UI becomes fully interactive
 *
 * The rendered timeline/panel/toolbar are byte-for-byte the real demo, so the
 * end state IS the product screen; only the orchestration on top is new.
 */
function createDemo(refs, opts) {
  'use strict';
  opts = opts || {};

  var DAY_START_LABEL = 9;      // 9 AM
  var DAY_WINDOW_MIN = 510;     // hour rail through 5:30 PM
  var PXPM = 1.05;              // px per minute

  var APP_COLORS = {
    'Claude Code': '#D97757', 'VS Code': '#4F8FEF', 'Jira': '#2684FF', 'Slack': '#4A154B',
    'Zoom': '#2D8CFF', 'iTerm': '#25A06A', 'GitHub': '#24292F', 'Postman': '#FF6C37',
    'Google Chrome': '#4285F4', 'System Settings': '#6E6E76', 'Microsoft Teams': '#5059C9',
  };
  var BRAND_ICONS = {
    'Claude Code': { viewBox: '0 0 24 24', hex: '#D97757',
      path: 'M21 10.5h3v3h-3v3h-1.5v3H18v-3h-1.5v3H15v-3H9v3H7.5v-3H6v3H4.5v-3H3v-3H0v-3h3v-6h18Zm-15 0h1.5v-3H6Zm10.5 0H18v-3h-1.5z' },
    'Google Chrome': { viewBox: '0 0 256 256', hex: '#4285F4', multi: true,
      inner: '<path d="M128.002654,199.216326 C167.337748,199.216326 199.224237,167.328341 199.224237,127.993248 C199.224237,88.658154 167.337748,56.7701695 128.002654,56.7701695 C88.66756,56.7701695 56.781071,88.658154 56.781071,127.993248 C56.781071,167.328341 88.66756,199.216326 128.002654,199.216326 Z" fill="#FFFFFF"/><path d="M35.890016,92.996518 C30.576952,83.7939923 24.3316171,74.1352001 17.1540112,64.0201413 C5.91689083,83.47748 0,105.549915 0,128.020125 C0,150.490334 5.91420317,172.562769 17.1499797,192.020108 C28.3857563,211.477446 44.546676,227.635678 64.0067024,238.86608 C83.4667287,250.096481 105.541852,256.006653 128.010717,256.001571 C139.791711,239.477878 147.790451,227.56439 152.006937,220.261105 C160.105922,206.233028 170.580388,186.149338 183.430335,160.010037 L183.430335,159.995255 C177.81715,169.729972 169.739377,177.814463 160.010037,183.435711 C140.208035,194.876125 115.80601,194.879711 96.0006467,183.445118 C86.2698509,177.826524 78.189991,169.74481 72.5736292,160.012725 C55.1202938,127.463816 42.8924227,105.12508 35.890016,92.996518 Z" fill="#229342"/><path d="M128.008029,255.995986 C150.476894,255.999935 172.550674,250.08573 192.009357,238.852641 C211.468039,227.619552 227.626271,211.459977 238.85936,191.999951 C250.091893,172.54016 256.003521,150.466219 256,127.99728 C255.995901,105.528414 250.076323,83.4559788 238.836515,63.9999839 C214.588793,61.6102423 196.693555,60.4153715 185.1508,60.4153715 C172.062912,60.4153715 153.012186,61.6102423 127.998622,63.9999839 L127.985184,64.0093907 C139.221488,64.0040515 150.261129,66.957349 159.993911,72.5722861 C169.727283,78.1881586 177.809087,86.2659308 183.428991,95.9966159 C194.866596,115.80088 194.866084,140.203566 183.427647,160.007349 L128.008029,255.995986 Z" fill="#FBC116"/><path d="M128.002654,178.677204 C155.986605,178.677204 178.671827,155.99198 178.671827,128.006687 C178.671827,100.021392 155.986605,77.3375132 128.002654,77.3375132 C100.018703,77.3375132 77.333481,100.022736 77.333481,128.006687 C77.333481,155.990637 100.018703,178.677204 128.002654,178.677204 Z" fill="#1A73E8"/><path d="M128.002654,64.0040154 L238.840546,64.0040154 C227.608801,44.543989 211.451913,28.3830694 191.993231,17.1472928 C172.535124,5.9122784 150.461968,-0.0017050572 127.993247,1.42108511e-14 C105.524382,1.42108511e-14 83.4519466,5.9182354 63.9959517,17.1566997 C44.5392458,28.3945112 28.3842362,44.5569363 17.1553551,64.0187975 L72.5749731,160.008693 L72.5897552,160.016756 C61.1454971,140.216334 61.1378125,115.813649 72.5695977,96.0060227 C78.1854702,86.2739938 86.2672739,78.1921901 95.997959,72.5749737 C105.728644,66.9577574 116.768221,63.9999839 128.005342,64.0026715 L128.002654,64.0040154 Z" fill="#E33B2E"/>' },
    GitHub: { viewBox: '0 0 24 24', hex: '#24292F',
      path: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.333-1.755-1.333-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.237 1.838 1.237 1.07 1.834 2.809 1.304 3.495.997.108-.775.418-1.305.762-1.605-2.665-.305-5.466-1.334-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12' },
    'System Settings': { viewBox: '0 0 24 24', hex: '#6E6E76', stroke: true,
      inner: '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>' },
    Slack: { viewBox: '0 0 256 256', hex: '#4A154B', multi: true,
      inner: '<path d="M53.8412698,161.320635 C53.8412698,176.152381 41.8539683,188.139683 27.0222222,188.139683 C12.1904762,188.139683 0.203174603,176.152381 0.203174603,161.320635 C0.203174603,146.488889 12.1904762,134.501587 27.0222222,134.501587 L53.8412698,134.501587 L53.8412698,161.320635 Z M67.2507937,161.320635 C67.2507937,146.488889 79.2380952,134.501587 94.0698413,134.501587 C108.901587,134.501587 120.888889,146.488889 120.888889,161.320635 L120.888889,228.368254 C120.888889,243.2 108.901587,255.187302 94.0698413,255.187302 C79.2380952,255.187302 67.2507937,243.2 67.2507937,228.368254 L67.2507937,161.320635 Z" fill="#E01E5A"/><path d="M94.0698413,53.6380952 C79.2380952,53.6380952 67.2507937,41.6507937 67.2507937,26.8190476 C67.2507937,11.9873016 79.2380952,0 94.0698413,0 C108.901587,0 120.888889,11.9873016 120.888889,26.8190476 L120.888889,53.6380952 L94.0698413,53.6380952 Z M94.0698413,67.2507937 C108.901587,67.2507937 120.888889,79.2380952 120.888889,94.0698413 C120.888889,108.901587 108.901587,120.888889 94.0698413,120.888889 L26.8190476,120.888889 C11.9873016,120.888889 0,108.901587 0,94.0698413 C0,79.2380952 11.9873016,67.2507937 26.8190476,67.2507937 L94.0698413,67.2507937 Z" fill="#36C5F0"/><path d="M201.549206,94.0698413 C201.549206,79.2380952 213.536508,67.2507937 228.368254,67.2507937 C243.2,67.2507937 255.187302,79.2380952 255.187302,94.0698413 C255.187302,108.901587 243.2,120.888889 228.368254,120.888889 L201.549206,120.888889 L201.549206,94.0698413 Z M188.139683,94.0698413 C188.139683,108.901587 176.152381,120.888889 161.320635,120.888889 C146.488889,120.888889 134.501587,108.901587 134.501587,94.0698413 L134.501587,26.8190476 C134.501587,11.9873016 146.488889,0 161.320635,0 C176.152381,0 188.139683,11.9873016 188.139683,26.8190476 L188.139683,94.0698413 Z" fill="#2EB67D"/><path d="M161.320635,201.549206 C176.152381,201.549206 188.139683,213.536508 188.139683,228.368254 C188.139683,243.2 176.152381,255.187302 161.320635,255.187302 C146.488889,255.187302 134.501587,243.2 134.501587,228.368254 L134.501587,201.549206 L161.320635,201.549206 Z M161.320635,188.139683 C146.488889,188.139683 134.501587,176.152381 134.501587,161.320635 C134.501587,146.488889 146.488889,134.501587 161.320635,134.501587 L228.571429,134.501587 C243.403175,134.501587 255.390476,146.488889 255.390476,161.320635 C255.390476,176.152381 243.403175,188.139683 228.571429,188.139683 L161.320635,188.139683 Z" fill="#ECB22E"/>' },
    'Microsoft Teams': { viewBox: '0 0 256 239', hex: '#5059C9', multi: true,
      inner: '<path d="M178.562984,89.3023389 L244.688409,89.3023389 C250.935667,89.3023389 256,94.3666717 256,100.61393 L256,160.8454 C256,183.805692 237.387095,202.418597 214.426804,202.418597 L214.230281,202.418597 C191.269989,202.421813 172.654443,183.81155 172.651112,160.851258 L172.651112,95.2142112 C172.651112,91.9491339 175.298022,89.3023389 178.562984,89.3023389 Z" fill="#5059C9"/><circle fill="#5059C9" cx="223.255847" cy="50.6046204" r="26.7907017"/><circle fill="#7B83EB" cx="139.906959" cy="38.6977185" r="38.6977185"/><path d="M191.505908,89.3023389 L82.3545595,89.3023389 C76.1817292,89.4551005 71.2986428,94.5778961 71.4418711,100.750956 L71.4418711,169.448288 C70.5798595,206.492276 99.8873366,237.23307 136.930291,238.139647 C173.973246,237.23307 203.280608,206.492276 202.418711,169.448288 L202.418711,100.750956 C202.56171,94.5778961 197.678739,89.4551005 191.505908,89.3023389 Z" fill="#7B83EB"/><polygon fill="#FFFFFF" points="94.2080524 95.1248514 72.3884185 95.1248514 72.3884185 154.540713 58.4871168 154.540713 58.4871168 95.1248514 36.768788 95.1248514 36.768788 83.5989345 94.2080524 83.5989345"/>' },
    Zoom: { viewBox: '0 0 24 24', hex: '#0B5CFF',
      path: 'M5.033 14.649H.743a.74.74 0 0 1-.686-.458.74.74 0 0 1 .16-.808L3.19 10.41H1.06A1.06 1.06 0 0 1 0 9.35h3.957c.301 0 .57.18.686.458a.74.74 0 0 1-.161.808L1.51 13.59h2.464c.585 0 1.06.475 1.06 1.06zM24 11.338c0-1.14-.927-2.066-2.066-2.066-.61 0-1.158.265-1.537.686a2.061 2.061 0 0 0-1.536-.686c-1.14 0-2.066.926-2.066 2.066v3.311a1.06 1.06 0 0 0 1.06-1.06v-2.251a1.004 1.004 0 0 1 2.013 0v2.251c0 .586.474 1.06 1.06 1.06v-3.311a1.004 1.004 0 0 1 2.012 0v2.251c0 .586.475 1.06 1.06 1.06zM16.265 12a2.728 2.728 0 1 1-5.457 0 2.728 2.728 0 0 1 5.457 0zm-1.06 0a1.669 1.669 0 1 0-3.338 0 1.669 1.669 0 0 0 3.338 0zm-4.82 0a2.728 2.728 0 1 1-5.458 0 2.728 2.728 0 0 1 5.457 0zm-1.06 0a1.669 1.669 0 1 0-3.338 0 1.669 1.669 0 0 0 3.338 0z' },
    Jira: { viewBox: '0 0 24 24', hex: '#2684FF',
      path: 'M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z' },
    'VS Code': { viewBox: '0 0 24 24', hex: '#007ACC',
      path: 'M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z' },
    iTerm: { viewBox: '0 0 24 24', hex: '#000000',
      path: 'M24 5.359v13.282A5.36 5.36 0 0 1 18.641 24H5.359A5.36 5.36 0 0 1 0 18.641V5.359A5.36 5.36 0 0 1 5.359 0h13.282A5.36 5.36 0 0 1 24 5.359m-.932-.233A4.196 4.196 0 0 0 18.874.932H5.126A4.196 4.196 0 0 0 .932 5.126v13.748a4.196 4.196 0 0 0 4.194 4.194h13.748a4.196 4.196 0 0 0 4.194-4.194zm-.816.233v13.282a3.613 3.613 0 0 1-3.611 3.611H5.359a3.613 3.613 0 0 1-3.611-3.611V5.359a3.613 3.613 0 0 1 3.611-3.611h13.282a3.613 3.613 0 0 1 3.611 3.611M8.854 4.194v6.495h.962V4.194zM5.483 9.493v1.085h.597V9.48q.283-.037.508-.133.373-.165.575-.448.208-.284.208-.649a.9.9 0 0 0-.171-.568 1.4 1.4 0 0 0-.426-.388 3 3 0 0 0-.544-.261 32 32 0 0 0-.545-.209 1.8 1.8 0 0 1-.426-.216q-.164-.12-.164-.284 0-.223.179-.351.18-.126.485-.127.344 0 .575.105.239.105.5.298l.433-.5a2.3 2.3 0 0 0-.605-.433 1.6 1.6 0 0 0-.582-.159v-.968h-.597v.978a2 2 0 0 0-.477.127 1.2 1.2 0 0 0-.545.411q-.194.268-.194.634 0 .335.164.56.164.224.418.38a4 4 0 0 0 .552.262q.291.104.545.209.261.104.425.238a.39.39 0 0 1 .165.321q0 .225-.187.359-.18.134-.537.134-.381 0-.717-.134a4.4 4.4 0 0 1-.649-.351l-.388.589q.209.173.477.306.276.135.575.217.191.046.373.064' },
    Postman: { viewBox: '0 0 24 24', hex: '#FF6C37',
      path: 'M13.527.099C6.955-.744.942 3.9.099 10.473c-.843 6.572 3.8 12.584 10.373 13.428 6.573.843 12.587-3.801 13.428-10.374C24.744 6.955 20.101.943 13.527.099zm2.471 7.485a.855.855 0 0 0-.593.25l-4.453 4.453-.307-.307-.643-.643c4.389-4.376 5.18-4.418 5.996-3.753zm-4.863 4.861l4.44-4.44a.62.62 0 1 1 .847.903l-4.699 4.125-.588-.588zm.33.694l-1.1.238a.06.06 0 0 1-.067-.032.06.06 0 0 1 .01-.073l.645-.645.512.512zm-2.803-.459l1.172-1.172.879.878-1.979.426a.074.074 0 0 1-.085-.039.072.072 0 0 1 .013-.093zm-3.646 6.058a.076.076 0 0 1-.069-.083.077.077 0 0 1 .022-.046h.002l.946-.946 1.222 1.222-2.123-.147zm2.425-1.256a.228.228 0 0 0-.117.256l.203.865a.125.125 0 0 1-.211.117h-.003l-.934-.934-.294-.295 3.762-3.758 1.82-.393.874.874c-1.255 1.102-2.971 2.201-5.1 3.268zm5.279-3.428h-.002l-.839-.839 4.699-4.125a.952.952 0 0 0 .119-.127c-.148 1.345-2.029 3.245-3.977 5.091zm3.657-6.46l-.003-.002a1.822 1.822 0 0 1 2.459-2.684l-1.61 1.613a.119.119 0 0 0 0 .169l1.247 1.247a1.817 1.817 0 0 1-2.093-.343zm2.578 0a1.714 1.714 0 0 1-.271.218h-.001l-1.207-1.207 1.533-1.533c.661.72.637 1.832-.054 2.522zM18.855 6.05a.143.143 0 0 0-.053.157.416.416 0 0 1-.053.45.14.14 0 0 0 .023.197.141.141 0 0 0 .084.03.14.14 0 0 0 .106-.05.691.691 0 0 0 .087-.751.138.138 0 0 0-.194-.033z' },
  };
  var CAT_HEX = { coding: '#3B6FE0', meeting: '#D97706', code_review: '#7C3AED', communication: '#0891B2', research: '#4F46E5' };
  var CAT_LABEL = { coding: 'Coding', meeting: 'Meeting', code_review: 'Code review', communication: 'Comms', research: 'Research' };
  var HUES = ['#8B5CF6', '#A21CAF', '#6366F1', '#9333EA'];
  var TICKET_POOL = [
    { key: 'MER-482', title: 'Fix token-refresh race condition in auth' },
    { key: 'MER-495', title: 'Redis session store — eviction & TTL' },
    { key: 'MER-501', title: 'Sprint planning & board grooming' },
    { key: 'MER-475', title: 'Add cursor pagination to activity-feed API' },
    { key: 'MER-510', title: 'Polish onboarding empty states' },
  ];

  function seedWorklogs(dayTasks) {
    var out = {};
    dayTasks.forEach(function (t) {
      if (!t.ticket || (t.status !== 'posted' && t.status !== 'pending')) {
        out[t.id] = { draft: null, phase: 'idle', confirming: false, picking: false, posted: false };
        return;
      }
      out[t.id] = {
        draft: { targetKey: t.ticket.key, targetType: t.ticket.type, targetTitle: t.ticket.title },
        phase: 'idle', confirming: false, picking: false, posted: t.status === 'posted',
      };
    });
    return out;
  }

  function initialState() {
    var dayTasks = [
      { id: 'd1', title: 'Catching up on Slack and inbox messages', hue: 1, segments: [[0, 35]], cat: 'communication',
        apps: ['Slack', 'GitHub'], ticket: null, status: 'tracked',
        summary: ['Caught up on 14 messages that piled up overnight across the team.', 'Read through everything to see what needed a reply first.'] },
      { id: 'd2', title: 'Team standup & planning the week ahead', hue: 2, segments: [[45, 90]], cat: 'meeting',
        apps: ['Microsoft Teams', 'Jira'], ticket: { key: 'MER-501', type: 'Task', title: 'Sprint planning & board grooming' }, status: 'posted',
        summary: ["Updated the team on yesterday's progress fixing a login bug.", "Reviewed the task list and estimated what's next."] },
      { id: 'd3', title: 'Fixing a bug that randomly logged people out', hue: 0, segments: [[100, 155], [165, 215]], cat: 'coding',
        apps: ['VS Code', 'iTerm'], ticket: { key: 'MER-482', type: 'Bug', title: 'Fix token-refresh race condition in auth' }, status: 'pending',
        summary: ['Figured out why some users were getting logged out unexpectedly.', "Fixed the underlying timing issue so it can't happen again.", 'Opened a draft fix for a teammate to double-check before it ships.'] },
      { id: 'd4', title: "Reviewing a teammate's code change", hue: 0, segments: [[195, 235]], cat: 'code_review',
        apps: ['GitHub'], ticket: { key: 'MER-495', type: 'Story', title: 'Review: Redis session store' }, status: 'pending',
        summary: ['Left detailed feedback on how old data gets cleared out over time.', 'Caught an edge case that could cause a rare double-cleanup.'] },
      { id: 'd5', title: 'Making the activity feed feel instant', hue: 2, segments: [[280, 370], [390, 500]], cat: 'coding',
        apps: ['VS Code', 'Postman'], ticket: { key: 'MER-475', type: 'Story', title: 'Add cursor pagination to activity-feed API' }, status: 'pending',
        summary: [
          'Found why the feed was taking a while to show up for people with a lot of activity.',
          'Changed how it loads so it shows up almost instantly, no matter how much history someone has.',
          'Double-checked it worked well for small, medium, and very active accounts before shipping.',
          'Shipped it — the feed now feels noticeably snappier for everyone.'] },
      { id: 'd6', title: 'Watching a talk on YouTube while a long test run finished', hue: 3, segments: [[290, 490]], cat: 'research',
        apps: ['Google Chrome'], ticket: null, status: 'tracked',
        summary: ['Kept a systems-design talk playing in the background while the test suite ran.', 'Picked up a couple of ideas worth trying on the activity-feed work.'] },
    ];
    return {
      capture: true, jiraConnected: true, selectedTaskId: null, planEditing: false,
      worklogs: seedWorklogs(dayTasks),
      tasks: [
        { id: 'c1', text: "Share today's standup notes with the team", ref: 'MER-501', done: true, link: 'd2' },
        { id: 'c2', text: 'Ship the activity-feed pagination', ref: 'MER-475', done: true, link: 'd5' },
        { id: 'c3', text: 'Polish onboarding empty states', ref: 'MER-510', done: false, link: null },
      ],
      dayTasks: dayTasks,
    };
  }

  var state = initialState();
  var mode = 'intro';          // 'intro' | 'live'
  var revealed = {};           // task id -> revealed during build
  var aborted = false;
  var rafId = null;
  var pendingUserClick = null;
  var doneFired = false;
  function fireDone() { if (doneFired) return; doneFired = true; if (opts.onDone) { try { opts.onDone(); } catch (e) {} } }
  function sfx(name) { if (window.MeridianAudio) window.MeridianAudio.play(name); }

  // ── formatting / geometry helpers (ported verbatim) ──────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtClock(min) {
    var totalMin = DAY_START_LABEL * 60 + min;
    var h = Math.floor(totalMin / 60) % 24, m = totalMin % 60;
    var ap = h >= 12 ? 'PM' : 'AM', hr = h % 12; if (hr === 0) hr = 12;
    return hr + (m ? ':' + (m < 10 ? '0' : '') + m : ':00') + ' ' + ap;
  }
  function fmtDur(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return h > 0 ? h + 'h ' + (m ? m + 'm' : '') : m + 'm';
  }
  function appColor(a) { return APP_COLORS[a] || '#9C98AC'; }
  function hueColor(i) { return HUES[i % HUES.length]; }
  function hexToRgba(hex, a) {
    var h = hex.replace('#', '');
    var r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  function appGlyph(name, size) {
    var b = BRAND_ICONS[name];
    if (!b) return '<span class="app-ico" style="background:' + hexToRgba(appColor(name), 0.14) + ';width:' + size + 'px;height:' + size + 'px"><span style="color:' + appColor(name) + ';font:700 9px -apple-system,BlinkMacSystemFont,\'SF Pro Text\',system-ui,sans-serif">' + esc(name.slice(0, 1)) + '</span></span>';
    var inner = Math.round(size * 0.58);
    var svg = b.multi
      ? '<svg width="' + inner + '" height="' + inner + '" viewBox="' + b.viewBox + '">' + b.inner + '</svg>'
      : b.stroke
      ? '<svg width="' + inner + '" height="' + inner + '" viewBox="' + b.viewBox + '" fill="none" stroke="' + b.hex + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + b.inner + '</svg>'
      : '<svg width="' + inner + '" height="' + inner + '" viewBox="' + b.viewBox + '" fill="' + b.hex + '"><path d="' + b.path + '"/></svg>';
    return '<span class="app-ico" style="background:' + hexToRgba(b.hex, 0.12) + ';width:' + size + 'px;height:' + size + 'px">' + svg + '</span>';
  }
  var JIRA_HEX = '#2684FF';
  var JIRA_PATH = 'M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z';
  function jiraIcon(size) { return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="' + JIRA_HEX + '"><path d="' + JIRA_PATH + '"/></svg>'; }
  function taskStart(t) { return t.segments[0][0]; }
  function taskEnd(t) { return t.segments[t.segments.length - 1][1]; }
  function taskMinutes(t) { return t.segments.reduce(function (s, seg) { return s + (seg[1] - seg[0]); }, 0); }
  function unionMinutes(tasks) {
    var segs = tasks.reduce(function (acc, t) { return acc.concat(t.segments); }, []).sort(function (a, b) { return a[0] - b[0]; });
    var total = 0, curStart = null, curEnd = null;
    segs.forEach(function (seg) {
      if (curStart === null) { curStart = seg[0]; curEnd = seg[1]; return; }
      if (seg[0] <= curEnd) { curEnd = Math.max(curEnd, seg[1]); return; }
      total += curEnd - curStart; curStart = seg[0]; curEnd = seg[1];
    });
    if (curStart !== null) total += curEnd - curStart;
    return total;
  }
  function colorMix(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 'rgb(' + Math.round(r * alpha + 255 * (1 - alpha)) + ',' + Math.round(g * alpha + 255 * (1 - alpha)) + ',' + Math.round(b * alpha + 255 * (1 - alpha)) + ')';
  }

  // ── actions (ported) ─────────────────────────────────────────────────
  // Reset just restores the interactive demo's data to its starting state —
  // it must NOT replay the intro cinematic (that's what "Replay intro" is for).
  function resetAll() {
    if (rafId) cancelAnimationFrame(rafId);
    state = initialState();
    revealed = {};
    state.dayTasks.forEach(function (t) { revealed[t.id] = true; });
    render();
  }
  function replayIntro() {
    if (rafId) cancelAnimationFrame(rafId);
    if (pendingUserClick) { var pr = pendingUserClick.resolve; pendingUserClick = null; pr(); }
    aborted = false;
    doneFired = false;
    mode = 'intro';
    revealed = {};
    state = initialState();
    refs.pointer.classList.remove('is-on');
    refs.question.classList.remove('is-on');
    refs.clock.className = 'mclock mclock--hero';
    refs.root.classList.remove('intro-clean');
    camera('scale(1)', 0);
    refs.scrim.classList.remove('is-off');
    runIntro();
  }
  function toggleCapture() { state.capture = !state.capture; render(); }
  function toggleJira() { state.jiraConnected = !state.jiraConnected; render(); }
  function toggleTask(id) { state.tasks = state.tasks.map(function (t) { return t.id === id ? Object.assign({}, t, { done: !t.done }) : t; }); render(); }
  function selectTask(id) { state.selectedTaskId = id; render(); }
  function clearSelection() { state.selectedTaskId = null; render(); }
  function togglePlanEdit() { state.planEditing = !state.planEditing; render(); }
  function removeFocusTask(id) { state.tasks = state.tasks.filter(function (t) { return t.id !== id; }); render(); }
  function addFocusTask() {
    var input = document.getElementById('plan-add-input');
    var text = input ? input.value.trim() : '';
    if (!text) return;
    state.tasks = state.tasks.concat([{ id: 'c' + Date.now(), text: text, ref: null, done: false }]);
    render();
    var next = document.getElementById('plan-add-input'); if (next) next.focus();
  }
  function wl(id) { return state.worklogs[id]; }
  function generateWorklog(id) {
    var w = wl(id); if (!w || w.phase === 'generating') return;
    w.phase = 'generating'; render();
    setTimeout(function () {
      var t = state.dayTasks.find(function (x) { return x.id === id; });
      w.phase = 'idle'; w.confirming = false; w.picking = false;
      if (!w.draft) {
        var target = (t && t.ticket) || TICKET_POOL[0];
        w.draft = { targetKey: target.key, targetType: (t && t.ticket && t.ticket.type) || 'Task', targetTitle: target.title };
      }
      render();
    }, 1700);
  }
  function openTicketPicker(id) { wl(id).picking = true; render(); }
  function cancelTicketPicker(id) { wl(id).picking = false; render(); }
  function pickTicket(id, key) {
    var w = wl(id); var chosen = TICKET_POOL.find(function (t) { return t.key === key; }); if (!chosen) return;
    w.draft.targetKey = chosen.key; w.draft.targetTitle = chosen.title; w.picking = false; render();
  }
  function confirmPost(id) { wl(id).confirming = true; render(); }
  function cancelConfirm(id) { wl(id).confirming = false; render(); }
  function approvePost(id) {
    var w = wl(id); if (w.phase === 'approving') return;
    w.phase = 'approving'; render();
    setTimeout(function () { w.phase = 'idle'; w.confirming = false; w.posted = true; render(); }, 650);
  }

  // ── daily summary (end-of-day review) ────────────────────────────
  var STANDUP_LINES = [
    'Shipped activity-feed pagination — the feed now loads instantly (MER-475).',
    'Fixed the random-logout bug that slipped in overnight (MER-482).',
    'Shared standup notes and planned the sprint (MER-501).',
    'Next up: onboarding empty-state polish rolls to tomorrow.',
  ];
  var STANDUP_TEXT = 'Standup · Wed Jul 22\n• ' + STANDUP_LINES.join('\n• ');
  function summaryUpdateText(t) { return t.summary.slice(0, 2).join(' '); }

  function setSummaryCaption(txt) {
    state.summaryCaption = txt || '';
    var el = refs.summary.querySelector('.msum__cap');
    if (el) {
      el.textContent = state.summaryCaption;
      el.classList.remove('msum__cap--pop'); void el.offsetWidth;
      if (state.summaryCaption) el.classList.add('msum__cap--pop');
    }
  }
  function openSummary() {
    state.summaryTaskId = null; state.nudgeTaskId = null; state._lastSummaryView = 'home';
    refs.summary.innerHTML =
      '<div class="msum__scrim" data-action="close-summary"></div>' +
      '<div class="msum__cap">' + esc(state.summaryCaption || '') + '</div>' +
      '<div id="msum-card" class="msum__card"></div>';
    renderSummary();
    var c0 = document.getElementById('msum-card'); if (c0) c0.scrollTop = 0;
    refs.summary.classList.add('is-on');
  }
  function closeSummary() { refs.summary.classList.remove('is-on'); }
  function summarySelectTask(id) { state.summaryTaskId = id; renderSummary(); }
  function summaryBack() { state.summaryTaskId = null; renderSummary(); }
  function summaryPost(id) {
    var w = wl(id); if (w.summaryPosting || w.posted) return;
    w.summaryPosting = true; renderSummary();
    setTimeout(function () { w.summaryPosting = false; w.posted = true; renderSummary(); render(); }, 1350);
  }
  function copyStandup() {
    try { if (navigator.clipboard) navigator.clipboard.writeText(STANDUP_TEXT); } catch (e) {}
    var card = refs.summary.querySelector('.msum-standup');
    if (card) { card.classList.remove('msum-standup--copied'); void card.offsetWidth; card.classList.add('msum-standup--copied'); }
    var el = refs.summary.querySelector('.msum-standup__copy');
    if (el) { el.textContent = 'Copied ✓'; setTimeout(function () { var e2 = refs.summary.querySelector('.msum-standup__copy'); if (e2) e2.textContent = 'Copy'; }, 1600); }
  }

  // animated demo cursor
  function showCursor() {
    refs.cursor.style.transitionDuration = '0ms';
    refs.cursor.style.transform = 'translate(560px,330px)';
    void refs.cursor.offsetWidth;
    refs.cursor.classList.add('is-on');
  }
  function hideCursor() { refs.cursor.classList.remove('is-on'); }
  function cursorTo(el, dur) {
    if (!el) return;
    var origin = (refs.cursor.offsetParent || refs.root).getBoundingClientRect(), r = el.getBoundingClientRect();
    var scale = refs.root.getBoundingClientRect().width / 1240 || 1;
    var x = (r.left - origin.left + r.width / 2) / scale, y = (r.top - origin.top + r.height / 2) / scale;
    refs.cursor.style.transitionDuration = (dur || 900) + 'ms';
    refs.cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }
  function cursorClick() { sfx('click'); refs.cursor.classList.remove('is-click'); void refs.cursor.offsetWidth; refs.cursor.classList.add('is-click'); }
  // pause the auto-demo until the user clicks the highlighted element (with a
  // safety fallback that auto-advances if they never do).
  function waitForUserClick(selector, fallbackMs) {
    return new Promise(function (resolve) {
      var done = false, to = null;
      function finish() { if (done) return; done = true; pendingUserClick = null; if (to) clearTimeout(to); resolve(); }
      pendingUserClick = { selector: selector, resolve: finish };
      to = setTimeout(function () { if (aborted) return finish(); cursorClick(); finish(); }, fallbackMs || 7000);
    });
  }

  // renders only the card body so the open animation never replays (no blink)
  function renderSummary() {
    var card = document.getElementById('msum-card');
    if (!card) { openSummary(); return; }
    var view = state.summaryTaskId ? 'task' : 'home';
    var changed = view !== state._lastSummaryView;
    state._lastSummaryView = view;
    if (state.summaryTaskId) { card.className = 'msum__card msum__card--task'; card.innerHTML = summaryTaskBody(); }
    else { card.className = 'msum__card'; card.innerHTML = summaryHomeBody(); }
    if (changed) { card.style.animation = 'none'; void card.offsetWidth; card.style.animation = 'msum-swap .36s cubic-bezier(.2,.8,.25,1)'; }
  }

  function summaryHomeBody() {
    var planned = state.tasks.length, done = state.tasks.filter(function (t) { return t.done; }).length;
    var pct = planned ? Math.round(done / planned * 100) : 0;
    var logged = unionMinutes(state.dayTasks);
    var R = 34, C = 2 * Math.PI * R, dash = pct / 100 * C;
    var plan = state.tasks.map(function (t) {
      var linked = t.link && t.done;
      var posted = t.link ? wl(t.link).posted : false;
      var nudged = state.nudgeTaskId === t.id;
      var sub = posted ? 'Synced to Jira' : (t.done ? 'Done · ready to post' : 'Carried over to tomorrow');
      return '<button class="msum-row' + (nudged ? ' msum-row--nudge' : '') + '" ' + (linked ? 'data-action="summary-select-task" data-task-id="' + t.link + '"' : 'data-action="noop"') + '>' +
        '<span class="msum-check' + (t.done ? ' is-done' : '') + '">' + (t.done ? '✓' : '') + '</span>' +
        '<span class="msum-row__main"><span class="msum-row__t"' + (t.done ? ' style="color:#9C97AE;text-decoration:line-through;text-decoration-color:#D8D4E4"' : ' style="color:#C2410C"') + '>' + esc(t.text) + '</span><span class="msum-row__s">' + sub + '</span></span>' +
        (nudged ? '<span class="msum-nudge">Click to post →</span>' : (linked ? (posted ? '<span class="msum-row__pill">' + jiraIcon(10) + '✓</span>' : '<span class="msum-row__chev">›</span>') : (t.ref ? '<span class="msum-row__ref">' + t.ref + '</span>' : ''))) +
        '</button>';
    }).join('');
    return '<button class="msum__x" data-action="close-summary">✕</button>' +
      '<div class="msum-hero">' +
        '<div class="msum-hero__l">' +
          '<div class="msum-hd__eyebrow">DAILY SUMMARY · WED JUL 22</div>' +
          '<div class="msum-hd__title">You had a very productive day</div>' +
          '<div class="msum-sum">You wrapped <b>2 of 3</b> planned tasks. An urgent logout bug pulled you off the third — it rolls to tomorrow, already noted.</div>' +
        '</div>' +
        '<div class="msum-hero__r">' +
          '<div class="msum-donut"><svg width="84" height="84" viewBox="0 0 84 84"><circle cx="42" cy="42" r="' + R + '" fill="none" stroke="#ECE5FA" stroke-width="9"></circle><circle cx="42" cy="42" r="' + R + '" fill="none" stroke="#7C3AED" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + dash + ' ' + (C - dash) + '" transform="rotate(-90 42 42)"></circle></svg><div class="msum-donut__c"><span class="msum-donut__pct">' + pct + '%</span><span class="msum-donut__lbl">of plan</span></div></div>' +
          '<div class="msum-stats">' +
            '<div class="msum-stat"><div class="n">' + done + ' / ' + planned + '</div><div class="l">PLANNED DONE</div></div>' +
            '<div class="msum-stat"><div class="n">' + fmtDur(logged) + '</div><div class="l">TIME LOGGED</div></div>' +
            '<div class="msum-stat"><div class="n msum-stat__accent">+1</div><div class="l">URGENT PICKUP</div></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="msum-cards">' +
        '<div class="msum-card msum-card--violet"><div class="msum-card__ic">↯</div><div class="msum-card__x"><div class="msum-card__t">Handled the unexpected</div><div class="msum-card__b">A random-logout bug wasn’t on the plan. You caught it and shipped a fix.</div></div></div>' +
        '<div class="msum-card msum-card--green"><div class="msum-card__ic">✦</div><div class="msum-card__x"><div class="msum-card__t">New learning</div><div class="msum-card__b">Cursor pagination made the activity feed feel instant — worth reusing.</div></div></div>' +
      '</div>' +
      '<div class="msum-cols">' +
        '<div class="msum-worked"><div class="msum-worked__hd">TODAY’S PLAN · tap a done task to post to Jira</div>' + plan + '</div>' +
        '<div class="msum-standup"><div class="msum-standup__hd"><span>STANDUP — READY TO PASTE</span><button class="msum-standup__copy" data-action="copy-standup">Copy</button></div>' +
          '<div class="msum-standup__body">' + STANDUP_LINES.map(function (l) { return '<div class="msum-standup__line">' + esc(l) + '</div>'; }).join('') + '</div></div>' +
      '</div>';
  }

  function summaryTaskBody() {
    var t = state.dayTasks.find(function (x) { return x.id === state.summaryTaskId; });
    if (!t) return summaryHomeBody();
    var accent = hueColor(t.hue), w = wl(t.id), lo = taskStart(t), hi = taskEnd(t);
    var footer;
    if (!t.ticket) footer = '<div class="msum-tk-note">No ticket matched — this one is just tracked for you.</div>';
    else if (w.posted) footer = '<div class="msum-tk-posted">' + jiraIcon(15) + 'Posted &amp; logged to Jira <span class="msum-tk-check msum-tk-check--pop">✓</span></div>';
    else if (w.summaryPosting) footer = '<button class="msum-tk-post" disabled style="background:' + accent + '">Posting to Jira…</button>';
    else footer = '<button class="msum-tk-post" data-action="summary-post" data-task-id="' + t.id + '" style="background:' + accent + '">Post to Jira</button>';
    return '<button class="msum-back" data-action="summary-back">‹ Back to summary</button>' +
      '<div class="msum-tk-hd"><span class="msum-tk-dot" style="background:' + accent + '"></span><div><div class="msum-tk-eyebrow">WORKLOG UPDATE · ' + fmtDur(taskMinutes(t)) + ' · ' + fmtClock(lo) + ' – ' + fmtClock(hi) + '</div><div class="msum-tk-title">' + esc(t.title) + '</div></div></div>' +
      '<div class="msum-tk-sec"><div class="msum-tk-lbl">What you did</div><ul class="msum-tk-ul">' + t.summary.map(function (x) { return '<li><span style="color:' + accent + '">·</span>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
      (t.ticket ? '<div class="msum-tk-sec"><div class="msum-tk-lbl">Update to post</div><div class="msum-tk-ticket"><span class="msum-tk-key">' + jiraIcon(12) + t.ticket.key + '</span><span class="msum-tk-ttitle">' + esc(t.ticket.title) + '</span></div><div class="msum-tk-update">' + esc(summaryUpdateText(t)) + '</div></div>' : '') +
      '<div class="msum-tk-foot">' + footer + '</div>';
  }

  // ── render: toolbar ───────────────────────────────────────────────────
  function renderToolbar() {
    var capOn = state.capture, jiraOn = state.jiraConnected;
    refs.toolbarLeftExtra.innerHTML = '<button class="sumpill" data-action="open-summary"><span class="d"></span>Daily summary</button>';
    refs.toolbarActions.innerHTML =
      '<span class="swatches"><span class="swatch" style="background:#6366F1"></span><span class="swatch" style="background:#8B5CF6"></span><span class="swatch" style="background:#241C49"></span></span>' +
      '<button class="jirapill" data-action="toggle-jira"><svg width="12" height="12" viewBox="0 0 24 24" fill="' + (jiraOn ? '#2684FF' : '#B4AECB') + '"><path d="' + JIRA_PATH + '"/></svg>' + (jiraOn ? 'Jira' : 'Not connected') + '</button>' +
      '<button class="cappill" data-action="toggle-capture" style="border-color:' + (capOn ? '#CFEEDD' : '#E4DEF6') + ';background:' + (capOn ? '#EDFAF2' : '#fff') + ';color:' + (capOn ? '#0F9D6E' : '#6E6A88') + '"><span class="capdot" style="background:' + (capOn ? '#10B981' : '#B4AECB') + '"></span>' + (capOn ? 'Capturing' : 'Paused') + '</button>' +
      '<button class="resetbtn" data-action="reset" title="Reset the demo back to its starting state"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11A8 8 0 1 0 18.5 16"></path><path d="M20 4v6h-6"></path></svg></button>';
  }

  function assignLanes(tasks) {
    var sorted = tasks.slice().sort(function (a, b) { return taskStart(a) - taskStart(b); });
    var lanes = [];
    var placed = sorted.map(function (t) {
      var s = taskStart(t), e = taskEnd(t), laneIdx = -1;
      for (var i = 0; i < lanes.length; i++) { if (lanes[i] <= s) { laneIdx = i; break; } }
      if (laneIdx === -1) { laneIdx = lanes.length; lanes.push(0); }
      lanes[laneIdx] = e;
      return Object.assign({}, t, { lane: laneIdx, footLo: s, footHi: e });
    });
    return { tasks: placed, laneCount: lanes.length };
  }

  function renderTimeline() {
    var lastEnd = Math.max(DAY_WINDOW_MIN, Math.max.apply(null, state.dayTasks.map(taskEnd)));
    var hours = [];
    for (var m = 0; m <= lastEnd; m += 60) hours.push(m);
    var totalTracked = unionMinutes(state.dayTasks);
    var scaleHeight = (Math.ceil((lastEnd + 40) / 60) * 60) * PXPM;

    var hourHtml = hours.map(function (m) {
      var hourLabel = DAY_START_LABEL + Math.floor(m / 60);
      var ap = hourLabel >= 12 ? 'PM' : 'AM', hr = hourLabel % 12; if (hr === 0) hr = 12;
      return '<div class="tl-hourline" style="top:' + (m * PXPM) + 'px"><span class="hl-label">' + hr + ' ' + ap + '</span><span class="hl-dot"></span><span class="hl-rule"></span></div>';
    }).join('');

    var laned = assignLanes(state.dayTasks);
    var laneCount = Math.max(1, laned.laneCount);
    var gap = 20, VGAP = 4, RAIL_INSET = 10;

    var bandsHtml = laned.tasks.map(function (t) {
      var accent = hueColor(t.hue);
      var selected = state.selectedTaskId === t.id;
      var rawTop = t.footLo * PXPM, rawHeight = (t.footHi - t.footLo) * PXPM;
      var top = rawTop + VGAP / 2, height = Math.max(42, rawHeight - VGAP);
      var laneWidthPct = 100 / laneCount, leftPct = t.lane * laneWidthPct;
      var bgTop = colorMix(accent, selected ? 0.20 : 0.13), bgBot = colorMix(accent, selected ? 0.12 : 0.06);
      var borderCol = colorMix(accent, selected ? 0.55 : 0.24);
      var opacity = state.selectedTaskId && !selected ? 0.38 : 1;
      var showBullets = height > 78 && t.summary && t.summary.length;
      var showMeta = height > 56;
      var inset = Math.min(RAIL_INSET, height * 0.25);
      var railHtml = t.segments.map(function (seg) {
        var segTop = seg[0] * PXPM - top, segBot = seg[1] * PXPM - top;
        var rt = Math.max(segTop, inset), rb = Math.min(segBot, height - inset), rh = Math.max(rb - rt, 4);
        return '<span class="tl-band-rail" style="top:' + rt + 'px;height:' + rh + 'px;background:' + accent + '"></span>';
      }).join('');
      return (
        '<div class="tl-band" data-action="select-task" data-task-id="' + t.id + '" data-sittings="' + t.segments.length + '" style="top:' + top + 'px;height:' + height + 'px;left:calc(' + leftPct + '% + ' + (t.lane > 0 ? gap / 2 : 0) + 'px);width:calc(' + laneWidthPct + '% - ' + gap + 'px);background:linear-gradient(180deg,' + bgTop + ',' + bgBot + ');border:1px solid ' + borderCol + ';opacity:' + opacity + '">' +
          railHtml +
          '<div class="tl-band-head"><span class="tl-band-dot" style="background:' + accent + '"></span><div class="tl-band-title">' + esc(t.title) + '</div>' +
            (wl(t.id).posted ? '<span class="tl-band-pill" title="Synced to Jira · ' + wl(t.id).draft.targetKey + '">' + jiraIcon(11) + '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>' : '') +
          '</div>' +
          (showMeta ? '<div class="tl-band-meta" style="color:' + accent + '"><span>' + fmtDur(taskMinutes(t)) + '</span><span class="rng">' + fmtClock(t.footLo) + ' – ' + fmtClock(t.footHi) + '</span>' + (t.segments.length > 1 ? '<span class="sep">·</span><span class="rng">' + t.segments.length + ' sittings</span>' : '') + '</div>' : '') +
          (showBullets ? '<div class="tl-band-bullets">' + t.summary.slice(0, 3).map(function (s) { return '<div>' + esc(s) + '</div>'; }).join('') + '</div>' : '') +
        '</div>'
      );
    }).join('');

    refs.timeline.innerHTML =
      '<div class="tl-head"><span class="greet">' + state.dayTasks.length + ' tasks today</span><span class="m"></span><span class="tracked">' + fmtDur(totalTracked) + ' tracked</span></div>' +
      '<div id="tl-scale" style="height:' + scaleHeight + 'px"><div class="tl-spine"></div>' + hourHtml + '<div class="tl-lanes" style="height:' + scaleHeight + 'px">' + bandsHtml + '</div></div>';
  }

  // ── render: right panel (ported) ──────────────────────────────────────
  function renderPanel() {
    var selId = state.selectedTaskId;
    var selectedTask = selId != null ? state.dayTasks.find(function (t) { return t.id === selId; }) : null;
    if (selectedTask) { renderDetailPanel(selectedTask); return; }

    var pendingCount = state.dayTasks.filter(function (t) { var w = wl(t.id); return w.draft && !w.posted; }).length;
    var postedCount = state.dayTasks.filter(function (t) { return wl(t.id).posted; }).length;
    var focusMin = unionMinutes(state.dayTasks);
    var loggedMin = state.dayTasks.filter(function (t) { return wl(t.id).posted; }).reduce(function (s, t) { return s + taskMinutes(t); }, 0);

    var statTiles = [['Focus', fmtDur(focusMin), false], ['Drafts', String(pendingCount), pendingCount > 0]].map(function (p) {
      return '<div class="stat-tile' + (p[2] ? ' accent' : '') + '"><div class="num">' + p[1] + '</div><div class="lbl">' + p[0] + '</div></div>';
    }).join('');

    var tasks = state.tasks.map(function (t) {
      return '<div class="task-row" ' + (state.planEditing ? '' : 'data-action="toggle-task" data-task-id="' + t.id + '"') + '>' +
        '<span class="task-check" style="background:' + (t.done ? '#8B5CF6' : '#fff') + ';border:' + (t.done ? 'none' : '2px solid #D8D4E4') + '">' + (t.done ? '✓' : '') + '</span>' +
        '<span class="task-text" style="color:' + (t.done ? '#B4B0C2' : '#3B3752') + ';text-decoration:' + (t.done ? 'line-through' : 'none') + '">' + esc(t.text) + '</span>' +
        (t.ref ? '<span class="task-ref">' + t.ref + '</span>' : '') +
        (state.planEditing ? '<button class="task-remove" data-action="remove-focus-task" data-task-id="' + t.id + '">✕</button>' : '') + '</div>';
    }).join('');
    var planAddRow = state.planEditing
      ? '<div class="plan-add-row"><input id="plan-add-input" class="plan-add-input" type="text" placeholder="Add a focus task…" maxlength="80"><button class="plan-add-btn" data-action="add-focus-task">Add</button></div>' : '';
    var goalsTotal = state.tasks.length, goalsDone = state.tasks.filter(function (t) { return t.done; }).length;
    var goalsPct = goalsTotal ? Math.round((goalsDone / goalsTotal) * 100) : 0;

    var appMinutes = { 'Claude Code': 148, 'Google Chrome': 96, GitHub: 74, Slack: 62, 'System Settings': 12 };
    var appList = Object.keys(appMinutes).map(function (a) { return [a, appMinutes[a]]; }).sort(function (a, b) { return b[1] - a[1]; });
    var mx = appList.length ? appList[0][1] : 1;
    var appBars = appList.map(function (pair) {
      return '<div class="app-row">' + appGlyph(pair[0], 18) + '<span class="app-name">' + pair[0] + '</span><span class="app-track"><span class="app-fill" style="width:' + Math.max(4, pair[1] / mx * 100) + '%;background:' + appColor(pair[0]) + '"></span></span><span class="app-mins">' + fmtDur(pair[1]) + '</span></div>';
    }).join('');
    var topApp = appList.length ? appList[0][0] : '';

    var catMinutes = {};
    state.dayTasks.forEach(function (t) { var c = t.cat || 'coding'; catMinutes[c] = (catMinutes[c] || 0) + taskMinutes(t); });
    var catList = Object.keys(catMinutes).map(function (c) { return [c, catMinutes[c]]; }).sort(function (a, b) { return b[1] - a[1]; });
    var catTotal = catList.reduce(function (s, p) { return s + p[1]; }, 0) || 1;
    var R = 44, CIRC = 2 * Math.PI * R, off = 0;
    var donutArcs = catList.map(function (pair) {
      var frac = pair[1] / catTotal, dash = Math.max(0, frac * CIRC - 2);
      var arc = '<circle cx="58" cy="58" r="' + R + '" fill="none" stroke="' + (CAT_HEX[pair[0]] || '#8B5CF6') + '" stroke-width="12" stroke-dasharray="' + dash + ' ' + (CIRC - dash) + '" stroke-dashoffset="' + (-off) + '" stroke-linecap="round" transform="rotate(-90 58 58)"></circle>';
      off += frac * CIRC; return arc;
    }).join('');
    var catLegend = catList.map(function (pair) {
      var pct = Math.round(pair[1] / catTotal * 100);
      return '<div class="cat-row"><span class="cat-dot" style="background:' + (CAT_HEX[pair[0]] || '#8B5CF6') + '"></span><span class="cat-name">' + (CAT_LABEL[pair[0]] || pair[0]) + '</span><span class="cat-pct">' + pct + '%</span><span class="cat-mins">' + fmtDur(pair[1]) + '</span></div>';
    }).join('');

    refs.panel.innerHTML =
      '<div class="panel-label">TODAY AT A GLANCE</div>' +
      '<div class="panel-greet">' + (pendingCount > 0 ? "You're having a solid day" : 'All wrapped up') + '</div>' +
      '<div class="panel-sub">' + fmtDur(loggedMin) + ' logged across ' + postedCount + ' work logs.</div>' +
      '<div class="today-card"><div class="panel-section-title">Today</div><div class="stat-card">' + statTiles + '</div></div>' +
      '<div class="goals-card"><div class="goals-head"><span class="panel-section-title">Today\'s focus</span><span class="edit" data-action="toggle-plan-edit">' + (state.planEditing ? 'Done' : 'Edit plan') + '</span></div>' +
        '<div class="goals-top"><span class="goals-track"><span class="goals-fill" style="width:' + goalsPct + '%"></span></span><span class="goals-pct">' + goalsPct + '%</span></div>' +
        '<div class="task-list">' + tasks + '</div>' + planAddRow + '</div>' +
      '<div class="apps-card"><div class="apps-head"><span class="panel-section-title">Time by app</span><span class="m"></span><span class="r">most in ' + topApp + '</span></div><div class="apps-rows">' + appBars + '</div></div>' +
      '<div class="apps-card cat-card"><div class="panel-section-title" style="margin-bottom:12px">Time by category</div><div class="cat-body"><svg class="cat-donut" width="116" height="116" viewBox="0 0 116 116"><circle cx="58" cy="58" r="' + R + '" fill="none" stroke="#EEE9FB" stroke-width="12"></circle>' + donutArcs + '<text x="58" y="54" text-anchor="middle" class="cat-donut-num">' + fmtDur(catTotal) + '</text><text x="58" y="70" text-anchor="middle" class="cat-donut-lbl">Total</text></svg><div class="cat-legend">' + catLegend + '</div></div></div>';
  }

  function ticketPickerRows(currentKey, query) {
    var q = (query || '').trim().toLowerCase();
    var rows = TICKET_POOL.filter(function (o) { return !q || o.key.toLowerCase().indexOf(q) >= 0 || o.title.toLowerCase().indexOf(q) >= 0; });
    if (!rows.length) return '<div class="tpk-empty">Nothing matches "' + esc(query) + '".</div>';
    return rows.map(function (o) {
      var isCurrent = o.key === currentKey;
      return '<button class="tpk-row' + (isCurrent ? ' current' : '') + '" ' + (isCurrent ? '' : 'data-action="pick-ticket" data-task-id="{{TID}}" data-key="' + o.key + '"') + '><span class="tpk-key">' + o.key + '</span><span class="tpk-title">' + esc(o.title) + '</span>' + (isCurrent ? '<span class="tpk-current">Current</span>' : '') + '</button>';
    }).join('');
  }

  function renderWorklogFooter(t, w, accent) {
    if (w.phase === 'generating') {
      return '<div class="dt-generating" role="status" aria-live="polite"><div class="dt-generating-top"><span class="dt-generating-label"><span>✨</span> Generating your worklog…</span><span class="dt-generating-note">this might take a minute or so</span></div><div class="dt-generating-track"><span class="dt-generating-fill" style="background:' + accent + '"></span></div><p class="dt-generating-detail">Reading your work, comparing it against today\'s tasks and drafting the update - you can keep using Meridian while this runs.</p></div>';
    }
    if (!w.draft) {
      return '<button class="dt-gen-btn" data-action="generate-worklog" data-task-id="' + t.id + '" style="background:' + accent + '">✨ Generate worklog</button><div class="dt-gen-copy">Meridian checks this work against <b style="color:#211D3D">today\'s tasks only</b> and writes a short status update. Nothing posts until you approve it.</div>';
    }
    if (w.posted) {
      return '<div class="dt-posted"><span class="dt-posted-pill">' + jiraIcon(15) + '<span class="dt-posted-t">Posted to ' + w.draft.targetKey + '</span></span><span class="dt-link-chip">Linked to ' + w.draft.targetKey + ' ↗</span></div>';
    }
    if (w.picking) {
      return '<div class="tpk"><div class="tpk-head"><span class="tpk-title-lbl">Pick the ticket this work belongs to</span><span class="edit" data-action="cancel-ticket-picker" data-task-id="' + t.id + '">Cancel</span></div><input id="tpk-search" class="tpk-search" type="text" placeholder="Search ' + TICKET_POOL.length + ' open tickets…"><div id="tpk-rows" class="tpk-rows">' + ticketPickerRows(w.draft.targetKey, '').split('{{TID}}').join(t.id) + '</div></div>';
    }
    if (w.confirming) {
      var busy = w.phase === 'approving';
      return '<div class="dt-confirm"><p class="dt-confirm-copy">Post this update to <b style="color:#211D3D">' + w.draft.targetKey + '</b>?</p><div class="dt-confirm-actions"><button class="dt-confirm-yes" data-action="approve-post" data-task-id="' + t.id + '" ' + (busy ? 'disabled' : '') + '>' + (busy ? 'Posting…' : 'Yes, post') + '</button><button class="dt-confirm-cancel" data-action="cancel-confirm" data-task-id="' + t.id + '" ' + (busy ? 'disabled' : '') + '>Cancel</button></div></div>';
    }
    return '<div class="dt-draft"><div class="dt-draft-head"><span class="dt-draft-eyebrow"><span>✨</span> Matched to</span><div class="dt-draft-target"><span class="dt-draft-target-key">' + jiraIcon(11) + w.draft.targetKey + '</span><span class="dt-draft-target-title">' + esc(w.draft.targetTitle) + '</span></div><span class="dt-draft-source">Matched automatically from your Jira board</span></div><div class="dt-draft-actions"><button class="dt-approve-btn" data-action="confirm-post" data-task-id="' + t.id + '" style="background:' + accent + ';box-shadow:0 8px 22px -10px ' + accent + '">Approve &amp; post</button><button class="dt-regen-btn" data-action="generate-worklog" data-task-id="' + t.id + '" title="Regenerate - overwrites this draft">↻</button></div><button class="dt-retarget-btn" data-action="open-ticket-picker" data-task-id="' + t.id + '">Match to a different ticket</button></div>';
  }

  function renderDetailPanel(t) {
    var accent = hueColor(t.hue);
    var lo = taskStart(t), hi = taskEnd(t), mins = taskMinutes(t);
    var segHtml = t.segments.map(function (seg, i) {
      var prev = t.segments[i - 1], gap = prev ? seg[0] - prev[1] : 0;
      var breakHtml = gap > 0 ? '<div class="dt-break"><span class="lbl">break · ' + fmtDur(gap) + '</span><span class="line"></span></div>' : '';
      return breakHtml + '<div class="dt-seg"><span class="bar" style="background:' + accent + '"></span><span class="rng">' + fmtClock(seg[0]) + ' – ' + fmtClock(seg[1]) + '</span><span class="dur">' + fmtDur(seg[1] - seg[0]) + '</span></div>';
    }).join('');
    var footerHtml = renderWorklogFooter(t, wl(t.id), accent);
    refs.panel.innerHTML =
      '<button class="dt-back" data-action="clear-selection"><span>‹</span> Back to today</button>' +
      '<div class="dt-header"><span class="dt-header-dot" style="background:' + accent + '"></span><div style="flex:1;min-width:0"><div class="dt-eyebrow">Task</div><div class="dt-title">' + esc(t.title) + '</div><div class="dt-meta"><span class="rng" style="color:' + accent + ';font:700 12px -apple-system,BlinkMacSystemFont,\'SF Pro Text\',system-ui,sans-serif">' + fmtDur(mins) + '</span><span class="rng" style="font:600 11px -apple-system,BlinkMacSystemFont,\'SF Pro Text\',system-ui,sans-serif;color:#948FB8">' + fmtClock(lo) + ' – ' + fmtClock(hi) + '</span></div></div></div>' +
      '<div class="dt-when-card"><div class="dt-what" style="margin-top:0"><div class="lbl">When</div>' + segHtml + '</div></div>' +
      '<div class="dt-what"><div class="lbl">What was done</div><ul>' + t.summary.map(function (s) { return '<li><span class="b" style="color:' + accent + '">·</span><span>' + esc(s) + '</span></li>'; }).join('') + '</ul></div>' +
      '<div class="dt-footer">' + footerHtml + '</div>';
  }

  function render() { renderToolbar(); renderTimeline(); renderPanel(); }

  // ── event delegation ─────────────────────────────────────────────────
  var ACTIONS = { 'toggle-capture': toggleCapture, 'toggle-jira': toggleJira, 'reset': resetAll, 'clear-selection': clearSelection, 'noop': function () {} };
  refs.root.addEventListener('click', function (e) {
    if (pendingUserClick) {
      var hit = e.target.closest(pendingUserClick.selector);
      if (hit) { var r = pendingUserClick.resolve; pendingUserClick = null; r(); }
      return;
    }
    if (mode === 'intro') return;
    var el = e.target.closest('[data-action]');
    if (!el) { if (e.target.closest('#tl-scale') && !e.target.closest('.tl-band')) clearSelection(); return; }
    var action = el.dataset.action; e.stopPropagation();
    if (action === 'toggle-task') return toggleTask(el.dataset.taskId);
    if (action === 'generate-worklog') return generateWorklog(el.dataset.taskId);
    if (action === 'open-ticket-picker') return openTicketPicker(el.dataset.taskId);
    if (action === 'cancel-ticket-picker') return cancelTicketPicker(el.dataset.taskId);
    if (action === 'pick-ticket') return pickTicket(el.dataset.taskId, el.dataset.key);
    if (action === 'confirm-post') return confirmPost(el.dataset.taskId);
    if (action === 'cancel-confirm') return cancelConfirm(el.dataset.taskId);
    if (action === 'approve-post') return approvePost(el.dataset.taskId);
    if (action === 'toggle-plan-edit') return togglePlanEdit();
    if (action === 'remove-focus-task') return removeFocusTask(el.dataset.taskId);
    if (action === 'add-focus-task') return addFocusTask();
    if (action === 'select-task') return selectTask(el.dataset.taskId);
    if (action === 'open-summary') return openSummary();
    if (action === 'close-summary') return closeSummary();
    if (action === 'summary-select-task') return summarySelectTask(el.dataset.taskId);
    if (action === 'summary-back') return summaryBack();
    if (action === 'summary-post') return summaryPost(el.dataset.taskId);
    if (action === 'copy-standup') return copyStandup();
    var handler = ACTIONS[action]; if (handler) handler();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target && e.target.id === 'plan-add-input') addFocusTask(); });
  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'tpk-search') {
      var t = state.selectedTaskId != null ? state.dayTasks.find(function (x) { return x.id === state.selectedTaskId; }) : null;
      var rows = document.getElementById('tpk-rows');
      if (t && rows) rows.innerHTML = ticketPickerRows(wl(t.id).draft.targetKey, e.target.value).split('{{TID}}').join(t.id);
    }
  });

  // ── clock ──────────────────────────────────────────────────────────────
  var CIRC96 = 2 * Math.PI * 96;
  function buildClock() {
    var ticks = '';
    for (var i = 0; i < 12; i++) {
      var a = (i / 12) * Math.PI * 2, x1 = 110 + Math.sin(a) * 70, y1 = 110 - Math.cos(a) * 70, x2 = 110 + Math.sin(a) * (i % 3 === 0 ? 60 : 64), y2 = 110 - Math.cos(a) * (i % 3 === 0 ? 60 : 64);
      ticks += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#D8CFF0" stroke-width="' + (i % 3 === 0 ? 2.4 : 1.4) + '" stroke-linecap="round"></line>';
    }
    refs.clock.innerHTML =
      '<div class="mclock__dial"><svg viewBox="0 0 220 220" width="220" height="220">' +
        '<circle cx="110" cy="110" r="96" fill="none" stroke="#ECE5FA" stroke-width="7"></circle>' +
        '<circle class="mclock__prog" cx="110" cy="110" r="96" fill="none" stroke="#8B5CF6" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + CIRC96 + '" stroke-dashoffset="' + CIRC96 + '" transform="rotate(-90 110 110)"></circle>' +
        '<circle cx="110" cy="110" r="82" fill="#fff"></circle>' + ticks +
        '<line class="mclock__hour" x1="110" y1="110" x2="110" y2="64" stroke="#332A63" stroke-width="5.5" stroke-linecap="round"></line>' +
        '<line class="mclock__min" x1="110" y1="110" x2="110" y2="46" stroke="#6D28D9" stroke-width="3.5" stroke-linecap="round"></line>' +
        '<circle cx="110" cy="110" r="6" fill="#332A63"></circle><circle cx="110" cy="110" r="2.4" fill="#fff"></circle>' +
      '</svg></div>' +
      '<div class="mclock__read"><div class="mclock__time">9:00</div><div class="mclock__ap">AM</div></div>' +
      '<div class="mclock__label">Morning</div>';
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mixRgb(c0, c1, t) { return 'rgb(' + Math.round(lerp(c0[0], c1[0], t)) + ',' + Math.round(lerp(c0[1], c1[1], t)) + ',' + Math.round(lerp(c0[2], c1[2], t)) + ')'; }
  function dayColor(frac) {
    var amber = [245, 158, 11], violet = [139, 92, 246], indigo = [99, 102, 241];
    return frac < 0.5 ? mixRgb(amber, violet, frac / 0.5) : mixRgb(violet, indigo, (frac - 0.5) / 0.5);
  }
  function updateClock(minFrom9) {
    var abs = 540 + minFrom9, h = Math.floor(abs / 60), m = abs % 60;
    var hourAngle = ((h % 12) + m / 60) / 12 * 360, minAngle = (m / 60) * 360;
    var hourEl = refs.clock.querySelector('.mclock__hour'), minEl = refs.clock.querySelector('.mclock__min');
    if (hourEl) hourEl.setAttribute('transform', 'rotate(' + hourAngle + ' 110 110)');
    if (minEl) minEl.setAttribute('transform', 'rotate(' + minAngle + ' 110 110)');
    var hr = h % 12; if (hr === 0) hr = 12;
    var timeEl = refs.clock.querySelector('.mclock__time'), apEl = refs.clock.querySelector('.mclock__ap');
    var md = Math.floor(m);
    if (timeEl) timeEl.textContent = hr + ':' + (md < 10 ? '0' : '') + md;
    if (apEl) apEl.textContent = h >= 12 ? 'PM' : 'AM';
    var label = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
    var lblEl = refs.clock.querySelector('.mclock__label'); if (lblEl) lblEl.textContent = label;
    var frac = Math.max(0, Math.min(1, (abs - 540) / 540));
    var prog = refs.clock.querySelector('.mclock__prog');
    if (prog) { prog.setAttribute('stroke-dashoffset', CIRC96 * (1 - frac)); prog.setAttribute('stroke', dayColor(frac)); }
    if (minEl) minEl.setAttribute('stroke', dayColor(frac));
  }

  // ── tween / sleep with abort ────────────────────────────────────────
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function tween(from, to, dur, onUpd) {
    return new Promise(function (res) {
      var t0 = performance.now();
      function frame(now) {
        if (aborted) return res();
        var p = Math.min(1, (now - t0) / dur), e = easeInOut(p);
        onUpd(from + (to - from) * e, e);
        if (p < 1) { rafId = requestAnimationFrame(frame); } else res();
      }
      rafId = requestAnimationFrame(frame);
    });
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ── build-phase reveal ──────────────────────────────────────────────
  function buildSkeleton() {
    renderTimeline();
    var scale = refs.timeline.querySelector('#tl-scale');
    scale.querySelectorAll('.tl-band,.tl-hourline').forEach(function (e) { e.classList.add('is-pre'); });
    var nl = document.createElement('div');
    nl.className = 'tl-nowline';
    nl.innerHTML = '<span class="tl-nowline__t">9:00 AM</span><span class="tl-nowline__rule"></span>';
    nl.style.top = '0px';
    scale.appendChild(nl);
    var sl = document.createElement('div'); sl.className = 'tl-spine-lit'; sl.style.height = '0px';
    scale.appendChild(sl);
    setHead(0, 0);
    refs.panel.innerHTML =
      '<div class="mpanel-replay"><div class="mpanel-replay__top"><span class="mpanel-wait__dot"></span>Rebuilding your day&hellip;</div></div>';
  }
  function setHead(count, tracked) {
    var g = refs.timeline.querySelector('.tl-head .greet'), tr = refs.timeline.querySelector('.tl-head .tracked');
    if (g) g.textContent = count + (count === 1 ? ' task today' : ' tasks today');
    if (tr) tr.textContent = fmtDur(tracked) + ' tracked';
  }
  function popMerge(el) {
    var b = document.createElement('div');
    b.className = 'tl-merge-badge';
    b.textContent = '↝ 2 sittings merged into one';
    el.appendChild(b);
    b.animate([{ opacity: 0, transform: 'translateY(4px) scale(.9)' }, { opacity: 1, transform: 'none', offset: 0.18 }, { opacity: 1, transform: 'none', offset: 0.75 }, { opacity: 0, transform: 'translateY(-3px)' }], { duration: 2100, easing: 'ease' });
    setTimeout(function () { if (b.parentNode) b.remove(); }, 2100);
  }
  function advanceNow(m) {
    var scale = refs.timeline.querySelector('#tl-scale');
    if (!scale) return;
    var nl = scale.querySelector('.tl-nowline');
    if (nl) { nl.style.top = (m * PXPM) + 'px'; var t = nl.querySelector('.tl-nowline__t'); if (t) t.textContent = fmtClock(Math.max(0, Math.round(m))); }
    var lit = Math.min(Math.max(0, m), 480);
    var sl = scale.querySelector('.tl-spine-lit');
    if (sl) sl.style.top = (lit * PXPM) + 'px';   // glow blob pinned to the now-line (no transition = in sync)
    scale.querySelectorAll('.tl-hourline').forEach(function (hl) {
      var top = parseFloat(hl.style.top) || 0;
      var hm = Math.round(top / PXPM);
      if (hm <= m + 1) hl.classList.remove('is-pre');
      var d = hl.querySelector('.hl-dot');
      if (d) { if (hm <= 480 && Math.abs(lit - hm) < 24) d.classList.add('is-lit'); else d.classList.remove('is-lit'); }
    });
    state.dayTasks.forEach(function (t) {
      if (revealed[t.id]) return;
      if (taskStart(t) <= m) {
        revealed[t.id] = true;
        var el = scale.querySelector('.tl-band[data-task-id="' + t.id + '"]');
        if (el) { el.classList.remove('is-pre'); if (t.segments.length > 1) popMerge(el); }
        var revList = state.dayTasks.filter(function (x) { return revealed[x.id]; });
        setHead(revList.length, unionMinutes(revList));
      }
    });
  }

  // ── overlays ─────────────────────────────────────────────────────────
  function mqWords(text, hl, base, step, grad, pop) {
    base = base || 0; step = step || 0.16;
    return text.split(' ').map(function (w, i) {
      var isHl = hl && hl.indexOf(i) >= 0;
      var cls = 'mqw' + (pop ? ' mqw--q' : '') + (isHl ? ' mq__hl' : (grad ? ' mqw--head' : ''));
      return '<span class="' + cls + '" style="animation-delay:' + (base + i * step).toFixed(2) + 's">' + w + '</span>';
    }).join(' ');
  }
  function showCaption() {
    refs.question.style.opacity = ''; refs.question.style.transition = '';
    refs.question.className = 'mquestion mq--underclock mq--instant';
    refs.question.innerHTML =
      '<div class="mq__head">' + mqWords('You did a lot today', [3], 0.1, 0.2, true, true) + '</div>' +
      '<div class="mq__sub">' + mqWords('Nine hours. Barely looked up.', null, 1.15, 0.11, false, true) + '</div>';
    void refs.question.offsetWidth;
    refs.question.classList.add('is-on');
  }
  function showQuestion() {
    refs.question.style.opacity = ''; refs.question.style.transition = '';
    refs.question.className = 'mquestion mq--bottom mq--instant';
    refs.question.innerHTML =
      '<div class="mq__eyebrow">rewind the day</div>' +
      '<div class="mq__head">' + mqWords('But… what did you actually do?', [5], 0.15, 0.22, true, true) + '</div>' +
      '<div class="mq__sub">' + mqWords('By evening, it’s all a blur.', null, 1.75, 0.11, false, true) + '</div>';
    void refs.question.offsetWidth;
    refs.question.classList.add('is-on');
  }
  function hideQuestion() { refs.question.classList.remove('is-on'); }

  async function finishAndHandoff() {
    advanceNow(600);
    updateClock(540);
    await sleep(260); if (aborted) return;
    var nl = refs.timeline.querySelector('.tl-nowline'); if (nl) nl.remove();
    renderTimeline();
    refs.clock.className = 'mclock mclock--gone';
    camera('scale(1)', 1200);
    renderPanel();
    refs.panel.animate([{ opacity: 0, transform: 'translateX(14px)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.25,1)' });
    await sleep(950); if (aborted) return;
    await runSummaryDemo(); if (aborted) return;
    await sleep(400); if (aborted) return;
    await runPrivacyScene(); if (aborted) return;
    fireDone();
  }

  // ── privacy scene ──────────────────────────────────────────────────────
  function privIcon(kind) {
    var s = 'width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    if (kind === 'lock') return '<svg ' + s + '><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
    if (kind === 'code') return '<svg ' + s + '><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>';
    return '<svg ' + s + '><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="10" y1="8" x2="14" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>';
  }
  async function runPrivacyScene() {
    refs.privacy.innerHTML =
      '<div class="mpriv__eyebrow">Privacy by design</div>' +
      '<div class="mpriv__head">Your data never has to <span class="mpriv__hl">leave your device.</span></div>' +
      '<div class="mpriv__stage">' +
        '<div class="mpriv__glow"></div>' +
        '<img class="mpriv__logo" src="/assets/images/meridian-mark.png" alt="Meridian">' +
        '<div class="mpriv__badge mpriv__badge--top">' + privIcon('lock') + 'Local &amp; on-device</div>' +
        '<div class="mpriv__badge mpriv__badge--left">' + privIcon('code') + 'Open source</div>' +
        '<div class="mpriv__badge mpriv__badge--right">' + privIcon('sliders') + 'You control it</div>' +
      '</div>' +
      '<div class="mpriv__foot">Meridian runs entirely on your device — <b>nothing is uploaded, nothing phones home.</b></div>';
    void refs.privacy.offsetWidth;
    refs.privacy.classList.add('is-on');
    await sleep(780); if (aborted) return;
    // privacy now covers the summary — close it underneath, no flash
    closeSummary();
    setSummaryCaption('');
    await sleep(320); if (aborted) return;
    var badges = refs.privacy.querySelectorAll('.mpriv__badge');
    for (var i = 0; i < badges.length; i++) {
      badges[i].classList.add('is-pop');
      await sleep(520); if (aborted) return;
    }
    await sleep(1400); if (aborted) return;
    var foot = refs.privacy.querySelector('.mpriv__foot');
    if (foot) { foot.innerHTML = 'It’s open source, so <b>every line of code can be audited.</b>'; }
    await sleep(2600); if (aborted) return;
    if (foot) { foot.className = 'mpriv__foot mpriv__foot--final'; foot.innerHTML = 'Privacy isn’t a feature. It’s the foundation.'; }
    await sleep(2600); if (aborted) return;
    refs.privacy.classList.remove('is-on');
    await sleep(800); if (aborted) return;
  }

  async function runSummaryDemo() {
    showCursor();
    await sleep(900); if (aborted) return;
    var pill = refs.toolbarLeftExtra.querySelector('.sumpill');
    camera('scale(1.1) translate(30px,26px)', 1600);   // zoom in on the Daily-summary pill
    cursorTo(pill, 1400);
    if (pill) pill.classList.add('sumpill--hot');
    await sleep(1700); if (aborted) return;
    cursorClick();
    await sleep(400); if (aborted) return;
    setSummaryCaption('This is your Daily Summary — built automatically at the end of every day.');
    openSummary();
    camera('scale(1)', 850);                            // zoom back out to reveal the summary
    if (pill) setTimeout(function () { pill.classList.remove('sumpill--hot'); }, 600);
    await sleep(3400); if (aborted) return;
    setSummaryCaption('2 of 3 done. Click a finished task to post it to Jira.');
    var card0 = document.getElementById('msum-card'); if (card0) card0.scrollTop = 0;
    state.nudgeTaskId = 'c2'; renderSummary();
    await sleep(900); if (aborted) return;
    camera('scale(1.05) translate(0,-20px)', 1000);     // ease in on the task about to be clicked
    cursorTo(document.querySelector('.msum-row[data-task-id="d5"]'), 1000);
    await sleep(1100); if (aborted) return;
    // hand control to the user — fast fallback so it never stalls
    await waitForUserClick('.msum-row[data-task-id="d5"]', 3200); if (aborted) return;
    cursorClick();
    await sleep(350); if (aborted) return;
    state.nudgeTaskId = null;
    summarySelectTask('d5');
    setSummaryCaption('This is the worklog update Meridian wrote for that task — post it straight to Jira.');
    await sleep(2800); if (aborted) return;
    // auto-click the "Post to Jira" button for them
    camera('scale(1.06) translate(0,-20px)', 1100);      // zoom in on the Post-to-Jira click
    cursorTo(refs.summary.querySelector('.msum-tk-post'), 1200);
    await sleep(1300); if (aborted) return;
    cursorClick();
    summaryPost('d5');
    sfx('posted');
    setSummaryCaption('Posting to Jira…');
    await sleep(1400); if (aborted) return;
    setSummaryCaption('Logged to Jira ✓ — posted for you, no ticket-hunting.');
    await sleep(1900); if (aborted) return;
    // back to the daily summary, reveal the standup update
    camera('scale(1)', 850);                            // zoom out before returning to the summary
    summaryBack();
    var cb = document.getElementById('msum-card'); if (cb) cb.scrollTop = cb.scrollHeight;
    setSummaryCaption('Your standup update is written and ready to share.');
    await sleep(1700); if (aborted) return;
    // cursor to Copy → click → Copied
    camera('scale(1.06) translate(-34px,-18px)', 1050); // zoom in on the standup card (right side)
    cursorTo(refs.summary.querySelector('.msum-standup__copy'), 1000);
    await sleep(1100); if (aborted) return;
    cursorClick();
    copyStandup();
    sfx('posted');
    setSummaryCaption('Copied — paste it straight into Slack or standup.');
    await sleep(1600); if (aborted) return;
    camera('scale(1)', 950);                             // zoom back out
    hideCursor();
    await sleep(650); if (aborted) return;
  }

  function skip() {
    if (mode === 'live') return;
    aborted = true;
    if (pendingUserClick) { var pr = pendingUserClick.resolve; pendingUserClick = null; pr(); }
    if (rafId) cancelAnimationFrame(rafId);
    state.dayTasks.forEach(function (t) { revealed[t.id] = true; });
    refs.scrim.classList.add('is-off');
    refs.question.classList.remove('is-on');
    if (refs.summary) refs.summary.classList.remove('is-on');
    if (refs.privacy) refs.privacy.classList.remove('is-on');
    if (refs.cursor) refs.cursor.classList.remove('is-on');
    state.nudgeTaskId = null;
    var nl = refs.timeline.querySelector('.tl-nowline'); if (nl) nl.remove();
    clearDay();
    blackout(false);
    refs.root.classList.remove('intro-clean');
    if (document.body) document.body.classList.remove('intro');
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    camera('scale(1)', 0);
    renderTimeline();
    refs.clock.className = 'mclock mclock--gone';
    renderPanel();
    refs.pointer.classList.add('is-on');
    mode = 'live';
    fireDone();
  }

  // ── intro "a day in the life" scene ─────────────────────────────────
  // App-activity chips surface in time order behind the clock as it sweeps the
  // day; the background warms in the morning and dims toward evening, ending on
  // a "logged off" beat — so the viewer feels a full, blurry day go by.
  var DAY_MOMENTS = [
    { at: 12,  app: 'Slack',         label: 'Slack catch-up',        x: 232, y: '25%' },
    { at: 80,  app: 'Microsoft Teams', label: 'Team standup',        x: 946, y: '21%' },
    { at: 165, app: 'Claude Code',   label: 'Heads-down coding',     x: 196, y: '56%' },
    { at: 250, app: 'GitHub',        label: 'Reviewing a PR',        x: 980, y: '58%' },
    { at: 345, app: 'Claude Code',   label: 'Shipping a fix',        x: 244, y: '39%' },
    { at: 440, app: 'Google Chrome', label: 'A talk in the background', x: 912, y: '45%' },
  ];
  function dayLayer() { return refs.root.querySelector('.mday'); }
  function clearDay() { var l = dayLayer(); if (l) l.remove(); }
  function setupDay() {
    var body = refs.root.querySelector('.bodyrow'); if (!body) return;
    clearDay();
    DAY_MOMENTS.forEach(function (mo) { mo._done = false; });
    var layer = document.createElement('div');
    layer.className = 'mday';
    layer.innerHTML = '<div class="mday-glow"></div><div class="mday-vig"></div><div class="mday-off"></div>';
    body.appendChild(layer);
  }
  function spawnMoment(mo) {
    var layer = dayLayer(); if (!layer) return;
    var chip = document.createElement('div');
    chip.className = 'mday-chip';
    chip.style.left = mo.x + 'px';
    chip.style.top = mo.y;
    chip.style.setProperty('--tx', mo.x >= 620 ? '12px' : '-12px');
    chip.innerHTML = appGlyph(mo.app, 26) + '<span class="mday-chip__t">' + esc(mo.label) + '</span>';
    layer.appendChild(chip);
    void chip.offsetWidth;
    chip.classList.add('is-in');
    setTimeout(function () {
      if (!chip.parentNode) return;
      chip.classList.remove('is-in'); chip.classList.add('is-out');
      setTimeout(function () { if (chip.parentNode) chip.remove(); }, 650);
    }, 2000);
  }
  function paintDay(m) {
    var frac = Math.max(0, Math.min(1, m / 540));
    var layer = dayLayer(); if (!layer) return;
    var glow = layer.querySelector('.mday-glow'), vig = layer.querySelector('.mday-vig');
    if (glow) {
      var warm = (0.42 * (1 - frac)).toFixed(3);
      glow.style.background = 'radial-gradient(circle at 50% 38%, rgba(245,158,11,' + warm + '), rgba(245,158,11,0) 52%)';
      glow.style.opacity = '1';
    }
    if (vig) vig.style.opacity = Math.max(0, (frac - 0.45) / 0.55).toFixed(3);
    for (var k = 0; k < DAY_MOMENTS.length; k++) {
      var mo = DAY_MOMENTS[k];
      if (!mo._done && m >= mo.at) { mo._done = true; spawnMoment(mo); }
    }
  }
  function dayLogOff(on) { var l = dayLayer(); if (!l) return; var off = l.querySelector('.mday-off'); if (off) off.style.opacity = on ? '1' : '0'; }
  function showLaptop() {
    var l = dayLayer(); if (!l) return;
    var lap = l.querySelector('.mday-laptop');
    if (!lap) { lap = document.createElement('div'); lap.className = 'mday-laptop'; lap.innerHTML = '<div class="lap-screen"></div><div class="lap-base"></div>'; l.appendChild(lap); }
    void lap.offsetWidth; lap.classList.add('is-in');
  }
  function closeLaptop() { var l = dayLayer(); if (!l) return; var lap = l.querySelector('.mday-laptop'); if (lap) lap.classList.add('is-closed'); }
  function hideLaptop() { var l = dayLayer(); if (!l) return; var lap = l.querySelector('.mday-laptop'); if (lap) lap.classList.remove('is-in'); }
  function showTired() {
    var l = dayLayer(); if (!l) return;
    var t = l.querySelector('.mday-tired');
    if (!t) { t = document.createElement('div'); t.className = 'mday-tired'; t.textContent = '\uD83D\uDE2E\u200D\uD83D\uDCA8'; l.appendChild(t); }
    void t.offsetWidth; t.classList.add('is-in');
  }
  function tiredCloses() { var l = dayLayer(); if (!l) return; var t = l.querySelector('.mday-tired'); if (t) t.classList.add('is-close'); }
  function hideTired() { var l = dayLayer(); if (!l) return; var t = l.querySelector('.mday-tired'); if (t) t.classList.remove('is-in'); }
  function blackout(on) {    refs.root.classList.toggle('is-black', on);
    refs.scrim.classList.toggle('is-black', on);
    if (document.body) document.body.classList.toggle('blackout', on);
    try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'meridian-blackout', on: on }, '*'); } catch (e) {}
  }

  // ── intro sequence ─────────────────────────────────────────────────────
  // camera: an extra transform on #desk that composes with the fit-scaler, used
  // for product-demo style push-ins / pull-outs during the intro.
  function camera(transform, dur) {
    var d = document.getElementById('desk'); if (!d) return;
    d.style.transitionDuration = (dur == null ? 1300 : dur) + 'ms';
    d.style.transform = transform || 'none';
  }

  async function runIntro() {
    renderToolbar();
    buildSkeleton();
    buildClock();
    updateClock(0);
    blackout(false);
    refs.root.classList.add('intro-clean');   // device blends into the dark stage — no chrome/border
    if (document.body) document.body.classList.add('intro');
    refs.scrim.classList.remove('is-off');     // opaque cover on
    refs.clock.className = 'mclock mclock--hero';
    camera('scale(1)', 0);
    setupDay();
    await sleep(700); if (aborted) return;
    // ── teaser: the day plays out — app moments surface as the clock sweeps 9 → 5,
    //    the light warms then dims toward evening, with a slow cinematic push-in
    camera('scale(1.045)', 8600);
    var capShown = false;
    await tween(0, 540, 6400, function (m) {
      updateClock(m); paintDay(m);
      if (!capShown && m >= 480) { capShown = true; showCaption(); }  // ~5pm, without stopping the tick
    }); if (aborted) return;
    await sleep(650); if (aborted) return;
    // ── the timer goes, the laptop comes in; the caption then shrinks, rises, and
    //    disappears into the laptop screen. Lid folds, laptop leaves, blank holds,
    //    then the question types in.
    refs.clock.style.transition = 'opacity .5s ease';
    refs.clock.style.opacity = '0';                // let the timer go
    var dld = dayLayer();                           // lift the evening darkening so no black rect shows yet
    if (dld) dld.querySelectorAll('.mday-vig,.mday-off,.mday-glow').forEach(function (el) { el.style.transition = 'opacity .6s ease'; el.style.opacity = '0'; });
    showLaptop();                                   // open, empty glowing screen
    await sleep(950); if (aborted) return;
    refs.question.classList.remove('mq--instant');
    refs.question.classList.add('mq--intoscreen');  // become smaller, rise, fade into the screen
    await sleep(1150); if (aborted) return;
    hideQuestion();                                 // fully gone before the lid moves
    closeLaptop();                                  // lid folds down on a blank screen
    await sleep(1000); if (aborted) return;
    hideLaptop();                                   // laptop fades away
    // ── blank screen, then the question types in word by word
    blackout(true);
    var dl = dayLayer(); if (dl) { dl.style.transition = 'opacity .6s ease'; dl.style.opacity = '0'; }
    await sleep(1500); if (aborted) return;
    clearDay();
    // ── reset: clock back at centre (hidden)
    refs.clock.style.transition = 'none';
    refs.clock.className = 'mclock mclock--hero';
    refs.clock.style.opacity = '0';
    void refs.clock.offsetWidth;
    refs.clock.style.transition = '';
    camera('scale(1)', 0);
    // ── the question types in word by word on the black screen; the clock eases
    //    back in and reverses
    showQuestion();
    await sleep(700); if (aborted) return;
    refs.clock.style.opacity = '';
    await sleep(560); if (aborted) return;
    await tween(540, 0, 3400, function (m) { updateClock(m); }); if (aborted) return;
    await sleep(1500); if (aborted) return;
    hideQuestion();
    await sleep(760); if (aborted) return;
    // ── the UI arrives: cover fades, device gains its frame, camera settles from a
    //    slight zoom-in, and the clock glides to the right of the UI
    refs.root.classList.remove('intro-clean');
    if (document.body) document.body.classList.remove('intro');
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    blackout(false);
    refs.scrim.classList.add('is-off');
    refs.clock.className = 'mclock mclock--dock';
    camera('scale(1.06)', 0);
    void document.getElementById('desk').offsetWidth;
    camera('scale(1)', 1400);
    await sleep(1300); if (aborted) return;
    // ── build: the day replays hour by hour — ease in a little while it ticks,
    //    then pull back out as it reaches 6 PM
    var stops = [60, 120, 180, 240, 300, 360, 420, 480, 540, 552];
    var prev = 0;
    for (var i = 0; i < stops.length; i++) {
      if (i === 1) camera('scale(1.06) translate(48px,-4px)', 3000);
      if (i === 8) camera('scale(1)', 1700);
      await tween(prev, stops[i], 820, function (m) { updateClock(Math.min(m, 540)); advanceNow(m); });
      if (aborted) return;
      prev = stops[i];
      await sleep(300); if (aborted) return;
    }
    await finishAndHandoff();
  }

  function startLive() {
    renderToolbar();
    render();
    clearDay();
    blackout(false);
    refs.root.classList.remove('intro-clean');
    if (document.body) document.body.classList.remove('intro');
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    camera('scale(1)', 0);
    refs.scrim.classList.add('is-off');
    refs.clock.className = 'mclock mclock--gone';
    refs.pointer.classList.add('is-on');
    mode = 'live';
  }

  return { start: function () { if (opts.autoplay === false) startLive(); else runIntro(); } };
}

if (typeof window !== 'undefined') window.createDemo = createDemo;

// ── bootstrap: scale the fixed 1240×720 stage to the viewport, wire refs, boot ──
(function () {
  if (typeof document === 'undefined') return;
  var g = function (id) { return document.getElementById(id); };
  function fit() {
    var s = g('scaler'); if (!s) return;
    var b = document.body;
    var pad = (b && b.classList.contains('cinema-embed') && !b.classList.contains('intro')) ? 40 : 0;
    var scale = Math.min((window.innerWidth - pad * 2) / 1240, (window.innerHeight - pad * 2) / 720);
    s.style.transform = 'scale(' + scale + ')';
  }
  function boot() {
    if (!g('scaler')) return; // not on demo.html
    fit();
    window.addEventListener('resize', fit);

    var refs = {
      root: g('device'),
      timeline: g('timeline'),
      panel: g('panel'),
      toolbarLeftExtra: g('toolbar-left-extra'),
      toolbarActions: g('toolbar-actions'),
      clock: g('mclock'),
      scrim: g('mscrim'),
      question: g('mquestion'),
      pointer: g('mpointer'),
      summary: g('msummary'),
      cursor: g('mcursor'),
      privacy: g('mprivacy'),
    };
    var params = new URLSearchParams(location.search);
    var live = params.has('live');
    try { if (window.self !== window.top && !live && document.body) document.body.classList.add('cinema-embed'); } catch (e) {}
    var opts = {
      autoplay: !live,
      onDone: function () {
        try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'meridian-intro-done' }, '*'); } catch (e) {}
      },
    };
    window.__meridianDemo = createDemo(refs, opts);
    window.__meridianDemo.start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
if (typeof window !== 'undefined') window.createDemo = createDemo;
