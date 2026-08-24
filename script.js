const STORAGE_KEY = 'sportsblog-data-v1';
const ADMIN_STORAGE_KEY = 'sportsblog-admin-auth';
const LOCAL_DRAFT_ENABLED_KEY = 'sportsblog-local-draft-enabled';
const ADMIN_PASSWORD = '4AMsports2026';
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const state = {
  data: null,
  defaultData: null,
};

async function loadData() {
  try {
    const response = await fetch('./data/blog-data.json?ts=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Could not load blog data');
    }

    const fileData = await response.json();
    state.defaultData = JSON.parse(JSON.stringify(fileData));
    state.data = fileData;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && shouldUseLocalDraft()) {
      try {
        const savedData = JSON.parse(saved);
        state.data = savedData;
      } catch (error) {
        state.data = fileData;
      }
    }

    saveDataToStorage();
    renderSite();
    bindEditor();
    initAdmin();
    updateEditor();
  } catch (error) {
    console.error(error);
    document.getElementById('hero-title').textContent = 'Content unavailable';
    document.getElementById('hero-summary').textContent = 'Please check the data file.';
  }
}

function shouldUseLocalDraft() {
  const isAuthenticated = localStorage.getItem(ADMIN_STORAGE_KEY) === 'true';
  const useDraft = localStorage.getItem(LOCAL_DRAFT_ENABLED_KEY) === 'true';
  return isAuthenticated && useDraft;
}

function renderSite() {
  const { site, news, transfers, fixtures, results } = state.data;

  const featuredStory = news.find((item) => item.featured) || news[0];
  document.getElementById('hero-title').textContent = featuredStory.title;
  document.getElementById('hero-summary').textContent = featuredStory.summary;
  document.getElementById('hero-meta').innerHTML = `
    <span>${featuredStory.category}</span>
    <span>${featuredStory.date}</span>
  `;

  document.getElementById('stat-news').textContent = news.length;
  document.getElementById('stat-transfers').textContent = transfers.length;
  document.getElementById('stat-fixtures').textContent = fixtures.length;
  document.getElementById('stat-results').textContent = results.length;

  renderCards('news-list', news, 'news');
  renderCards('transfers-list', transfers, 'transfer');
  renderList('fixtures-list', fixtures, 'fixture');
  renderList('results-list', results, 'result');

  const siteTitle = site?.title || '4AM Sports Live';
  document.title = `${siteTitle} | Sports Blog`;

  const brandLabel = document.querySelector('.brand span:last-child');
  if (brandLabel) {
    brandLabel.textContent = siteTitle;
  }
}

function initAdmin() {
  const gate = document.getElementById('admin-gate');
  const editorContent = document.getElementById('admin-editor-content');
  const form = document.getElementById('admin-login-form');
  const status = document.getElementById('admin-status');
  const logoutBtn = document.getElementById('admin-logout');

  if (!gate || !editorContent || !form || !status || !logoutBtn) {
    return;
  }

  const isAuthenticated = localStorage.getItem(ADMIN_STORAGE_KEY) === 'true';
  toggleAdminView(isAuthenticated);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const password = document.getElementById('admin-password').value;

    if (password === ADMIN_PASSWORD) {
      localStorage.setItem(ADMIN_STORAGE_KEY, 'true');
      toggleAdminView(true);
      if (localStorage.getItem(LOCAL_DRAFT_ENABLED_KEY) === 'true') {
        status.textContent = 'Access granted. Local draft mode is active in this browser.';
      } else {
        status.textContent = 'Access granted. You can update content now.';
      }
    } else {
      status.textContent = 'Incorrect password. Please try again.';
    }
  });

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    localStorage.removeItem(LOCAL_DRAFT_ENABLED_KEY);
    toggleAdminView(false);
    document.getElementById('admin-password').value = '';
    status.textContent = 'Logged out. Enter the password to continue.';
  });

  function toggleAdminView(isVisible) {
    gate.hidden = isVisible;
    editorContent.hidden = !isVisible;
    logoutBtn.hidden = !isVisible;
  }
}

