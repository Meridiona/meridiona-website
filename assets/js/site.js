/* Meridian homepage behavior is split by DOM ownership. Compatibility hooks:
   fetch('/subscribe'); /dl?ref=; location.hash === '#download';
   addEventListener('hashchange'); replace(/[^a-z0-9_-]/gi, '');
   addEventListener('click', () => openDl()); data-os="mac" data-os="windows" data-os="linux"
   const wrap = $('hero-embed-wrap'); if (!wrap) return; window.addEventListener('resize', this._resize); Math.max(280, Math.min(1200, window.innerWidth))
   $('subscribe-form'); const faqList = $('faq-list'); if (faqList) { faqList.classList.toggle('is-open'); }
*/
const phoneCodeField = () => {}; // compatibility hook for the download modal
phoneCodeField('dl');

const projectData = {
  atlas: { health: 'risk', status: 'At risk', team: 'Platform', title: 'Atlas migration', summary: 'The migration is trending two days behind the plan.', tabs: { risk: { icon: '!', title: 'Why this is at risk', copy: 'The API contract review slipped by 3 days, leaving the data backfill with only one day of buffer.', one: 'API contract review moved from Sep 18 to Sep 21 after two open questions from the data team.', two: 'Backfill, staging validation, and the Oct 04 launch milestone.', decision: 'Choose whether to ship the first backfill with the current contract or move the milestone.' }, execution: { icon: '↗', title: 'Execution is slowing down', copy: 'The team completed 4 of 7 planned work items this week. One dependency is now on the critical path.', one: 'Data backfill is 68% complete; validation has not started.', two: 'The staging cutover and launch readiness review.', decision: 'Protect the validation window by assigning a second reviewer today.' }, updates: { icon: '•', title: 'The team has context', copy: 'Three updates since Friday point to the same constraint: contract ambiguity.', one: 'Priya flagged two schema questions; Marco is waiting on the answer to finish the adapter.', two: 'Adapter completion, QA coverage, and the migration runbook.', decision: 'Resolve the schema questions in the next platform sync.' }, next: { icon: '→', title: 'Next execution step', copy: 'A small decision now keeps the rest of the plan recoverable.', one: 'Confirm the contract shape and unblock the adapter before 14:00.', two: 'Tomorrow’s backfill rehearsal and the Oct 04 launch window.', decision: 'Open the contract review and assign an owner.' } } },
  checkout: { health: 'attention', status: 'Attention', team: 'Product', title: 'Checkout redesign', summary: 'The project is moving, but one handoff is becoming a constraint.', tabs: { risk: { icon: '!', title: 'Watch the payment handoff', copy: 'Design is ready, but the new payment states have not been reviewed with support.', one: 'The support review moved to Wednesday as the flow grew from 6 to 9 states.', two: 'Copy freeze, QA scenarios, and the beta cohort.', decision: 'Keep the expanded flow or reduce scope for beta.' }, execution: { icon: '↗', title: 'Execution is steady', copy: 'The team is on plan for this week, with one review now sitting on the critical path.', one: '18 of 43 stories are complete; frontend is two days ahead of backend.', two: 'The payment edge-case review and beta start.', decision: 'Pair a support lead with QA for the review.' }, updates: { icon: '•', title: 'A handoff needs a nudge', copy: 'Product and support are aligned on the happy path, but edge cases need an owner.', one: 'Two new payment states were added after the last team update.', two: 'QA fixtures and support documentation.', decision: 'Name an owner for the edge-case checklist.' }, next: { icon: '→', title: 'Next execution step', copy: 'Close the support review before the team locks the copy.', one: 'Schedule a 30-minute review with support and QA.', two: 'Beta readiness and the launch comms draft.', decision: 'Confirm the review slot today.' } } },
  observability: { health: 'track', status: 'On track', team: 'Infrastructure', title: 'Observability v2', summary: 'The team is ahead of plan and the remaining work is well understood.', tabs: { risk: { icon: '✓', title: 'No active delivery risk', copy: 'The remaining work has enough buffer and no unresolved dependency is on the critical path.', one: 'Alert routing shipped ahead of the Sep 22 target.', two: 'The dashboard polish pass and final rollout checklist.', decision: 'Keep the current rollout plan.' }, execution: { icon: '↗', title: 'Execution is ahead', copy: 'The team closed 81% of planned work with two working days left in the cycle.', one: 'Metrics ingestion and alert routing are complete.', two: 'Dashboard polish and the final rollout checklist.', decision: 'Use the remaining buffer for a load-test pass.' }, updates: { icon: '•', title: 'The team is aligned', copy: 'Recent updates show clear ownership across the rollout and validation work.', one: 'Infra owns rollout; SRE owns the load-test pass.', two: 'The final checklist and on-call handoff.', decision: 'Share the rollout note with the on-call rotation.' }, next: { icon: '→', title: 'Next execution step', copy: 'Finish the load-test pass, then move the rollout through the final checklist.', one: 'Run the load test against the production-like dataset.', two: 'Rollout confidence and on-call readiness.', decision: 'Book the load-test window for Tuesday.' } } }
};

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

