/*
 * Meridian embedded product demo: a self-contained recreation of the app's
 * daily timeline, insights panel, and swipe-to-approve/dismiss review modal.
 * All state lives in `state`; every mutation calls render(), which re-renders
 * only the affected DOM regions (toolbar/timeline/panel/floating/review).
 */
(function () {
  'use strict';

  var APP_COLORS = {
    'Claude Code': '#D97757', 'VS Code': '#4F8FEF', 'Jira': '#2684FF', 'Slack': '#E01E5A',
    'Zoom': '#2D8CFF', 'iTerm': '#25A06A', 'GitHub': '#57606A', 'Postman': '#FF6C37',
    'Safari': '#2AA9FF', 'DevTools': '#4285F4', 'Figma': '#F24E1E',
  };
  var TICKET_POOL = [
    { key: 'MER-482', title: 'Fix token-refresh race condition in auth' },
    { key: 'MER-495', title: 'Redis session store — eviction & TTL' },
    { key: 'MER-501', title: 'Sprint planning & board grooming' },
    { key: 'MER-475', title: 'Add cursor pagination to activity-feed API' },
    { key: 'MER-510', title: 'Polish onboarding empty states' },
  ];

  function initialState() {
    return {
      capture: true,
      jiraConnected: true,
      selectedItemId: null,
      reviewOpen: false, reviewQueue: [], reviewPos: 0,
      tasks: [
        { id: 't1', text: 'Ship the auth token-refresh fix', ref: 'MER-482', done: true },
        { id: 't2', text: 'Add cursor pagination to activity feed', ref: 'MER-475', done: true },
        { id: 't3', text: 'Pair with Priya on the Redis session-store review', ref: 'MER-495', done: false },
      ],
      hours: [
        { h: 8, label: '8 AM', activity: 'Triaged the inbox and cleared overnight Slack threads, then skimmed CI failures on main.', apps: ['Slack', 'GitHub', 'Jira'], items: [] },
        { h: 9, label: '9 AM', activity: 'Daily standup on Zoom, then groomed the sprint board in Jira with the team.', apps: ['Zoom', 'Jira', 'Slack'], items: [
          { id: 'i0', key: 'MER-501', type: 'Task', title: 'Sprint planning & board grooming', summary: 'Groomed 11 backlog items and estimated 4 stories.', minutes: 45, status: 'posted' },
        ] },
        { h: 10, label: '10 AM', activity: 'Deep focus in VS Code on the auth middleware; ran the local test suite in iTerm.', apps: ['VS Code', 'iTerm', 'Chrome'], items: [
          { id: 'i1', key: 'MER-482', type: 'Bug', title: 'Fix token-refresh race condition in auth', summary: 'Added a mutex around refresh; wrote a failing test first.', minutes: 52, status: 'pending' },
        ] },
        { h: 11, label: '11 AM', activity: 'Wrapped the auth fix, opened a PR, and reviewed a teammate’s session-store refactor.', apps: ['VS Code', 'GitHub'], items: [
          { id: 'i2', key: 'MER-482', type: 'Bug', title: 'Auth fix — open PR', summary: 'Opened PR #2231 with test coverage.', minutes: 34, status: 'pending' },
          { id: 'i3', key: 'MER-495', type: 'Story', title: 'Review: Redis session store', summary: 'Left 6 comments on eviction & TTL.', minutes: 22, status: 'pending' },
        ] },
        { h: 12, label: '12 PM', activity: '', apps: [], items: [], empty: true, emptyLabel: 'Lunch · away' },
        { h: 13, label: '1 PM', activity: 'Implemented cursor pagination for the activity-feed API and tested it in Postman.', apps: ['VS Code', 'Postman'], items: [
          { id: 'i4', key: 'MER-475', type: 'Story', title: 'Add cursor pagination to activity-feed API', summary: 'hasMore + nextCursor; verified across 3 page sizes.', minutes: 48, status: 'posted' },
        ] },
        { h: 14, label: '2 PM', activity: '', apps: [], items: [], now: true, generating: true },
      ],
    };
  }

  var state = initialState();
  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtRange(h) {
    var fmt = function (x) { var ap = x >= 12 ? 'PM' : 'AM'; var hr = x % 12; if (hr === 0) hr = 12; return hr + ':00 ' + ap; };
    return fmt(h) + ' – ' + fmt(h + 1);
  }
  function allItems() { return state.hours.flatMap(function (h) { return h.items; }); }
  function pendingItems() { return allItems().filter(function (i) { return i.status === 'pending'; }); }
  function appDotColor(a) { return APP_COLORS[a] || '#9C98AC'; }

  // ── actions ────────────────────────────────────────────────────────────
  function resetAll() { state = initialState(); render(); }
  function toggleCapture() { state.capture = !state.capture; render(); }
  function toggleJira() { state.jiraConnected = !state.jiraConnected; render(); }
  function toggleTask(id) {
    state.tasks = state.tasks.map(function (t) { return t.id === id ? Object.assign({}, t, { done: !t.done }) : t; });
    render();
  }
  function selectItem(id) { state.selectedItemId = id; render(); }
  function clearHour() { state.selectedItemId = null; render(); }

  function openReviewAll() {
    state.reviewOpen = true;
    state.reviewQueue = pendingItems().map(function (i) { return i.id; });
    state.reviewPos = 0;
    render();
  }
  function openReviewOne(id) {
    state.reviewOpen = true; state.reviewQueue = [id]; state.reviewPos = 0; render();
  }
  function closeReview() { state.reviewOpen = false; render(); }

  function commit(dir) {
    var id = state.reviewQueue[state.reviewPos];
    if (!id) return;
    var patch = {};
    if (dir === 'approve') {
      var titleEl = $('edit-title'), summaryEl = $('edit-summary'), ticketEl = $('edit-ticket');
      if (titleEl) patch.title = titleEl.value;
      if (summaryEl) patch.summary = summaryEl.value;
      if (ticketEl) patch.key = ticketEl.value;
    }
    state.hours = state.hours.map(function (h) {
      return Object.assign({}, h, {
        items: h.items.map(function (it) {
          return it.id === id ? Object.assign({}, it, patch, { status: dir === 'approve' ? 'approved' : 'rejected' }) : it;
        }),
      });
    });
    state.reviewPos += 1;
    render();
  }
  function approveNow() { commit('approve'); }
  function rejectNow() { commit('reject'); }

  // ── drag-to-swipe ─────────────────────────────────────────────────────
  var drag = { startX: 0, x: 0, active: false };
  function attachDrag(card) {
    if (!card) return;
    card.addEventListener('pointerdown', function (e) {
      drag.active = true; drag.startX = e.clientX; drag.x = 0;
      card.classList.add('dragging');
      try { card.setPointerCapture(e.pointerId); } catch (err) { /* unsupported, ignore */ }
    });
    card.addEventListener('pointermove', function (e) {
      if (!drag.active) return;
      drag.x = e.clientX - drag.startX;
      updateDragVisual(card);
    });
    var end = function () {
      if (!drag.active) return;
      drag.active = false;
      card.classList.remove('dragging');
      if (drag.x > 110) approveNow();
      else if (drag.x < -110) rejectNow();
      else { drag.x = 0; updateDragVisual(card); }
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
  }
  function updateDragVisual(card) {
    var rot = Math.max(-8, Math.min(8, drag.x / 16));
    var approveOpacity = Math.max(0, Math.min(1, drag.x / 110));
    var rejectOpacity = Math.max(0, Math.min(1, -drag.x / 110));
    card.style.transform = 'translateX(' + drag.x + 'px) rotate(' + rot + 'deg)';
    var ap = card.querySelector('.stamp.approve');
    var rj = card.querySelector('.stamp.reject');
    if (ap) ap.style.opacity = approveOpacity;
    if (rj) rj.style.opacity = rejectOpacity;
  }

  // ── render: timeline item card ───────────────────────────────────────
  function buildItemHtml(it, hourIdx) {
    var isProp = it.kind === 'proposal';
    var accent = (it.status === 'posted' || it.status === 'approved') ? '#10B981'
      : it.status === 'rejected' ? '#C7C2D6' : (isProp ? '#8B5CF6' : '#F59E0B');
    var selected = state.selectedItemId === it.id;
    var border = selected ? '#B9A6EE' : '#ECE6F6';
    var ring = selected ? '0 0 0 3px rgba(139,92,246,.18), ' : '';
    var cardStyle = '--accent:' + accent + ';border:1px solid ' + border + ';box-shadow:' + ring +
      'inset 4px 0 0 ' + accent + ',0 1px 2px rgba(40,30,90,.04),0 10px 22px -16px rgba(40,30,90,.3);' +
      'opacity:' + (it.status === 'rejected' ? 0.5 : 1) + ';cursor:' + (hourIdx != null ? 'pointer' : 'default');
    var statusLabel = isProp ? 'New ticket' : 'Needs review';
    var statusBg = isProp ? '#F4ECFE' : '#FEF5E7';
    var statusColor = isProp ? '#7C3AED' : '#B4690E';
    var posted = it.status === 'posted' || it.status === 'approved';
    var pending = it.status === 'pending';
    return (
      '<div class="item-card" style="' + cardStyle + '" data-action="select-item" data-item-id="' + it.id + '" data-hour-idx="' + (hourIdx == null ? '' : hourIdx) + '">' +
        '<div class="item-top">' +
          '<div class="item-title">' + esc(it.title) + '</div>' +
          (posted ? '<span class="posted-pill"><svg width="11" height="11" viewBox="0 0 24 24" fill="#2684FF"><path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z"/></svg>Posted to Jira</span>' : '') +
          (pending ? '<span class="status-pill" style="background:' + statusBg + ';color:' + statusColor + '">' + statusLabel + '</span>' : '') +
        '</div>' +
        '<div class="item-meta">' +
          '<span class="item-summary">' + esc(it.summary) + '</span>' +
          '<span class="item-mins">' + it.minutes + ' min</span>' +
        '</div>' +
      '</div>'
    );
  }

  // ── render: toolbar ───────────────────────────────────────────────────
  function renderToolbar() {
    var capOn = state.capture, jiraOn = state.jiraConnected;
    $('toolbar-actions').innerHTML =
      '<button class="capbtn" data-action="toggle-capture" style="border-color:' + (capOn ? '#CFEEDD' : '#E4DEF6') + ';background:' + (capOn ? '#EDFAF2' : '#fff') + ';color:' + (capOn ? '#0F9D6E' : '#6E6A88') + '">' +
        '<span class="capdot" style="background:' + (capOn ? '#10B981' : '#B4AECB') + '"></span>' + (capOn ? 'Capturing' : 'Paused') +
      '</button>' +
      '<button class="jirabtn" data-action="toggle-jira">' +
        '<span class="jiraicon"><svg width="14" height="14" viewBox="0 0 24 24" fill="#2684FF"><path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z"/></svg></span>' +
        '<div>' +
          '<div class="jiralabel">Jira</div>' +
          '<div class="jirastatus" style="color:' + (jiraOn ? '#0F9D6E' : '#948FB8') + '"><span class="jiradot" style="background:' + (jiraOn ? '#10B981' : '#C4B5FD') + '"></span>' + (jiraOn ? 'Connected' : 'Not connected') + '</div>' +
        '</div>' +
      '</button>' +
      '<button class="resetbtn" data-action="reset" title="Reset the demo back to its starting state">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11A8 8 0 1 0 18.5 16"></path><path d="M20 4v6h-6"></path></svg>' +
        'Reset demo' +
      '</button>' +
      '<div class="avatar">AR</div>';
  }

  // ── render: timeline ──────────────────────────────────────────────────
  function renderTimeline() {
    var rows = state.hours.map(function (h, idx) {
      var its = h.items || [];
      var filled = its.length > 0 || h.generating || h.now;
      var live = !!h.generating || !!h.now;
      var NODE = '#C3B9DE';
      var sel = its.some(function (it) { return it.id === state.selectedItemId; });
      var nodeStyle;
      if (live) nodeStyle = 'width:11px;height:11px;background:#8B5CF6;box-shadow:0 0 0 3px rgba(139,92,246,.18);animation:wsBlink 1.4s ease-in-out infinite';
      else if (filled) nodeStyle = 'width:10px;height:10px;background:' + NODE + ';box-shadow:0 0 0 3px rgba(252,251,255,.9)';
      else nodeStyle = 'width:9px;height:9px;background:#FCFBFF;border:2px solid ' + NODE + ';box-shadow:0 0 0 3px rgba(252,251,255,.9)';

      var body = '';
      if (its.length > 0) {
        body += '<div class="item-row">' + its.map(function (it) { return buildItemHtml(it, idx); }).join('') + '</div>';
      }
      if (h.activity && !h.generating && !h.empty && its.length === 0) {
        var dots = (h.apps || []).slice(0, 4).map(function (a) { return '<span class="appdot" style="background:' + appDotColor(a) + '"></span>'; }).join('');
        body += '<div class="activity-row"><div class="appdots">' + dots + '</div><span class="activity-text">' + esc(h.activity) + '</span></div>';
      }
      if (h.generating) {
        body +=
          '<div class="generating">' +
            '<span class="gen-icon-wrap"><span class="gen-ring"></span><span class="gen-icon">✦</span></span>' +
            '<div style="flex:1;min-width:0">' +
              '<div style="display:flex;align-items:center;gap:7px">' +
                '<span style="font:700 12px \'Plus Jakarta Sans\';color:#7C3AED;letter-spacing:-.01em">Cooking up this hour\'s recap</span>' +
                '<span class="gen-dots"><span class="gen-dot"></span><span class="gen-dot" style="animation-delay:.2s"></span><span class="gen-dot" style="animation-delay:.4s"></span></span>' +
              '</div>' +
              '<div style="font:500 11px \'Plus Jakarta Sans\';color:#9081AE;margin-top:2px">Analyzing your captures — we\'ll notify you the moment it\'s ready.</div>' +
            '</div>' +
            '<span class="gen-badge">◷ In progress</span>' +
          '</div>';
      }
      if (h.empty) body += '<div class="empty-label">' + esc(h.emptyLabel || '') + '</div>';

      return (
        '<div class="hour-row" style="background:' + (sel ? '#F1ECFE' : 'transparent') + ';box-shadow:' + (sel ? 'inset 0 0 0 1px #DED0F8' : 'none') + '">' +
          '<div class="hour-label">' + h.label + '</div>' +
          '<div class="hour-spine"><span class="line"></span><span class="hour-node" style="' + nodeStyle + '"></span></div>' +
          '<div class="hour-body">' + body + '</div>' +
        '</div>'
      );
    }).join('');

    $('timeline').innerHTML = '<div class="tl-head"><span>DAILY TIMELINE</span><span class="line"></span></div>' + rows;
  }

  // ── render: right panel (overview / hour detail) ─────────────────────
  function renderPanel() {
    var items = allItems();
    var pendingCount = items.filter(function (i) { return i.status === 'pending'; }).length;
    var selId = state.selectedItemId;
    var detailHour = null, selectedIt = null;
    if (selId != null) {
      detailHour = state.hours.find(function (h) { return (h.items || []).some(function (it) { return it.id === selId; }); });
      if (detailHour) selectedIt = detailHour.items.find(function (it) { return it.id === selId; });
    }

    if (detailHour) {
      renderDetailPanel(detailHour, selectedIt);
      return;
    }

    var tasks = state.tasks.map(function (t) {
      return (
        '<div class="task-row" data-action="toggle-task" data-task-id="' + t.id + '">' +
          '<span class="task-check" style="background:' + (t.done ? 'linear-gradient(135deg,#6D28D9,#9333EA)' : '#fff') + ';border:' + (t.done ? 'none' : '2px solid #D8D4E4') + '">' + (t.done ? '✓' : '') + '</span>' +
          '<span class="task-text" style="color:' + (t.done ? '#B4B0C2' : '#3B3752') + ';text-decoration:' + (t.done ? 'line-through' : 'none') + '">' + esc(t.text) + '</span>' +
          '<span class="task-ref">' + t.ref + '</span>' +
        '</div>'
      );
    }).join('');

    var goalsTotal = state.tasks.length;
    var goalsDone = state.tasks.filter(function (t) { return t.done; }).length;
    var goalsPct = goalsTotal ? Math.round((goalsDone / goalsTotal) * 100) : 0;
    var goalsComplete = goalsDone === goalsTotal && goalsTotal > 0;
    var goalsBadge = goalsComplete ? '🎉 All done' : (goalsPct >= 50 ? 'On track' : 'Getting started');
    var goalsFill = goalsComplete ? 'linear-gradient(90deg,#059669,#10B981)' : 'linear-gradient(90deg,#7C3AED,#A855F7 60%,#EC4899)';

    var apps = [['Claude Code', 144], ['VS Code', 72], ['Jira', 38], ['Slack', 31]];
    var mx = 144;
    var appBars = apps.map(function (pair) {
      var name = pair[0], mins = pair[1];
      var label = mins >= 60 ? Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm' : mins + 'm';
      return (
        '<div class="app-row">' +
          '<span class="app-name">' + name + '</span>' +
          '<span class="app-track"><span class="app-fill" style="width:' + (mins / mx * 100) + '%;background:' + appDotColor(name) + '"></span></span>' +
          '<span class="app-mins">' + label + '</span>' +
        '</div>'
      );
    }).join('');

    var draftsBlock = pendingCount > 0
      ? '<button class="drafts-cta" data-action="open-review-all">' +
          '<div class="blob"></div>' +
          '<div class="row">' +
            '<div class="count">' + pendingCount + '</div>' +
            '<div style="flex:1"><div class="title">drafts to review</div><div class="sub">Click to approve, dismiss or skip</div></div>' +
            '<span class="go">Review →</span>' +
          '</div>' +
        '</button>'
      : '<div class="alldone"><span style="font-size:18px">✨</span><div class="txt">All caught up — nothing waiting on you</div></div>';

    $('panel').innerHTML =
      '<div class="panel-label">TODAY AT A GLANCE</div>' +
      '<div class="panel-greet">' + (pendingCount > 0 ? 'You are having a solid day' : 'All wrapped up') + '</div>' +
      '<div class="panel-label" style="margin-top:16px">INSIGHTS</div>' +
      '<div class="insights">' +
        '<div class="insight" style="background:linear-gradient(160deg,#F7F4FF,#F0ECFF);border:1px solid #EBE4FB"><div class="num" style="color:#6D28D9">3h 36m</div><div class="lbl" style="color:#8B7FAE">Focus time</div></div>' +
        '<div class="insight" style="background:linear-gradient(160deg,#FDF2F8,#FCE9F3);border:1px solid #FADCEC"><div class="num" style="color:#DB2777">3h 21m</div><div class="lbl" style="color:#B67A9A">Logged hours</div></div>' +
        '<div class="insight" style="background:linear-gradient(160deg,#EDFDFE,#E2F9FB);border:1px solid #CDF0F4"><div class="num" style="color:#0891B2">' + pendingCount + '</div><div class="lbl" style="color:#6E9CA6">Drafts</div></div>' +
      '</div>' +
      draftsBlock +
      '<div class="goals-head"><span class="lbl">TODAY\'S GOALS</span><span style="flex:1"></span><span class="edit">Edit plan</span></div>' +
      '<div class="goals-box">' +
        '<div class="goals-top">' +
          '<span class="goals-pct">' + goalsPct + '%</span>' +
          '<span class="goals-track"><span class="goals-fill" style="width:' + goalsPct + '%;background:' + goalsFill + '"></span></span>' +
          '<span class="goals-badge">' + goalsBadge + '</span>' +
        '</div>' +
        '<div class="task-list">' + tasks + '</div>' +
      '</div>' +
      '<div class="apps-box">' +
        '<div class="apps-head"><span class="t">Time by app</span><span class="m"></span><span class="r">most in Claude Code</span></div>' +
        '<div class="apps-rows">' + appBars + '</div>' +
      '</div>';
  }

  function renderDetailPanel(detailHour, selectedIt) {
    var appChips = (detailHour.apps || []).map(function (a) {
      return '<span class="app-chip" style="border-left:3px solid ' + appDotColor(a) + '">' + esc(a) + '</span>';
    }).join('');
    var recap = selectedIt ? buildItemHtml(selectedIt, null).replace('item-card', 'item-card recap-card') : '';

    $('panel').innerHTML =
      '<button class="backbtn" data-action="clear-hour">← Overview</button>' +
      '<div class="detail-title">' + detailHour.label + '</div>' +
      '<div class="detail-range">' + fmtRange(detailHour.h) + '</div>' +
      '<div class="detail-summary">' +
        '<div class="h"><span class="dot"></span>ACTIVITY SUMMARY</div>' +
        '<div class="b">' + esc(detailHour.activity || (detailHour.empty ? (detailHour.emptyLabel || 'Away — minimal activity detected.') : 'No activity captured this hour.')) + '</div>' +
      '</div>' +
      '<div class="panel-label" style="margin-top:16px">APPS USED</div>' +
      '<div class="chip-row">' + (appChips || '<div style="font:500 12px \'Plus Jakarta Sans\';color:#C4C0D0;font-style:italic">Minimal activity captured this hour.</div>') + '</div>' +
      (selectedIt ? '<div class="panel-label" style="margin-top:16px">RECAPS</div><div style="display:flex;flex-direction:column;gap:9px;margin-top:10px">' + recap + '</div>' : '');
  }

  // ── render: floating "review drafts" button ──────────────────────────
  function renderFloating() {
    var pendingCount = pendingItems().length;
    var show = pendingCount > 0 && !state.reviewOpen;
    $('floating-slot').innerHTML = !show ? '' : (
      '<button id="floating" data-action="open-review-all">' +
        '<span class="stack">' +
          '<span style="background:linear-gradient(135deg,#9333EA,#EC4899);display:flex;align-items:center;justify-content:center;font:800 11.5px \'Plus Jakarta Sans\';color:#fff">' + pendingCount + '</span>' +
          '<span style="background:linear-gradient(135deg,#6366F1,#22D3EE)"></span>' +
          '<span style="background:linear-gradient(135deg,#F59E0B,#EC4899)"></span>' +
        '</span>' +
        '<div style="text-align:left"><div class="title">Review drafts</div><div class="sub">' + pendingCount + ' waiting · click to review</div></div>' +
        '<span style="font-size:14px;margin-left:2px">↑</span>' +
      '</button>'
    );
  }

  // ── render: review modal ──────────────────────────────────────────────
  function renderReview() {
    var slot = $('review-slot');
    if (!state.reviewOpen) { slot.innerHTML = ''; return; }

    var items = allItems();
    var len = state.reviewQueue.length;
    var reviewDone = state.reviewPos >= len;
    var progressLabel = Math.min(state.reviewPos + 1, len) + ' of ' + len;
    var dots = state.reviewQueue.map(function (_, i) {
      var w = i === state.reviewPos ? '18px' : '7px';
      var bg = i <= state.reviewPos ? '#fff' : 'rgba(255,255,255,.3)';
      return '<span class="progress-dot" style="width:' + w + ';background:' + bg + '"></span>';
    }).join('');

    var stageHtml = '', hasCard = false;

    if (reviewDone) {
      stageHtml =
        '<div class="review-done">' +
          '<div class="check">✓</div>' +
          '<h3>All caught up</h3>' +
          '<p>Approved logs are on their way to Jira.</p>' +
          '<button data-action="close-review">Back to timeline</button>' +
        '</div>';
    } else {
      var id = state.reviewQueue[state.reviewPos];
      var it = items.find(function (i) { return i.id === id; });
      if (it) {
        hasCard = true;
        var hourOf = state.hours.find(function (h) { return h.items.some(function (x) { return x.id === id; }); });
        var appChips = (hourOf ? hourOf.apps : []).slice(0, 3).map(function (a) {
          return '<span class="ev-chip" style="border-left:3px solid ' + appDotColor(a) + '">' + esc(a) + '</span>';
        }).join('');
        var ticketOptions = TICKET_POOL.map(function (t) {
          return '<option value="' + t.key + '" ' + (t.key === it.key ? 'selected' : '') + '>' + t.key + ' — ' + esc(t.title) + '</option>';
        }).join('');
        stageHtml =
          '<div id="card">' +
            '<span class="stamp approve" style="opacity:0">APPROVE</span>' +
            '<span class="stamp reject" style="opacity:0">DISMISS</span>' +
            '<div class="card-top">' +
              '<span class="card-key">' + it.key + '</span>' +
              '<span class="card-kind">' + it.type + '</span>' +
              '<span style="flex:1"></span>' +
              '<span class="card-badge">Needs review</span>' +
            '</div>' +
            '<input id="edit-title" value="' + esc(it.title) + '">' +
            '<textarea id="edit-summary" rows="3">' + esc(it.summary) + '</textarea>' +
            '<div class="match-label">MATCH TO TICKET</div>' +
            '<select id="edit-ticket">' + ticketOptions + '</select>' +
            '<div class="evidence">' +
              '<div class="h">EVIDENCE FROM CAPTURE</div>' +
              '<div class="evidence-row">' +
                '<span class="time">' + (hourOf ? hourOf.label : '') + '</span>' +
                '<span class="sep"></span>' +
                '<div class="evidence-chips">' + appChips + '</div>' +
              '</div>' +
            '</div>' +
          '</div>';
      }
    }

    slot.innerHTML =
      '<div id="review-overlay">' +
        '<div class="review-head">' +
          '<div><div class="t">Review drafts</div><div class="s">' + progressLabel + '</div></div>' +
          '<button class="review-close" data-action="close-review">✕</button>' +
        '</div>' +
        (hasCard ? '<div class="swipe-hint"><span class="l"><span style="font-size:16px;line-height:1">←</span>swipe to dismiss</span><span class="sep"></span><span class="r">swipe to approve<span style="font-size:16px;line-height:1">→</span></span></div>' : '') +
        '<div class="review-stage">' + stageHtml + '</div>' +
        (hasCard ? '<div class="card-actions"><button class="dismiss" data-action="reject-now">Dismiss</button><span style="flex:1"></span><button class="approve" data-action="approve-now">Save &amp; approve</button></div><div class="progress-dots">' + dots + '</div>' : '') +
      '</div>';

    if (hasCard) attachDrag($('card'));
  }

  function render() {
    renderToolbar();
    renderTimeline();
    renderPanel();
    renderFloating();
    renderReview();
  }

  // ── event delegation ──────────────────────────────────────────────────
  var ACTIONS = {
    'toggle-capture': toggleCapture,
    'toggle-jira': toggleJira,
    'reset': resetAll,
    'clear-hour': clearHour,
    'open-review-all': openReviewAll,
    'close-review': closeReview,
    'approve-now': approveNow,
    'reject-now': rejectNow,
  };
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) {
      if (e.target.closest('#timeline') && !e.target.closest('.item-card')) clearHour();
      return;
    }
    var action = el.dataset.action;
    e.stopPropagation();
    if (action === 'toggle-task') { toggleTask(el.dataset.taskId); return; }
    if (action === 'select-item') {
      var id = el.dataset.itemId;
      var item = allItems().find(function (i) { return i.id === id; });
      if (item && item.status === 'pending') openReviewOne(id);
      else selectItem(id);
      return;
    }
    var handler = ACTIONS[action];
    if (handler) handler();
  });

  render();
})();
