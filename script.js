'use strict';

/* ------------------------------------------------------------------
   Configuration
------------------------------------------------------------------ */
const DRAFT_KEY = 'sportsblog-draft-v2';
const LEGACY_DATA_KEY = 'sportsblog-data-v1';
const LEGACY_KEYS = ['sportsblog-editor-draft-v1', 'sportsblog-local-draft-enabled'];
const FORM_DRAFT_PREFIX = 'sportsblog-form-draft-';
const AUTH_KEY = 'sportsblog-admin-auth';
const ADMIN_PASSWORD = '4AMsports2026';
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1280;
const SECTION_TYPES = ['news', 'transfers', 'fixtures', 'results'];
const STORAGE_FULL_MESSAGE =
  'This browser could not store your changes (storage is full). Download a backup from the Publish tab now so nothing is lost.';

/* Every admin section is described here and gets its own independent panel. */
const SECTIONS = {
  news: {
    label: 'News',
    noun: 'news story',
    plural: 'news stories',
    icon: '📰',
    intro: 'Match reports, team news and headlines.',
    photoLabel: 'Story photo',
    defaults: { category: 'News', date: 'Today' },
    fields: [
      { key: 'title', label: 'Headline', type: 'text', required: true, wide: true, placeholder: 'e.g. Pirates win the first leg' },
      { key: 'summary', label: 'Story', type: 'textarea', wide: true, placeholder: 'A short summary readers will see on the card' },
      { key: 'category', label: 'Category', type: 'text', wide: true, placeholder: 'Match Report', options: ['Match Report', 'Team News', 'Injury News', 'Interview', 'Opinion'] },
      { key: 'date', label: 'When', type: 'when', wide: true, quick: ['Today', 'Yesterday', '2 days ago'] },
      { key: 'featured', label: 'Feature this story at the top of the homepage', type: 'checkbox', wide: true },
    ],
    rowTitle: (i) => i.title || 'Untitled story',
    rowMeta: (i) => [i.category, i.date],
  },
  transfers: {
    label: 'Transfers',
    noun: 'transfer update',
    plural: 'transfer updates',
    icon: '🔁',
    intro: 'Signings, rumours and contract news.',
    photoLabel: 'Transfer photo',
    defaults: { club: 'Transfer', date: 'Today' },
    fields: [
      { key: 'title', label: 'Headline', type: 'text', required: true, wide: true, placeholder: 'e.g. Midfielder linked with a move' },
      { key: 'summary', label: 'Details', type: 'textarea', wide: true, placeholder: 'What is happening with this transfer?' },
      { key: 'club', label: 'Club or tag', type: 'text', wide: true, placeholder: 'Transfer Rumour', options: ['Transfer Rumour', 'Confirmed', 'Contract News', 'Loan'] },
      { key: 'date', label: 'When', type: 'when', wide: true, quick: ['Today', 'Yesterday', '2 days ago'] },
    ],
    rowTitle: (i) => i.title || 'Untitled transfer',
    rowMeta: (i) => [i.club, i.date],
  },
  fixtures: {
    label: 'Fixtures',
    noun: 'fixture',
    plural: 'fixtures',
    icon: '📅',
    intro: 'Upcoming matches and kick-off times.',
    photoLabel: 'Match photo',
    defaults: { competition: 'League', date: 'Upcoming', status: 'Fixture' },
    fields: [
      { key: 'home', label: 'Home team', type: 'text', required: true, placeholder: 'Home team' },
      { key: 'away', label: 'Away team', type: 'text', required: true, placeholder: 'Away team' },
      { key: 'competition', label: 'Competition', type: 'text', placeholder: 'Premier League', options: ['Premier League', 'Champions League', 'Betway Premiership', 'MTN8', 'Cup'] },
      { key: 'status', label: 'Status', type: 'text', placeholder: 'Kick-off', options: ['Kick-off', 'Preview', 'Live', 'Postponed'] },
      { key: 'date', label: 'Kick-off', type: 'when', wide: true, time: true, quick: ['Today', 'Tonight', 'Tomorrow', 'This weekend'] },
    ],
    rowTitle: (i) => [i.home, i.away].filter(Boolean).join(' vs ') || i.title || 'Untitled fixture',
    rowMeta: (i) => [i.competition, i.date, i.status],
  },
  results: {
    label: 'Results',
    noun: 'result',
    plural: 'results',
    icon: '🏁',
    intro: 'Final scores and match photos.',
    photoLabel: 'Match photo',
    defaults: { competition: 'League', date: 'Recent' },
    fields: [
      { key: 'home', label: 'Home team', type: 'text', required: true, placeholder: 'Home team' },
      { key: 'away', label: 'Away team', type: 'text', required: true, placeholder: 'Away team' },
      { key: 'score', label: 'Final score', type: 'score', required: true },
      { key: 'competition', label: 'Competition', type: 'text', placeholder: 'Premier League', options: ['Premier League', 'Champions League', 'Betway Premiership', 'MTN8', 'Cup'] },
      { key: 'date', label: 'Played', type: 'when', wide: true, quick: ['Last night', 'Yesterday', 'Today', 'Weekend'] },
    ],
    rowTitle: (i) => [i.home, i.score, i.away].filter(Boolean).join(' ') || i.title || 'Untitled result',
    rowMeta: (i) => [i.competition, i.date],
  },
};