function bindEditor() {
  const form = document.getElementById('content-form');
  const status = document.getElementById('editor-status');
  const saveBtn = document.getElementById('save-data-btn');
  const downloadBtn = document.getElementById('download-data-btn');
  const resetBtn = document.getElementById('reset-data-btn');
  const importInput = document.getElementById('import-data');
  const imageInput = document.getElementById('entry-image');
  const imagePreview = document.getElementById('image-preview');
  const imagePreviewWrap = document.getElementById('image-preview-wrap');

  if (!form || !status || !saveBtn || !downloadBtn || !resetBtn || !importInput || !imageInput || !imagePreview || !imagePreviewWrap) {
    return;
  }

  imageInput.addEventListener('change', async () => {
    try {
      const imageData = await readImageInput(imageInput);
      updateImagePreview(imageData);
      status.textContent = imageData ? 'Image ready. Add the entry to save it into the JSON data.' : 'Image removed.';
    } catch (error) {
      imageInput.value = '';
      updateImagePreview('');
      status.textContent = error.message;
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const type = document.getElementById('entry-type').value;
    const entry = await buildEntry(type);
    if (!entry) {
      status.textContent = 'Please add a title before saving.';
      return;
    }

    if (!state.data[type]) {
      state.data[type] = [];
    }

    state.data[type].push(entry);
    localStorage.setItem(LOCAL_DRAFT_ENABLED_KEY, 'true');
    saveDataToStorage();
    renderSite();
    form.reset();
    updateImagePreview('');
    status.textContent = 'Entry added and saved locally.';
  });

  saveBtn.addEventListener('click', () => {
    localStorage.setItem(LOCAL_DRAFT_ENABLED_KEY, 'true');
    saveDataToStorage();
    status.textContent = 'Saved to this browser for quick access.';
  });

  downloadBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sportsblog-data.json';
    link.click();
    URL.revokeObjectURL(url);
    status.textContent = 'JSON file downloaded.';
  });

  resetBtn.addEventListener('click', () => {
    if (state.defaultData) {
      state.data = JSON.parse(JSON.stringify(state.defaultData));
      saveDataToStorage();
      renderSite();
      form.reset();
      updateImagePreview('');
      status.textContent = 'Sample content restored.';
    }
  });

  importInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      state.data = parsed;
      localStorage.setItem(LOCAL_DRAFT_ENABLED_KEY, 'true');
      saveDataToStorage();
      renderSite();
      status.textContent = 'Content imported successfully.';
    } catch (error) {
      status.textContent = 'That file is not valid JSON.';
    }
  });
}

async function buildEntry(type) {
  const title = document.getElementById('entry-title').value.trim();
  const summary = document.getElementById('entry-summary').value.trim();
  const date = document.getElementById('entry-date').value.trim();
  const extra = document.getElementById('entry-extra').value.trim();
  const home = document.getElementById('entry-home').value.trim();
  const away = document.getElementById('entry-away').value.trim();
  const competition = document.getElementById('entry-competition').value.trim();
  const score = document.getElementById('entry-score').value.trim();
  const status = document.getElementById('entry-status').value.trim();
  const imageData = await readImageInput(document.getElementById('entry-image'));

  if (!title) {
    return null;
  }

  switch (type) {
    case 'news':
      return {
        title,
        category: extra || 'News',
        date: date || 'Today',
        summary: summary || 'Fresh update from the club.',
        image: imageData,
        featured: false,
      };
    case 'transfers':
      return {
        title,
        club: extra || 'Transfer',
        date: date || 'Today',
        summary: summary || 'Latest transfer update.',
        image: imageData,
      };
    case 'fixtures':
      return {
        title: title || `${home} vs ${away}`,
        home: home || 'Home Team',
        away: away || 'Away Team',
        date: date || 'Upcoming',
        competition: competition || 'League',
        status: status || 'Fixture',
        image: imageData,
      };
    case 'results':
      return {
        title: title || `${home} vs ${away}`,
        home: home || 'Home Team',
        away: away || 'Away Team',
        date: date || 'Recent',
        score: score || '0 - 0',
        competition: competition || 'League',
        image: imageData,
      };
    default:
      return null;
  }
}

async function readImageInput(input) {
  const file = input?.files?.[0];
  if (!file) {
    return '';
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file.');
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('Image is too large. Please use an image under 2 MB.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

function updateImagePreview(imageData) {
  const imagePreview = document.getElementById('image-preview');
  const imagePreviewWrap = document.getElementById('image-preview-wrap');

  if (!imagePreview || !imagePreviewWrap) {
    return;
  }

  if (imageData) {
    imagePreview.src = imageData;
    imagePreviewWrap.hidden = false;
    return;
  }

  imagePreview.removeAttribute('src');
  imagePreviewWrap.hidden = true;
}

function updateEditor() {
  const editor = document.getElementById('json-editor');
  if (editor && state.data) {
    editor.value = JSON.stringify(state.data, null, 2);
  }
}

function saveDataToStorage() {
  if (!state.data) {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  updateEditor();
}

function renderCards(containerId, items, kind) {
  const container = document.getElementById(containerId);
  container.innerHTML = items
    .map((item) => {
      const title = item.title || item.player || item.club;
      const summary = item.summary || item.detail || item.note || '';
      const badge = item.category || item.club || item.status || 'Update';
      const imageMarkup = item.image
        ? `<img class="entry-image" src="${item.image}" alt="${title}" loading="lazy" />`
        : '';
      return `
        <article class="card">
          ${imageMarkup}
          <span class="card-badge">${badge}</span>
          <h3>${title}</h3>
          <p class="card-body">${summary}</p>
          <p class="card-body"><strong>${item.date || item.time || ''}</strong></p>
        </article>
      `;
    })
    .join('');
}

function renderList(containerId, items, kind) {
  const container = document.getElementById(containerId);
  container.innerHTML = items
    .map((item) => {
      const title = item.title || `${item.home} vs ${item.away}`;
      const meta = item.competition || item.status || item.score || item.time || '';
      const imageMarkup = item.image
        ? `<img class="entry-image" src="${item.image}" alt="${title}" loading="lazy" />`
        : '';
      return `
        <article class="stack-item">
          ${imageMarkup}
          <strong>${title}</strong>
          <p>${item.date || item.time || ''}</p>
          <p>${meta}</p>
        </article>
      `;
    })
    .join('');
}

loadData();