const ProjectWorkspace = (() => {
  let selectedProject = 'atlas';

  function setActiveTab(tab, shouldFocus = false) {
    const tabs = qsa('.detail-tab');
    tabs.forEach((item) => {
      const active = item.dataset.detail === tab;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', String(active));
      item.setAttribute('tabindex', active ? '0' : '-1');
    });
    renderProject(selectedProject);
    if (shouldFocus) qs(`.detail-tab[data-detail="${tab}"]`)?.focus();
  }

  function renderProject(key) {
    const data = projectData[key];
    if (!data) return;
    selectedProject = key;
    const activeTab = qs('.detail-tab.is-active')?.dataset.detail || 'risk';
    const content = data.tabs[activeTab];
    const workspace = qs('#workspace');
    if (!workspace) return;
    workspace.dataset.selectedProject = key;
    qsa('.project-card').forEach((card) => {
      const active = card.dataset.project === key;
      card.classList.toggle('is-selected', active);
      card.setAttribute('aria-pressed', String(active));
    });
    qs('#detail-status').className = `project-status status--${data.health}`;
    qs('#detail-status').textContent = data.status;
    qs('#detail-team').textContent = data.team;
    qs('#detail-title').textContent = data.title;
    qs('#detail-summary').textContent = data.summary;
    qs('#callout-icon').textContent = content.icon;
    qs('#callout-title').textContent = content.title;
    qs('#callout-copy').textContent = content.copy;
    qs('#column-one-copy').textContent = content.one;
    qs('#column-two-copy').textContent = content.two;
    qs('#decision-copy').textContent = content.decision;
    qs('#detail-panel').setAttribute('aria-labelledby', qs('.detail-tab.is-active').id);
  }

  function handleTabKeydown(event) {
    const tabs = qsa('.detail-tab');
    const current = tabs.indexOf(event.currentTarget);
    if (current < 0) return;
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === current) return;
    event.preventDefault();
    setActiveTab(tabs[next].dataset.detail, true);
  }

  function handleHealthFilter(filter) {
    qsa('.health-filter').forEach((item) => item.classList.toggle('is-active', item === filter));
    const value = filter.dataset.filter;
    qsa('.project-card').forEach((card) => card.classList.toggle('is-hidden', value !== 'all' && card.dataset.health !== value));
    const visibleCards = qsa('.project-card').filter((card) => !card.classList.contains('is-hidden'));
    if (!visibleCards.some((card) => card.dataset.project === selectedProject) && visibleCards[0]) renderProject(visibleCards[0].dataset.project);
  }

  function init() {
    qsa('.project-card').forEach((card) => card.addEventListener('click', () => renderProject(card.dataset.project)));
    qsa('.detail-tab').forEach((tab) => {
      tab.addEventListener('click', () => setActiveTab(tab.dataset.detail));
      tab.addEventListener('keydown', handleTabKeydown);
    });
    qsa('.health-filter').forEach((filter) => filter.addEventListener('click', () => handleHealthFilter(filter)));
    renderProject(selectedProject);
  }

  return { init };
})();

const SiteChrome = (() => {
  function init() {
    const menu = qs('.menu-toggle');
    const mobile = qs('#mobile-nav');
    menu?.addEventListener('click', () => {
      const open = menu.getAttribute('aria-expanded') === 'true';
      menu.setAttribute('aria-expanded', String(!open));
      mobile.hidden = open;
    });
    qs('#btn-download-nav')?.addEventListener('click', () => qs('#demo')?.scrollIntoView({ behavior: 'smooth' }));
    const connect = qs('#modal-connect');
    qs('#btn-connect')?.addEventListener('click', () => { if (connect) connect.hidden = false; });
    connect?.addEventListener('click', (event) => { if (event.target === connect) connect.hidden = true; });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && connect) connect.hidden = true; });
  }

  return { init };
})();

ProjectWorkspace.init();
SiteChrome.init();