/* ------------------------------------------------------------------
   State
------------------------------------------------------------------ */
const state = {
  serverData: null, // what visitors currently see (the published file)
  serverStr: '',
  data: null, // what is shown on this page (published data + admin draft)
  isAdmin: false,
  activeTab: 'news',
  sections: {},
  lastDeleted: null,
  draftTimers: {},
};

SECTION_TYPES.forEach((type) => {
  state.sections[type] = { editing: null, image: '', formOpen: false };
});

/* ------------------------------------------------------------------
   Helpers
------------------------------------------------------------------ */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

function normalizeData(data) {
  const normalized = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  normalized.site = normalized.site && typeof normalized.site === 'object' ? normalized.site : {};
  SECTION_TYPES.forEach((type) => {
    normalized[type] = Array.isArray(normalized[type])
      ? normalized[type].filter((item) => item && typeof item === 'object')
      : [];
  });
  return normalized;
}

function safeImageSrc(src) {
  if (typeof src !== 'string') {
    return '';
  }
  const value = src.trim();
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(value)) {
    return value;
  }
  if (/^(https?:\/\/|\/|\.\/|\.\.\/)?[\w\-./%~]+\.(png|jpe?g|gif|webp|avif)$/i.test(value)) {
    return value;
  }
  return '';
}

function parseScore(score) {
  const match = String(score || '').match(/^\s*(\d*)\s*[-–:]\s*(\d*)\s*$/);
  return match ? { home: match[1], away: match[2] } : { home: '', away: '' };
}

function isDirty() {
  return JSON.stringify(state.data) !== state.serverStr;
}

/* ------------------------------------------------------------------
   Loading data
------------------------------------------------------------------ */
async function loadData() {
  let serverData;
  try {
    const response = await fetch('./data/blog-data.json?ts=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Could not load blog data');
    }
    serverData = normalizeData(await response.json());
  } catch (error) {
    console.error(error);
    serverData = normalizeData({});
    $('#load-error').hidden = false;
  }

  state.serverData = serverData;
  state.serverStr = JSON.stringify(serverData);
  state.isAdmin = sessionStorage.getItem(AUTH_KEY) === 'true';
  state.data = resolveWorkingData();

  if (state.isAdmin) {
    persist();
  }

  renderSite();
  refreshStudio();
  if (state.isAdmin) {
    restoreFormDrafts();
  }
}

function resolveWorkingData() {
  const server = cloneData(state.serverData);
  if (!state.isAdmin) {
    return server;
  }

  let draft = null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && parsed.data) {
      draft = normalizeData(parsed.data);
    }
  } catch (error) {
    draft = null;
  }

  if (!draft) {
    try {
      const legacy = localStorage.getItem(LEGACY_DATA_KEY);
      const parsed = legacy ? JSON.parse(legacy) : null;
      if (parsed && typeof parsed === 'object') {
        draft = normalizeData(parsed);
      }
    } catch (error) {
      draft = null;
    }
  }

  if (!draft) {
    return server;
  }

  if (JSON.stringify(draft) === state.serverStr) {
    localStorage.removeItem(DRAFT_KEY);
    return server;
  }

  return draft;
}

function persist() {
  try {
    if (!isDirty()) {
      localStorage.removeItem(DRAFT_KEY);
    } else {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: state.data, savedAt: Date.now() }));
    }
    localStorage.removeItem(LEGACY_DATA_KEY);
    updateDirtyUi();
    return true;
  } catch (error) {
    console.error(error);
    updateDirtyUi();
    return false;
  }
}

/* ------------------------------------------------------------------
   Public site rendering
------------------------------------------------------------------ */
function renderSite() {
  const { site, news, transfers, fixtures, results } = state.data;
  const siteTitle = site.title || '4AM Sports Live';

  document.title = `${siteTitle} | Sports Blog`;
  $$('[data-site-title]').forEach((element) => {
    element.textContent = siteTitle;
  });

  const tagline = $('#hero-tagline');
  if (tagline) {
    tagline.textContent = site.tagline || 'Exciting sports news and updates from around the world.';
  }

  renderHero(news);
  renderSnapshot(fixtures, results, transfers);

  $('#news-list').innerHTML =
    news.map(storyCard).join('') || emptyHtml('No news yet', 'Fresh stories will appear here soon.');
  $('#transfers-list').innerHTML =
    transfers.map(storyCard).join('') ||
    emptyHtml('No transfer news yet', 'Check back during the transfer window.');
  $('#fixtures-list').innerHTML =
    fixtures.map((item) => matchCard(item, 'fixture')).join('') ||
    emptyHtml('No fixtures yet', 'Upcoming matches will be listed here.');
  $('#results-list').innerHTML =
    results.map((item) => matchCard(item, 'result')).join('') ||
    emptyHtml('No results yet', 'Final scores will appear here after matches.');

  const year = $('#footer-year');
  if (year) {
    year.textContent = new Date().getFullYear();
  }
}

function emptyHtml(title, text) {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div>`;
}

function renderHero(news) {
  const story = news.find((item) => item.featured) || news[0];
  const card = $('#hero-card');

  if (!story) {
    card.innerHTML = `
      <div class="hero-card-body">
        <p class="card-label">Featured story</p>
        <h2>Welcome</h2>
        <p>Stories will appear here as soon as they are published.</p>
      </div>`;
    return;
  }

  const src = safeImageSrc(story.image);
  const badge = story.category || story.club || 'Featured';
  card.innerHTML = `
    ${src ? `<img class="hero-image" src="${escapeHtml(src)}" alt="${escapeHtml(story.title || '')}" />` : ''}
    <div class="hero-card-body">
      <p class="card-label">Featured story</p>
      <h2>${escapeHtml(story.title || 'Latest update')}</h2>
      <p>${escapeHtml(story.summary || '')}</p>
      <div class="hero-meta">
        <span class="badge">${escapeHtml(badge)}</span>
        ${story.date ? `<span class="meta-text">${escapeHtml(story.date)}</span>` : ''}
      </div>
    </div>`;
}

function renderSnapshot(fixtures, results, transfers) {
  const next = fixtures[0];
  const last = results[0];
  const move = transfers[0];

  const nextBody = next
    ? `<strong>${escapeHtml([next.home, next.away].filter(Boolean).join(' vs ') || next.title || 'Fixture')}</strong>
       <span>${escapeHtml([next.date, next.competition].filter(Boolean).join(' · '))}</span>`
    : '<strong>No fixtures yet</strong><span>Check back soon</span>';

  const lastBody = last
    ? `<strong>${escapeHtml([last.home, last.score, last.away].filter(Boolean).join(' ') || last.title || 'Result')}</strong>
       <span>${escapeHtml([last.date, last.competition].filter(Boolean).join(' · '))}</span>`
    : '<strong>No results yet</strong><span>Check back soon</span>';

  const moveBody = move
    ? `<strong>${escapeHtml(move.title || 'Transfer update')}</strong>
       <span>${escapeHtml([move.club, move.date].filter(Boolean).join(' · '))}</span>`
    : '<strong>No transfer news yet</strong><span>Check back soon</span>';

  $('#snapshot').innerHTML = `
    <a class="snapshot-card" href="#fixtures"><span class="snapshot-label">Next match</span>${nextBody}</a>
    <a class="snapshot-card" href="#results"><span class="snapshot-label">Latest result</span>${lastBody}</a>
    <a class="snapshot-card" href="#transfers"><span class="snapshot-label">Latest transfer</span>${moveBody}</a>`;
}

function storyCard(item) {
  const title = item.title || 'Untitled';
  const badge = item.category || item.club || 'Update';
  const src = safeImageSrc(item.image);
  const image = src
    ? `<img class="card-image" src="${escapeHtml(src)}" alt="${escapeHtml(title)}" loading="lazy" />`
    : '<div class="card-image card-image-placeholder" aria-hidden="true">⚽</div>';

  return `
    <article class="card">
      ${image}
      <div class="card-body">
        <span class="badge">${escapeHtml(badge)}</span>
        <h3>${escapeHtml(title)}</h3>
        ${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ''}
        ${item.date ? `<p class="card-date">${escapeHtml(item.date)}</p>` : ''}
      </div>
    </article>`;
}

function matchCard(item, kind) {
  const src = safeImageSrc(item.image);
  const hasTeams = Boolean(item.home || item.away);
  const title = item.title || [item.home, item.away].filter(Boolean).join(' vs ') || 'Match';
  const pill =
    kind === 'fixture'
      ? item.status
        ? `<span class="pill">${escapeHtml(item.status)}</span>`
        : ''
      : '<span class="pill pill-final">Full time</span>';
  const centre =
    kind === 'result'
      ? `<span class="match-score">${escapeHtml(item.score || '–')}</span>`
      : '<span class="match-vs">VS</span>';

  const teams = hasTeams
    ? `<div class="match-teams">
         <span class="team">${escapeHtml(item.home || 'TBC')}</span>
         ${centre}
         <span class="team">${escapeHtml(item.away || 'TBC')}</span>
       </div>`
    : `<p class="match-title">${escapeHtml(title)}</p>`;

  return `
    <article class="match-card">
      ${src ? `<img class="match-photo" src="${escapeHtml(src)}" alt="${escapeHtml(title)}" loading="lazy" />` : ''}
      <div class="match-top">
        <span class="match-comp">${escapeHtml(item.competition || '')}</span>
        ${pill}
      </div>
      ${teams}
      ${item.date ? `<p class="match-date">${escapeHtml(item.date)}</p>` : ''}
    </article>`;
}

/* ------------------------------------------------------------------
   Header: mobile menu and admin sign-in popover
------------------------------------------------------------------ */
function bindHeader() {
  const nav = $('#site-nav');
  const menuToggle = $('#menu-toggle');

  menuToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });

  $$('a', nav).forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });

  $('#admin-toggle').addEventListener('click', () => {
    if (state.isAdmin) {
      openStudio();
      return;
    }
    setLoginOpen($('#admin-login-popover').hidden);
  });

  $('#toggle-password').addEventListener('click', (event) => {
    const input = $('#admin-password');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    event.currentTarget.textContent = show ? 'Hide' : 'Show';
  });

  $('#admin-login-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = $('#admin-password');
    const status = $('#admin-status');

    if (input.value !== ADMIN_PASSWORD) {
      status.textContent = 'That password is not right. Please try again.';
      input.select();
      return;
    }

    sessionStorage.setItem(AUTH_KEY, 'true');
    state.isAdmin = true;
    input.value = '';
    status.textContent = '';
    setLoginOpen(false);

    state.data = resolveWorkingData();
    persist();
    renderSite();
    refreshStudio();
    restoreFormDrafts();
    openStudio();
  });

  document.addEventListener('click', (event) => {
    const popover = $('#admin-login-popover');
    if (!popover.hidden && !event.target.closest('.admin-menu')) {
      setLoginOpen(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }
    if (!$('#admin-studio').hidden) {
      closeStudio();
    } else if (!$('#admin-login-popover').hidden) {
      setLoginOpen(false);
      $('#admin-toggle').focus();
    }
  });
}

function setLoginOpen(open) {
  $('#admin-login-popover').hidden = !open;
  $('#admin-toggle').setAttribute('aria-expanded', String(open));
  if (open) {
    $('#admin-status').textContent = '';
    $('#admin-password').focus();
  }
}

function signOut() {
  sessionStorage.removeItem(AUTH_KEY);
  state.isAdmin = false;
  closeStudio(false);
  SECTION_TYPES.forEach((type) => closeForm(type, false));
  state.data = cloneData(state.serverData);
  renderSite();
  updateDirtyUi();
}

/* ------------------------------------------------------------------
   Admin studio shell
------------------------------------------------------------------ */
function openStudio() {
  $('#admin-studio').hidden = false;
  document.body.classList.add('studio-open');
  showTab(state.activeTab);
  $('#studio-close').focus();
}

function closeStudio(returnFocus = true) {
  $('#admin-studio').hidden = true;
  document.body.classList.remove('studio-open');
  if (returnFocus) {
    $('#admin-toggle').focus();
  }
}

function showTab(tab) {
  state.activeTab = tab;
  $$('[data-tab]').forEach((button) => {
    const active = button.dataset.tab === tab;
    button.setAttribute('aria-selected', String(active));
    button.classList.toggle('is-active', active);
  });
  $$('.studio-panel').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tab;
  });
  $('.studio-body').scrollTop = 0;
}

function refreshStudio() {
  SECTION_TYPES.forEach(renderList);
  fillSiteForm();
  updateDirtyUi();
}

function updateDirtyUi() {
  const dirty = state.isAdmin && isDirty();
  const toggle = $('#admin-toggle');
  toggle.classList.toggle('is-signed-in', state.isAdmin);
  toggle.classList.toggle('has-changes', dirty);
  toggle.setAttribute(
    'aria-label',
    state.isAdmin ? 'Admin: open the admin studio' : 'Admin: sign in'
  );

  const chip = $('#dirty-chip');
  chip.textContent = dirty ? 'Unpublished changes' : 'All changes published';
  chip.classList.toggle('is-dirty', dirty);

  const counts = SECTION_TYPES.map(
    (type) =>
      `<li><strong>${state.data[type].length}</strong><span>${escapeHtml(SECTIONS[type].label)}</span></li>`
  ).join('');

  $('#publish-summary').innerHTML = `
    <div class="summary-state ${dirty ? 'is-dirty' : 'is-clean'}">
      <strong>${dirty ? 'You have unpublished changes' : 'Everything is published'}</strong>
      <p>${
        dirty
          ? 'Visitors cannot see your latest edits yet. Download the file below and upload it to your site.'
          : 'The live site matches what you see here.'
      }</p>
    </div>
    <ul class="summary-counts">${counts}</ul>`;
}

function setStatus(section, message, type = 'info', options = {}) {
  const element =
    section === 'site'
      ? $('#site-status')
      : section === 'publish'
        ? $('#publish-status')
        : sectionEl(section, 'status');

  if (!element) {
    return;
  }

  if (!message) {
    element.hidden = true;
    element.innerHTML = '';
    return;
  }

  let html = `<span>${escapeHtml(message)}</span>`;
  if (options.undo) {
    html += '<button type="button" class="link-btn" data-action="undo">Undo</button>';
  }
  if (options.publish) {
    html += '<button type="button" class="link-btn" data-action="go-publish">Publish →</button>';
  }

  element.className = `panel-status is-${type}`;
  element.innerHTML = html;
  element.hidden = false;
}

/* ------------------------------------------------------------------
   Independent content panels (News, Transfers, Fixtures, Results)
------------------------------------------------------------------ */
function sectionPanel(section) {
  return document.getElementById(`panel-${section}`);
}

function sectionEl(section, role) {
  const panel = sectionPanel(section);
  return panel ? panel.querySelector(`[data-role="${role}"]`) : null;
}

function buildStudio() {
  const html = SECTION_TYPES.map(panelHtml).join('');
  $('#studio-panels').insertAdjacentHTML('afterbegin', html);
}

function panelHtml(section) {
  const cfg = SECTIONS[section];
  const fields = cfg.fields.map((field) => fieldHtml(section, field)).join('');

  return `
    <section class="studio-panel" id="panel-${section}" data-panel="${section}" data-section="${section}"
      role="tabpanel" aria-labelledby="tab-${section}" hidden>
      <div class="panel-head">
        <div>
          <h3>${escapeHtml(cfg.label)}</h3>
          <p>${escapeHtml(cfg.intro)}</p>
        </div>
        <button type="button" class="btn btn-primary" data-action="new">+ Add ${escapeHtml(cfg.noun)}</button>
      </div>

      <div class="panel-status" data-role="status" role="status" aria-live="polite" hidden></div>

      <form class="entry-form" data-role="form" novalidate hidden>
        <h4 data-role="form-title"></h4>
        <div class="form-grid">${fields}</div>

        <div class="photo-field">
          <span class="field-label">${escapeHtml(cfg.photoLabel)} <em>optional</em></span>
          <label class="dropzone">
            <input type="file" accept="image/*" data-role="image-input" />
            <span class="dropzone-icon" aria-hidden="true">📷</span>
            <span class="dropzone-text" data-role="drop-text">Click to choose a photo, or drop one here</span>
          </label>
          <div class="photo-preview" data-role="preview" hidden>
            <img alt="Selected photo preview" />
            <button type="button" class="btn btn-secondary btn-sm" data-action="remove-photo">Remove photo</button>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" data-role="submit">Save ${escapeHtml(cfg.noun)}</button>
          <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
        </div>
      </form>

      <div class="entry-list" data-role="list"></div>
    </section>`;
}

function fieldHtml(section, field) {
  const id = `${section}-${field.key}`;
  const wide = field.wide ? ' field-wide' : '';
  const label =
    escapeHtml(field.label) + (field.required ? ' <em class="req">required</em>' : '');
  const placeholder = escapeHtml(field.placeholder || '');

  switch (field.type) {
    case 'textarea':
      return `
        <label class="field${wide}" for="${id}">
          <span>${label}</span>
          <textarea class="input" id="${id}" rows="4" placeholder="${placeholder}"></textarea>
        </label>`;

    case 'checkbox':
      return `
        <label class="check-field${wide}" for="${id}">
          <input id="${id}" type="checkbox" />
          <span>${escapeHtml(field.label)}</span>
        </label>`;

    case 'score':
      return `
        <fieldset class="field score-field${wide}">
          <legend>${label}</legend>
          <div class="score-inputs">
            <label for="${id}-home"><span class="sr-only">Home score</span>
              <input class="input" id="${id}-home" type="number" min="0" max="99" inputmode="numeric" placeholder="0" />
            </label>
            <span class="score-dash" aria-hidden="true">–</span>
            <label for="${id}-away"><span class="sr-only">Away score</span>
              <input class="input" id="${id}-away" type="number" min="0" max="99" inputmode="numeric" placeholder="0" />
            </label>
          </div>
        </fieldset>`;

    case 'when': {
      const chips = (field.quick || [])
        .map(
          (value) =>
            `<button type="button" class="chip" data-action="quick" data-target="${id}" data-value="${escapeHtml(value)}">${escapeHtml(value)}</button>`
        )
        .join('');
      const time = field.time
        ? `<label class="mini-picker"><span>Time</span><input class="input" type="time" data-time-for="${id}" /></label>`
        : '';
      return `
        <div class="field when-field${wide}">
          <label for="${id}"><span>${label}</span></label>
          <input class="input" id="${id}" type="text" placeholder="Type it, tap a shortcut, or pick a date" />
          <div class="when-tools">
            <div class="chips">${chips}</div>
            <div class="pickers">
              <label class="mini-picker"><span>Date</span><input class="input" type="date" data-date-for="${id}" /></label>
              ${time}
            </div>
          </div>
        </div>`;
    }

    default: {
      const listId = field.options ? `${id}-options` : '';
      const datalist = field.options
        ? `<datalist id="${listId}">${field.options.map((o) => `<option value="${escapeHtml(o)}"></option>`).join('')}</datalist>`
        : '';
      return `
        <label class="field${wide}" for="${id}">
          <span>${label}</span>
          <input class="input" id="${id}" type="text" placeholder="${placeholder}"${listId ? ` list="${listId}"` : ''} autocomplete="off" />
          ${datalist}
        </label>`;
    }
  }
}

function bindStudio() {
  $$('[data-close-studio]').forEach((element) => {
    element.addEventListener('click', () => closeStudio());
  });
  $('#admin-logout').addEventListener('click', signOut);

  const tabs = $('#studio-tabs');
  tabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tab]');
    if (button) {
      showTab(button.dataset.tab);
    }
  });
  tabs.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    const buttons = $$('[data-tab]', tabs);
    const index = buttons.indexOf(document.activeElement);
    if (index === -1) {
      return;
    }
    const next = buttons[(index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
    showTab(next.dataset.tab);
    next.focus();
  });

  const panels = $('#studio-panels');
  panels.addEventListener('click', onPanelClick);
  panels.addEventListener('submit', onPanelSubmit);
  panels.addEventListener('input', onPanelInput);
  panels.addEventListener('change', onPanelChange);

  $('#site-form').addEventListener('submit', saveSite);
  bindPublish();
}

function onPanelClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  if (action === 'go-publish') {
    showTab('publish');
    return;
  }

  const panel = button.closest('[data-section]');
  if (!panel) {
    return;
  }

  const section = panel.dataset.section;
  const index = Number(button.dataset.index);

  switch (action) {
    case 'new':
      openForm(section, null);
      break;
    case 'cancel':
      closeForm(section, true);
      setStatus(section, '');
      break;
    case 'edit':
      openForm(section, index);
      break;
    case 'delete':
      deleteEntry(section, index);
      break;
    case 'move-up':
      moveEntry(section, index, -1);
      break;
    case 'move-down':
      moveEntry(section, index, 1);
      break;
    case 'undo':
      undoDelete();
      break;
    case 'remove-photo':
      state.sections[section].image = '';
      updatePreview(section);
      scheduleFormDraft(section);
      break;
    case 'quick': {
      const target = document.getElementById(button.dataset.target);
      if (target) {
        target.value = button.dataset.value;
        scheduleFormDraft(section);
      }
      break;
    }
    default:
      break;
  }
}

function onPanelSubmit(event) {
  const form = event.target.closest('[data-role="form"]');
  if (!form) {
    return;
  }
  event.preventDefault();
  saveEntry(form.closest('[data-section]').dataset.section);
}

function onPanelInput(event) {
  const panel = event.target.closest('[data-section]');
  if (panel && event.target.closest('[data-role="form"]')) {
    scheduleFormDraft(panel.dataset.section);
  }
}

function onPanelChange(event) {
  const panel = event.target.closest('[data-section]');
  if (!panel) {
    return;
  }
  const section = panel.dataset.section;
  const target = event.target;

  if (target.matches('[data-role="image-input"]')) {
    handleImage(section, target);
  } else if (target.matches('[data-date-for], [data-time-for]')) {
    syncWhen(target.dataset.dateFor || target.dataset.timeFor);
    scheduleFormDraft(section);
  }
}

function syncWhen(id) {
  const text = document.getElementById(id);
  const date = $(`[data-date-for="${id}"]`);
  const time = $(`[data-time-for="${id}"]`);
  let dateText = '';

  if (date && date.value) {
    const [year, month, day] = date.value.split('-').map(Number);
    dateText = new Date(year, month - 1, day).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }

  text.value = [dateText, time && time.value].filter(Boolean).join(' • ');
}

/* ---- Form helpers ---- */
function readForm(section) {
  const values = {};
  SECTIONS[section].fields.forEach((field) => {
    const id = `${section}-${field.key}`;
    if (field.type === 'checkbox') {
      values[field.key] = document.getElementById(id).checked;
    } else if (field.type === 'score') {
      const home = document.getElementById(`${id}-home`).value.trim();
      const away = document.getElementById(`${id}-away`).value.trim();
      values[field.key] = home || away ? `${home} - ${away}` : '';
    } else {
      values[field.key] = document.getElementById(id).value.trim();
    }
  });
  return values;
}

function writeForm(section, values) {
  SECTIONS[section].fields.forEach((field) => {
    const id = `${section}-${field.key}`;
    const value = values[field.key];
    if (field.type === 'checkbox') {
      document.getElementById(id).checked = Boolean(value);
    } else if (field.type === 'score') {
      const score = parseScore(value);
      document.getElementById(`${id}-home`).value = score.home;
      document.getElementById(`${id}-away`).value = score.away;
    } else {
      document.getElementById(id).value = value == null ? '' : String(value);
    }
  });
}

function itemToValues(section, item) {
  const values = {};
  SECTIONS[section].fields.forEach((field) => {
    values[field.key] = item[field.key];
  });
  return values;
}

function validate(section, values) {
  for (const field of SECTIONS[section].fields) {
    if (!field.required) {
      continue;
    }
    if (field.type === 'score') {
      const score = parseScore(values[field.key]);
      if (score.home === '' || score.away === '') {
        return {
          id: `${section}-${field.key}-${score.home === '' ? 'home' : 'away'}`,
          message: 'Enter the final score for both teams.',
        };
      }
    } else if (!values[field.key]) {
      return { id: `${section}-${field.key}`, message: `Please fill in “${field.label}”.` };
    }
  }
  return null;
}

function buildItem(section, values) {
  const cfg = SECTIONS[section];
  const item = {};

  cfg.fields.forEach((field) => {
    if (field.type === 'checkbox') {
      item[field.key] = Boolean(values[field.key]);
    } else {
      item[field.key] = values[field.key] || cfg.defaults[field.key] || '';
    }
  });

  if (section === 'fixtures' || section === 'results') {
    item.title = `${item.home} vs ${item.away}`;
  }
  if (state.sections[section].image) {
    item.image = state.sections[section].image;
  }
  return item;
}

function openForm(section, index, preset = null, focus = true) {
  const cfg = SECTIONS[section];
  const s = state.sections[section];
  const item = index !== null ? state.data[section][index] : null;

  s.editing = index;
  s.formOpen = true;
  s.image = preset ? preset.image || '' : item ? safeImageSrc(item.image) : '';

  const form = sectionEl(section, 'form');
  form.reset();
  writeForm(section, preset ? preset.values : item ? itemToValues(section, item) : {});
  sectionEl(section, 'form-title').textContent =
    index === null ? `New ${cfg.noun}` : `Edit ${cfg.noun}`;
  sectionEl(section, 'submit').textContent = index === null ? `Save ${cfg.noun}` : 'Save changes';
  form.hidden = false;
  updatePreview(section);

  if (focus) {
    form.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const first = form.querySelector('input:not([type="file"]), textarea');
    if (first) {
      first.focus({ preventScroll: true });
    }
  }
}

function closeForm(section, clearDraft) {
  const s = state.sections[section];
  s.editing = null;
  s.formOpen = false;
  s.image = '';

  const form = sectionEl(section, 'form');
  form.reset();
  form.hidden = true;
  updatePreview(section);

  window.clearTimeout(state.draftTimers[section]);
  if (clearDraft) {
    localStorage.removeItem(FORM_DRAFT_PREFIX + section);
  }
}

function saveEntry(section) {
  const cfg = SECTIONS[section];
  const s = state.sections[section];
  const values = readForm(section);
  const problem = validate(section, values);

  if (problem) {
    setStatus(section, problem.message, 'error');
    const element = document.getElementById(problem.id);
    if (element) {
      element.focus();
    }
    return;
  }

  const items = state.data[section];
  const built = buildItem(section, values);
  let saved;

  if (s.editing !== null && items[s.editing]) {
    saved = { ...items[s.editing], ...built };
    if (!built.image) {
      delete saved.image;
    }
    items[s.editing] = saved;
  } else {
    saved = built;
    items.unshift(saved);
  }

  if (section === 'news' && saved.featured) {
    items.forEach((item) => {
      if (item !== saved) {
        item.featured = false;
      }
    });
  }

  closeForm(section, true);
  commit(section, `Saved “${cfg.rowTitle(saved)}”.`, { publish: true });
}

function deleteEntry(section, index) {
  const items = state.data[section];
  if (!items[index]) {
    return;
  }

  const s = state.sections[section];
  const [removed] = items.splice(index, 1);
  state.lastDeleted = { section, index, item: removed };

  if (s.editing === index) {
    closeForm(section, true);
  } else if (s.editing !== null && s.editing > index) {
    s.editing -= 1;
  }

  commit(section, `Deleted “${SECTIONS[section].rowTitle(removed)}”.`, {
    undo: true,
    type: 'info',
  });
}

function undoDelete() {
  const deleted = state.lastDeleted;
  if (!deleted) {
    return;
  }

  state.data[deleted.section].splice(deleted.index, 0, deleted.item);
  const s = state.sections[deleted.section];
  if (s.editing !== null && s.editing >= deleted.index) {
    s.editing += 1;
  }
  state.lastDeleted = null;
  commit(deleted.section, `Restored “${SECTIONS[deleted.section].rowTitle(deleted.item)}”.`, {
    publish: true,
  });
}

function moveEntry(section, index, delta) {
  const items = state.data[section];
  const target = index + delta;
  if (!items[index] || target < 0 || target >= items.length) {
    return;
  }

  [items[index], items[target]] = [items[target], items[index]];
  const s = state.sections[section];
  if (s.editing === index) {
    s.editing = target;
  } else if (s.editing === target) {
    s.editing = index;
  }

  commit(section, 'Order updated.', { publish: true });
}

function commit(section, message, options = {}) {
  const ok = persist();
  renderSite();
  renderList(section);
  if (ok) {
    setStatus(section, message, options.type || 'success', options);
  } else {
    setStatus(section, STORAGE_FULL_MESSAGE, 'error');
  }
}

function renderList(section) {
  const cfg = SECTIONS[section];
  const list = sectionEl(section, 'list');
  const items = state.data[section];

  if (!items.length) {
    list.innerHTML = `
      <div class="empty-state">
        <strong>No ${escapeHtml(cfg.plural)} yet</strong>
        <p>Use “Add ${escapeHtml(cfg.noun)}” to create the first one.</p>
      </div>`;
    return;
  }

  list.innerHTML = items
    .map((item, index) => {
      const src = safeImageSrc(item.image);
      const thumb = src
        ? `<img class="entry-thumb" src="${escapeHtml(src)}" alt="" />`
        : `<span class="entry-thumb entry-thumb-empty" aria-hidden="true">${cfg.icon}</span>`;
      const meta = cfg.rowMeta(item).filter(Boolean).map(escapeHtml).join(' · ');
      const name = escapeHtml(cfg.rowTitle(item));
      const featured =
        section === 'news' && item.featured ? '<span class="badge badge-gold">Featured</span>' : '';

      return `
        <article class="entry-row">
          ${thumb}
          <div class="entry-main">
            <h4>${name}</h4>
            <p>${meta}</p>
            ${featured}
          </div>
          <div class="entry-actions">
            <button type="button" class="icon-btn" data-action="move-up" data-index="${index}" aria-label="Move ${name} up"${index === 0 ? ' disabled' : ''}>↑</button>
            <button type="button" class="icon-btn" data-action="move-down" data-index="${index}" aria-label="Move ${name} down"${index === items.length - 1 ? ' disabled' : ''}>↓</button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="edit" data-index="${index}" aria-label="Edit ${name}">Edit</button>
            <button type="button" class="btn btn-danger btn-sm" data-action="delete" data-index="${index}" aria-label="Delete ${name}">Delete</button>
          </div>
        </article>`;
    })
    .join('');
}

/* ---- Photos ---- */
async function handleImage(section, input) {
  const file = input.files && input.files[0];
  if (!file) {
    return;
  }

  try {
    setStatus(section, 'Preparing your photo…', 'info');
    state.sections[section].image = await prepareImage(file);
    updatePreview(section);
    setStatus(section, 'Photo added. Save to keep it.', 'info');
    scheduleFormDraft(section);
  } catch (error) {
    setStatus(section, error.message, 'error');
  } finally {
    input.value = '';
  }
}

function prepareImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file (JPG, PNG or WebP).'));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      reject(new Error('That photo is larger than 15 MB. Please pick a smaller one.'));
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as a photo. Try a JPG or PNG.'));
    };
    image.src = url;
  });
}

function updatePreview(section) {
  const s = state.sections[section];
  const wrap = sectionEl(section, 'preview');
  const image = wrap.querySelector('img');
  const text = sectionEl(section, 'drop-text');

  if (s.image) {
    image.src = s.image;
    wrap.hidden = false;
    text.textContent = 'Click to change the photo';
  } else {
    image.removeAttribute('src');
    wrap.hidden = true;
    text.textContent = 'Click to choose a photo, or drop one here';
  }
}

/* ---- Per-section autosaved form drafts ---- */
function scheduleFormDraft(section) {
  window.clearTimeout(state.draftTimers[section]);
  state.draftTimers[section] = window.setTimeout(() => saveFormDraft(section), 300);
}

function saveFormDraft(section) {
  const s = state.sections[section];
  if (!s.formOpen || !state.isAdmin) {
    return;
  }
  try {
    localStorage.setItem(
      FORM_DRAFT_PREFIX + section,
      JSON.stringify({ editing: s.editing, values: readForm(section), image: s.image })
    );
  } catch (error) {
    console.error(error);
  }
}

function restoreFormDrafts() {
  SECTION_TYPES.forEach((section) => {
    let draft = null;
    try {
      draft = JSON.parse(localStorage.getItem(FORM_DRAFT_PREFIX + section) || 'null');
    } catch (error) {
      draft = null;
    }
    if (!draft || !draft.values) {
      return;
    }

    const editing =
      Number.isInteger(draft.editing) && state.data[section][draft.editing] ? draft.editing : null;
    openForm(section, editing, { values: draft.values, image: safeImageSrc(draft.image) }, false);
    setStatus(section, 'Restored the draft you were working on.', 'info');
    state.activeTab = section;
  });
}

/* ------------------------------------------------------------------
   Site details (independent)
------------------------------------------------------------------ */
function fillSiteForm() {
  $('#site-title').value = state.data.site.title || '';
  $('#site-tagline').value = state.data.site.tagline || '';
}

function saveSite(event) {
  event.preventDefault();
  const title = $('#site-title').value.trim();
  const tagline = $('#site-tagline').value.trim();

  if (!title) {
    setStatus('site', 'Please enter a site name.', 'error');
    $('#site-title').focus();
    return;
  }

  state.data.site = { ...state.data.site, title, tagline };
  const ok = persist();
  renderSite();
  if (ok) {
    setStatus('site', 'Site details saved.', 'success', { publish: true });
  } else {
    setStatus('site', STORAGE_FULL_MESSAGE, 'error');
  }
}

/* ------------------------------------------------------------------
   Publish & backup (independent)
------------------------------------------------------------------ */
function bindPublish() {
  $('#download-data-btn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'blog-data.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(
      'publish',
      'Downloaded blog-data.json. Upload it to your site’s data folder, replacing the old file.',
      'success'
    );
  });

  $('#import-data').addEventListener('change', async (event) => {
    const input = event.target;
    const file = input.files && input.files[0];
    if (!file) {
      return;
    }

    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Invalid data file');
      }
      state.data = normalizeData(parsed);
      SECTION_TYPES.forEach((type) => closeForm(type, true));
      const ok = persist();
      renderSite();
      refreshStudio();
      setStatus(
        'publish',
        ok ? 'Backup restored. Review it, then publish when you are ready.' : STORAGE_FULL_MESSAGE,
        ok ? 'success' : 'error'
      );
    } catch (error) {
      setStatus('publish', 'That file is not a valid blog data file.', 'error');
    } finally {
      input.value = '';
    }
  });

  $('#discard-changes-btn').addEventListener('click', () => {
    if (!isDirty()) {
      setStatus('publish', 'There are no unpublished changes to discard.', 'info');
      return;
    }
    if (!window.confirm('Discard all unpublished changes and go back to the live version?')) {
      return;
    }

    localStorage.removeItem(DRAFT_KEY);
    state.data = cloneData(state.serverData);
    SECTION_TYPES.forEach((type) => closeForm(type, true));
    renderSite();
    refreshStudio();
    setStatus('publish', 'Back to the live version.', 'success');
  });
}

/* ------------------------------------------------------------------
   Start
------------------------------------------------------------------ */
LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
localStorage.removeItem(AUTH_KEY);
buildStudio();
bindHeader();
bindStudio();
loadData();
