const CATEGORY_LABELS = {
  'all': 'All Assets',
  'favorites': 'Favorites',
  'images': 'Images',
  'audio': 'Audio',
  'materials': 'Materials',
  'scripts': 'Scripts',
  'videos': 'Videos',
  'documents': 'Documents',
  '3d-models': '3D Models',
  'other': 'Other'
};

const CATEGORY_ICONS = {
  '3d-models': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>`,
  'materials': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>`,
  'images': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  'audio': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  'scripts': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  'videos': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
  'documents': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  'other': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`
};

const CATEGORY_COLORS = {
  '3d-models': '#a78bfa',
  'materials': '#c084fc',
  'images': '#60a5fa',
  'audio': '#34d399',
  'scripts': '#6ee7b7',
  'videos': '#f87171',
  'documents': '#fbbf24',
  'other': '#94a3b8'
};

let state = {
  currentCategory: 'all',
  searchQuery: '',
  sortBy: 'name',
  viewMode: 'grid',
  selectedAsset: null,
  favorites: false,
  collectionId: null,
  tagId: null,
  libraryIds: [],
  libraries: [],
  tags: [],
  collections: [],
  assets: [],
  totalCount: 0
};

let searchTimeout = null;
let contextMenuTarget = null;

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getCategoryFromExt(ext) {
  const map = {
    '.fbx': '3d-models', '.obj': '3d-models', '.gltf': '3d-models', '.glb': '3d-models',
    '.blend': '3d-models', '.3ds': '3d-models', '.dae': '3d-models', '.stl': '3d-models', '.ply': '3d-models',
    '.png': 'images', '.jpg': 'images', '.jpeg': 'images', '.tga': 'images', '.tiff': 'images',
    '.tif': 'images', '.bmp': 'images', '.gif': 'images', '.psd': 'images', '.hdr': 'images',
    '.exr': 'images', '.dds': 'images', '.ktx': 'images', '.webp': 'images', '.ico': 'images',
    '.mat': 'materials', '.material': 'materials', '.shader': 'materials',
    '.wav': 'audio', '.mp3': 'audio', '.ogg': 'audio', '.flac': 'audio',
    '.aiff': 'audio', '.m4a': 'audio', '.wma': 'audio',
    '.cs': 'scripts', '.js': 'scripts', '.ts': 'scripts', '.py': 'scripts',
    '.lua': 'scripts', '.cpp': 'scripts', '.h': 'scripts',
    '.mp4': 'videos', '.avi': 'videos', '.mov': 'videos', '.wmv': 'videos', '.mkv': 'videos', '.webm': 'videos',
    '.pdf': 'documents', '.doc': 'documents', '.docx': 'documents', '.txt': 'documents', '.md': 'documents', '.rtf': 'documents'
  };
  return map[ext] || 'other';
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function toFileUrl(filePath) {
  return 'file:///' + filePath.replace(/\\/g, '/');
}

// Data loading
async function loadLibraries() {
  state.libraries = await window.api.getLibraries();
  renderSources();
}

async function loadTags() {
  state.tags = await window.api.getTags();
  renderTags();
}

async function loadCollections() {
  state.collections = await window.api.getCollections();
  renderCollections();
}

async function loadCategoryCounts() {
  const counts = await window.api.getCategoryCounts();
  const total = await window.api.getTotalAssets();
  const favCount = await window.api.getAssetCount({ favorites: true });

  document.getElementById('count-all').textContent = total.toLocaleString();
  document.getElementById('count-favorites').textContent = favCount.toLocaleString();

  ['audio', '3d-models', 'materials', 'images', 'scripts', 'videos', 'documents'].forEach(cat => {
    const el = document.getElementById(`count-${cat}`);
    if (el) el.textContent = (counts[cat] || 0).toLocaleString();
  });

  document.getElementById('status-total').textContent = `${total.toLocaleString()} assets`;
  document.getElementById('status-libraries').textContent = `${state.libraries.length} libs`;
}

async function loadAssets() {
  const params = {
    category: state.currentCategory === 'favorites' ? 'all' : state.currentCategory,
    search: state.searchQuery,
    sort: state.sortBy,
    favorites: state.favorites,
    collectionId: state.collectionId,
    tagId: state.tagId,
    libraryIds: state.libraryIds,
    limit: 500
  };

  state.assets = await window.api.getAssets(params);
  state.totalCount = await window.api.getAssetCount(params);
  document.getElementById('asset-count-label').textContent = `${state.totalCount.toLocaleString()} assets`;
  document.getElementById('status-selected').textContent = state.selectedAsset ? '1 selected' : '0 selected';
  renderAssets();
}

// Rendering

function renderAssets() {
  const grid = document.getElementById('asset-grid');
  const emptyState = document.getElementById('empty-state');

  if (state.assets.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  grid.innerHTML = state.assets.map(asset => {
    const category = asset.category || getCategoryFromExt(asset.file_ext);
    const icon = CATEGORY_ICONS[category] || CATEGORY_ICONS['other'];
    const color = CATEGORY_COLORS[category] || CATEGORY_COLORS['other'];
    const isSelected = state.selectedAsset && state.selectedAsset.id === asset.id;
    const isFav = asset.is_favorite;
    const isImage = ['images'].includes(category);
    return `
      <div class="asset-card ${isSelected ? 'selected' : ''}" data-id="${asset.id}" data-category="${category}" data-path="${escapeHtml(asset.file_path)}">
        <div class="card-thumbnail">
          ${isImage ? `<img class="card-thumb-img" src="${toFileUrl(asset.file_path)}" alt="" loading="lazy">` : `<div class="thumb-placeholder" style="color: ${color}">${icon}</div>`}
          ${isFav ? '<div class="fav-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 5.82 21.02 12 17.77 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>' : ''}
        </div>
        <div class="card-info">
          <div class="card-name">${escapeHtml(asset.file_name)}</div>
          <div class="card-type"><span>${CATEGORY_LABELS[category] || category}</span></div>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.asset-card').forEach(card => {
    card.addEventListener('click', () => selectAsset(parseInt(card.dataset.id)));
  });
}

function renderTags() {
  const container = document.getElementById('tags-list');
  container.innerHTML = state.tags.map(tag => `
    <div class="sidebar-item ${state.tagId === tag.id ? 'active' : ''}" data-tag-id="${tag.id}">
      <div class="tag-dot" style="background: ${tag.color}"></div>
      <span class="item-name">${escapeHtml(tag.name)}</span>
      <span class="item-count">${tag.asset_count || 0}</span>
    </div>
  `).join('');

  container.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      const tagId = parseInt(item.dataset.tagId);
      state.tagId = state.tagId === tagId ? null : tagId;
      updateSidebarActive();
      loadAssets();
      renderTags();
      updateBreadcrumb();
    });
  });
}

function renderCollections() {
  const container = document.getElementById('collections-list');
  container.innerHTML = state.collections.map(col => `
    <div class="sidebar-item ${state.collectionId === col.id ? 'active' : ''}" data-collection-id="${col.id}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
      <span class="item-name">${escapeHtml(col.name)}</span>
      <span class="item-count">${col.asset_count || 0}</span>
    </div>
  `).join('');

  container.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      const colId = parseInt(item.dataset.collectionId);
      state.collectionId = state.collectionId === colId ? null : colId;
      updateSidebarActive();
      loadAssets();
      renderCollections();
      updateBreadcrumb();
    });
  });
}

function renderSources() {
  const container = document.getElementById('sources-list');
  if (!container) return;

  if (state.libraries.length === 0) {
    container.innerHTML = '<div style="padding: 8px 16px; font-size: 11.5px; color: var(--text-muted);">No folder added</div>';
    return;
  }

  container.innerHTML = state.libraries.map(lib => `
    <div class="sidebar-item source-item-row ${state.libraryIds.includes(lib.id) ? 'active' : ''}" data-library-id="${lib.id}" title="${escapeHtml(lib.path)}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
      <span class="item-name">${escapeHtml(lib.name)}</span>
      <span class="item-count">${(lib.asset_count || 0).toLocaleString()}</span>
    </div>
  `).join('');

  container.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const libId = parseInt(item.dataset.libraryId);
      const idx = state.libraryIds.indexOf(libId);
      if (idx >= 0) {
        state.libraryIds.splice(idx, 1);
      } else {
        state.libraryIds.push(libId);
      }
      updateSidebarActive();
      loadAssets();
      renderSources();
      updateBreadcrumb();
    });

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      contextMenuTarget = parseInt(item.dataset.libraryId);
      showContextMenu(e.clientX, e.clientY);
    });
  });
}

function showContextMenu(x, y) {
  const menu = document.getElementById('context-menu');
  menu.style.display = 'block';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  // Adjust if off screen
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';
}

function hideContextMenu() {
  document.getElementById('context-menu').style.display = 'none';
  contextMenuTarget = null;
}

async function selectAsset(assetId) {
  const asset = await window.api.getAsset(assetId);
  if (!asset) return;

  state.selectedAsset = asset;

  document.getElementById('inspector-empty').style.display = 'none';
  document.getElementById('inspector-content').style.display = 'flex';

  document.getElementById('inspector-title').textContent = asset.file_name;
  document.getElementById('status-selected').textContent = '1 selected';

  const favBtn = document.getElementById('inspector-fav-btn');
  favBtn.classList.toggle('active', !!asset.is_favorite);

  renderAssetDetails(asset);
  renderAssetTags(asset);
  renderAssetCollections(asset);
  loadPreview(asset);

  document.querySelectorAll('.asset-card').forEach(card => {
    card.classList.toggle('selected', parseInt(card.dataset.id) === assetId);
  });
}

function renderAssetDetails(asset) {
  const container = document.getElementById('inspector-details');
  const category = asset.category || getCategoryFromExt(asset.file_ext);
  const ext = asset.file_ext.toLowerCase();

  let details = '';
  details += detailRow('Type', CATEGORY_LABELS[category] || category);
  details += detailRow('File', asset.file_name);
  details += detailRow('Path', asset.file_path, 'mono');
  details += detailRow('Size', formatFileSize(asset.file_size));
  details += detailRow('Modified', formatDate(asset.modified_date));
  details += detailRow('Created', formatDate(asset.created_date));
  details += detailRow('Extension', ext);

  if (category === '3d-models') {
    details += detailRow('Format', ext.replace('.', '').toUpperCase());
  } else if (category === 'textures') {
    details += detailRow('Format', ext.replace('.', '').toUpperCase());
  } else if (category === 'audio') {
    details += detailRow('Format', ext.replace('.', '').toUpperCase());
  } else if (category === 'videos') {
    details += detailRow('Format', ext.replace('.', '').toUpperCase());
  } else if (category === 'scripts') {
    details += detailRow('Language', ext.replace('.', '').toUpperCase());
  } else if (category === 'documents') {
    details += detailRow('Format', ext.replace('.', '').toUpperCase());
  }

  container.innerHTML = details;
}

function detailRow(label, value, cls = '') {
  return `
    <div class="detail-row">
      <span class="detail-label">${label}</span>
      <span class="detail-value ${cls}">${escapeHtml(value || '-')}</span>
    </div>
  `;
}

function renderAssetTags(asset) {
  const container = document.getElementById('inspector-tag-chips');
  const tagNames = asset.tags ? asset.tags.split(',') : [];
  const tagColors = asset.tag_colors ? asset.tag_colors.split(',') : [];

  container.innerHTML = tagNames.map((name, i) => {
    const color = tagColors[i] || '#7c3aed';
    const tag = state.tags.find(t => t.name === name);
    return `
      <div class="tag-chip" style="border-color: ${color}40">
        <div class="tag-dot" style="background: ${color}"></div>
        ${escapeHtml(name)}
        <button class="tag-remove" data-tag-id="${tag ? tag.id : ''}" title="Remove tag">&times;</button>
      </div>
    `;
  }).join('');

  if (tagNames.length === 0) {
    container.innerHTML = '<span style="font-size:11px; color:var(--text-muted)">No tags</span>';
  }

  container.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const tagId = parseInt(btn.dataset.tagId);
      if (tagId && state.selectedAsset) {
        await window.api.removeTagFromAsset(state.selectedAsset.id, tagId);
        selectAsset(state.selectedAsset.id);
        loadTags();
      }
    });
  });
}

function renderAssetCollections(asset) {
  const container = document.getElementById('inspector-collection-chips');
  if (state.collections.length === 0) {
    container.innerHTML = '<span style="font-size:11px; color:var(--text-muted)">No collections</span>';
    return;
  }

  container.innerHTML = state.collections.map(col => `
    <div class="tag-chip" style="cursor:pointer" data-collection-id="${col.id}">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
      ${escapeHtml(col.name)}
    </div>
  `).join('');

  container.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      const colId = parseInt(chip.dataset.collectionId);
      if (state.selectedAsset) {
        await window.api.addAssetToCollection(state.selectedAsset.id, colId);
        await loadCollections();
      }
    });
  });
}

let currentWaveform = null;

async function loadPreview(asset) {
  const previewEl = document.getElementById('inspector-preview');
  const category = asset.category || getCategoryFromExt(asset.file_ext);
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS['other'];
  const icon = CATEGORY_ICONS[category] || CATEGORY_ICONS['other'];

  previewEl.innerHTML = `<div class="preview-placeholder" style="color: ${color}">${icon}</div>`;

  const result = await window.api.getFileContent(asset.file_path);
  if (result.error || result.type === 'binary') {
    previewEl.innerHTML = `<div class="preview-placeholder" style="color: ${color}">${icon}</div>`;
    return;
  }

  if (result.type === 'image') {
    previewEl.innerHTML = `<img class="preview-image" src="${toFileUrl(asset.file_path)}" alt="${escapeHtml(asset.file_name)}">`;
  } else if (result.type === 'audio') {
    const audioId = 'audio-' + Date.now();
    currentWaveform = null;
    previewEl.innerHTML = `
      <div class="preview-audio">
        <div class="preview-waveform" id="${audioId}-waveform"><canvas id="${audioId}-canvas"></canvas><div class="waveform-playhead" id="${audioId}-playhead"></div></div>
        <audio id="${audioId}" controls src="${result.data}"></audio>
      </div>
    `;
    setTimeout(() => {
      const audioEl = document.getElementById(audioId);
      const canvasEl = document.getElementById(`${audioId}-canvas`);
      const waveformEl = document.getElementById(`${audioId}-waveform`);
      if (!audioEl || !canvasEl) return;

      currentWaveform = {
        canvas: canvasEl,
        audio: audioEl,
        playhead: document.getElementById(`${audioId}-playhead`),
        waveformData: null,
        width: 0
      };

      drawWaveform(result.data, `${audioId}-canvas`, currentWaveform);
      startWaveformTracking();

      if (waveformEl) {
        waveformEl.addEventListener('click', (e) => {
          if (!currentWaveform || !currentWaveform.audio || !currentWaveform.waveformData) return;
          const rect = waveformEl.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const ratio = x / rect.width;
          currentWaveform.audio.currentTime = ratio * currentWaveform.audio.duration;
        });
      }
    }, 100);
  } else if (result.type === 'video') {
    previewEl.innerHTML = `<video class="preview-video" controls src="${result.data}"></video>`;
  } else if (result.type === 'code') {
    previewEl.innerHTML = `<pre class="preview-code">${escapeHtml(result.data)}</pre>`;
  } else if (result.type === 'text') {
    previewEl.innerHTML = `<pre class="preview-text">${escapeHtml(result.data)}</pre>`;
  }
}

async function drawWaveform(audioDataUrl, canvasId, waveformState) {
  try {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const parentEl = canvas.parentElement;
    if (!parentEl) return;

    const width = parentEl.clientWidth || 300;
    const height = 60;
    canvas.width = width * 2;
    canvas.height = height * 2;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    let arrayBuffer;
    if (audioDataUrl.startsWith('data:')) {
      const base64 = audioDataUrl.split(',')[1];
      const binaryStr = atob(base64);
      arrayBuffer = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        arrayBuffer[i] = binaryStr.charCodeAt(i);
      }
      arrayBuffer = arrayBuffer.buffer;
    } else {
      const response = await fetch(audioDataUrl);
      arrayBuffer = await response.arrayBuffer();
    }

    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const rawData = audioBuffer.getChannelData(0);
    const samples = Math.min(width, 200);
    const blockSize = Math.floor(rawData.length / samples);
    const filteredData = [];
    for (let i = 0; i < samples; i++) {
      let sum = 0;
      const start = i * blockSize;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[start + j] || 0);
      }
      filteredData.push(sum / (blockSize || 1));
    }

    if (waveformState) {
      waveformState.waveformData = filteredData;
      waveformState.width = width;
      waveformState.height = height;
      waveformState.ctx = ctx;
    }

    drawWaveformBars(ctx, filteredData, width, height, 0);

    audioCtx.close();
  } catch (e) {
    console.log('Waveform error:', e);
  }
}

function drawWaveformBars(ctx, data, width, height, progress) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#7c3aed');
  gradient.addColorStop(1, '#6366f1');

  ctx.clearRect(0, 0, width, height);

  const step = width / data.length;
  const progressX = progress * width;

  for (let i = 0; i < data.length; i++) {
    const barHeight = Math.max(data[i] * height * 2.5, 2);
    const x = i * step;
    ctx.fillStyle = (x + step / 2) < progressX ? '#facc15' : gradient;
    ctx.fillRect(x, (height - barHeight) / 2, Math.max(step - 0.5, 1), barHeight);
  }

  if (progress > 0 && progress < 1) {
    ctx.fillStyle = '#facc15';
    ctx.fillRect(progressX - 1, 0, 2, height);
  }
}

function updateWaveformPlayhead() {
  if (!currentWaveform || !currentWaveform.audio || !currentWaveform.waveformData) return;
  const audio = currentWaveform.audio;
  if (audio.paused) return;
  if (audio.duration && audio.duration > 0) {
    const progress = audio.currentTime / audio.duration;
    drawWaveformBars(
      currentWaveform.ctx,
      currentWaveform.waveformData,
      currentWaveform.width,
      currentWaveform.height,
      progress
    );
  }
  if (!audio.paused) requestAnimationFrame(updateWaveformPlayhead);
}

function startWaveformTracking() {
  if (!currentWaveform || !currentWaveform.audio) return;
  const audio = currentWaveform.audio;
  audio.addEventListener('play', () => requestAnimationFrame(updateWaveformPlayhead));
  audio.addEventListener('pause', () => {
    if (currentWaveform && currentWaveform.audio && currentWaveform.waveformData) {
      const progress = currentWaveform.audio.duration ? currentWaveform.audio.currentTime / currentWaveform.audio.duration : 0;
      drawWaveformBars(currentWaveform.ctx, currentWaveform.waveformData, currentWaveform.width, currentWaveform.height, progress);
    }
  });
  audio.addEventListener('seeked', () => updateWaveformPlayhead());
}

function updateSidebarActive() {
  document.querySelectorAll('.sidebar-item[data-category]').forEach(item => {
    const isFav = item.dataset.category === 'favorites';
    item.classList.toggle('active',
      (isFav && state.favorites && !state.tagId) ||
      (!isFav && item.dataset.category === state.currentCategory && !state.favorites && !state.collectionId && state.libraryIds.length === 0 && !state.tagId)
    );
  });
}

function updateBreadcrumb() {
  const text = document.getElementById('breadcrumb-text');
  const parts = [];

  if (state.tagId) {
    const tag = state.tags.find(t => t.id === state.tagId);
    parts.push(tag ? tag.name : 'Tag');
  }
  if (state.collectionId) {
    const col = state.collections.find(c => c.id === state.collectionId);
    parts.push(col ? col.name : 'Collection');
  }
  if (state.libraryIds.length > 0) {
    if (state.libraryIds.length === 1) {
      const lib = state.libraries.find(l => l.id === state.libraryIds[0]);
      parts.push(lib ? lib.name : 'Source');
    } else {
      parts.push(`${state.libraryIds.length} Sources`);
    }
  }

  if (parts.length > 0) {
    text.textContent = parts.join(' + ');
  } else if (state.favorites) {
    text.textContent = 'Favorites';
  } else {
    text.textContent = CATEGORY_LABELS[state.currentCategory] || 'All Assets';
  }
}

// Modal
function showModal(title, bodyHtml, footerHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-footer').innerHTML = footerHtml;
  document.getElementById('modal-overlay').style.display = 'flex';

  document.getElementById('modal-close').onclick = hideModal;
  document.getElementById('modal-overlay').onclick = (e) => {
    if (e.target === document.getElementById('modal-overlay')) hideModal();
  };
}

function hideModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// Event listeners
function initEventListeners() {
  document.getElementById('btn-minimize').addEventListener('click', () => window.api.windowMinimize());
  document.getElementById('btn-maximize').addEventListener('click', () => window.api.windowMaximize());
  document.getElementById('btn-close').addEventListener('click', () => window.api.windowClose());

  // Context menu
  document.addEventListener('click', hideContextMenu);
  document.getElementById('ctx-rescan').addEventListener('click', async () => {
    if (contextMenuTarget) {
      await window.api.rescanLibrary(contextMenuTarget);
      await loadLibraries();
      await loadCategoryCounts();
      await loadAssets();
    }
    hideContextMenu();
  });
  document.getElementById('ctx-remove').addEventListener('click', async () => {
    if (contextMenuTarget && confirm('Remove this source and all its indexed assets?')) {
      await window.api.removeLibrary(contextMenuTarget);
      state.libraryIds = state.libraryIds.filter(id => id !== contextMenuTarget);
      await loadLibraries();
      await loadCategoryCounts();
      await loadAssets();
      updateBreadcrumb();
    }
    hideContextMenu();
  });

  document.getElementById('btn-rescan-all').addEventListener('click', async () => {
    const btn = document.getElementById('btn-rescan-all');
    btn.disabled = true;
    await window.api.rescanAll();
    btn.disabled = false;
    await loadLibraries();
    await loadCategoryCounts();
    await loadAssets();
  });

  // Sidebar categories - use event delegation
  document.getElementById('library-list').addEventListener('click', (e) => {
    const item = e.target.closest('.sidebar-item');
    if (!item) return;
    const cat = item.dataset.category;
    if (cat === 'favorites') {
      state.favorites = true;
      state.currentCategory = 'all';
    } else {
      state.currentCategory = cat;
      state.favorites = false;
    }
    state.collectionId = null;
    state.tagId = null;
    state.libraryIds = [];
    updateSidebarActive();
    loadAssets();
    updateBreadcrumb();
  });

  document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = e.target.value;
      loadAssets();
    }, 200);
  });

  document.getElementById('sort-select').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    loadAssets();
  });

  document.getElementById('btn-grid-view').addEventListener('click', () => {
    state.viewMode = 'grid';
    document.getElementById('asset-grid').classList.remove('list-view');
    document.getElementById('btn-grid-view').classList.add('active');
    document.getElementById('btn-list-view').classList.remove('active');
  });

  document.getElementById('btn-list-view').addEventListener('click', () => {
    state.viewMode = 'list';
    document.getElementById('asset-grid').classList.add('list-view');
    document.getElementById('btn-list-view').classList.add('active');
    document.getElementById('btn-grid-view').classList.remove('active');
  });

  document.getElementById('btn-add-library').addEventListener('click', showAddLibraryModal);
  document.getElementById('btn-empty-add-library').addEventListener('click', showAddLibraryModal);

  document.getElementById('btn-add-collection').addEventListener('click', () => {
    showModal('Add Collection', `
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="modal-collection-name" placeholder="Collection name">
      </div>
      <div class="form-group">
        <label>Description</label>
        <input type="text" id="modal-collection-desc" placeholder="Optional description">
      </div>
    `, `
      <button class="btn btn-secondary" id="modal-cancel-collection">Cancel</button>
      <button class="btn btn-primary" id="modal-confirm-add-collection">Add</button>
    `);
    setTimeout(() => {
      document.getElementById('modal-cancel-collection')?.addEventListener('click', hideModal);
      document.getElementById('modal-confirm-add-collection')?.addEventListener('click', async () => {
        const name = document.getElementById('modal-collection-name').value.trim();
        const desc = document.getElementById('modal-collection-desc').value.trim();
        if (name) { await window.api.addCollection(name, desc); await loadCollections(); hideModal(); }
      });
      document.getElementById('modal-collection-name')?.focus();
    }, 50);
  });

  document.getElementById('btn-add-tag').addEventListener('click', () => {
    showModal('Add Tag', `
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="modal-tag-name" placeholder="Tag name">
      </div>
      <div class="form-group">
        <label>Color</label>
        <input type="color" id="modal-tag-color" value="#7c3aed">
      </div>
    `, `
      <button class="btn btn-secondary" id="modal-cancel-tag">Cancel</button>
      <button class="btn btn-primary" id="modal-confirm-add-tag">Add</button>
    `);
    setTimeout(() => {
      document.getElementById('modal-cancel-tag')?.addEventListener('click', hideModal);
      document.getElementById('modal-confirm-add-tag')?.addEventListener('click', async () => {
        const name = document.getElementById('modal-tag-name').value.trim();
        const color = document.getElementById('modal-tag-color').value;
        if (name) { await window.api.addTag(name, color); await loadTags(); hideModal(); }
      });
      document.getElementById('modal-tag-name')?.focus();
    }, 50);
  });

  document.getElementById('btn-add-tag-to-asset').addEventListener('click', async () => {
    if (!state.selectedAsset) return;
    const assetTags = state.selectedAsset.tags ? state.selectedAsset.tags.split(',') : [];

    showModal('Add Tag to Asset', `
      <div class="form-group">
        <label>Select Tag</label>
        <select id="modal-select-tag" style="width:100%; padding:8px 12px; background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-primary); border-radius:var(--radius-sm); font-size:13px; font-family:inherit;">
          ${state.tags.filter(t => !assetTags.includes(t.name)).map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}
        </select>
      </div>
      <div style="border-top:1px solid var(--border-color); padding-top:12px; margin-top:4px;">
        <label style="font-size:11px; color:var(--text-muted); margin-bottom:6px; display:block;">Or create new tag</label>
        <div style="display:flex; gap:6px;">
          <input type="text" id="modal-new-tag-name" placeholder="New tag name" style="flex:1; padding:6px 10px; background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-primary); border-radius:var(--radius-sm); font-size:12px; font-family:inherit;">
          <input type="color" id="modal-new-tag-color" value="#7c3aed" style="width:32px; height:28px; padding:1px; border:1px solid var(--border-color); border-radius:var(--radius-sm); cursor:pointer;">
          <button class="btn btn-primary" id="modal-create-and-add-tag" style="padding:6px 12px; font-size:11px;">Create</button>
        </div>
      </div>
    `, `
      <button class="btn btn-secondary" id="modal-cancel-tag-asset">Cancel</button>
      <button class="btn btn-primary" id="modal-confirm-add-tag-to-asset">Add</button>
    `);
    setTimeout(() => {
      document.getElementById('modal-cancel-tag-asset')?.addEventListener('click', hideModal);
      document.getElementById('modal-confirm-add-tag-to-asset')?.addEventListener('click', async () => {
        const sel = document.getElementById('modal-select-tag');
        const tagId = sel ? parseInt(sel.value) : 0;
        if (tagId) {
          await window.api.addTagToAsset(state.selectedAsset.id, tagId);
          await selectAsset(state.selectedAsset.id);
          await loadTags();
          hideModal();
        }
      });
      document.getElementById('modal-create-and-add-tag')?.addEventListener('click', async () => {
        const name = document.getElementById('modal-new-tag-name')?.value.trim();
        const color = document.getElementById('modal-new-tag-color')?.value;
        if (name) {
          const result = await window.api.addTag(name, color);
          if (result && result.id) {
            await window.api.addTagToAsset(state.selectedAsset.id, result.id);
            await selectAsset(state.selectedAsset.id);
            await loadTags();
            hideModal();
          }
        }
      });
    }, 50);
  });

  document.getElementById('btn-add-to-collection').addEventListener('click', async () => {
    if (!state.selectedAsset) return;

    showModal('Add to Collection', `
      <div class="form-group">
        <label>Select Collection</label>
        <select id="modal-select-collection" style="width:100%; padding:8px 12px; background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-primary); border-radius:var(--radius-sm); font-size:13px; font-family:inherit;">
          ${state.collections.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div style="border-top:1px solid var(--border-color); padding-top:12px; margin-top:4px;">
        <label style="font-size:11px; color:var(--text-muted); margin-bottom:6px; display:block;">Or create new collection</label>
        <div style="display:flex; gap:6px;">
          <input type="text" id="modal-new-col-name" placeholder="New collection name" style="flex:1; padding:6px 10px; background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-primary); border-radius:var(--radius-sm); font-size:12px; font-family:inherit;">
          <button class="btn btn-primary" id="modal-create-and-add-col" style="padding:6px 12px; font-size:11px;">Create</button>
        </div>
      </div>
    `, `
      <button class="btn btn-secondary" id="modal-cancel-col-asset">Cancel</button>
      <button class="btn btn-primary" id="modal-confirm-add-col-to-asset">Add</button>
    `);
    setTimeout(() => {
      document.getElementById('modal-cancel-col-asset')?.addEventListener('click', hideModal);
      document.getElementById('modal-confirm-add-col-to-asset')?.addEventListener('click', async () => {
        const sel = document.getElementById('modal-select-collection');
        const colId = sel ? parseInt(sel.value) : 0;
        if (colId) {
          await window.api.addAssetToCollection(state.selectedAsset.id, colId);
          await loadCollections();
          hideModal();
        }
      });
      document.getElementById('modal-create-and-add-col')?.addEventListener('click', async () => {
        const name = document.getElementById('modal-new-col-name')?.value.trim();
        if (name) {
          const result = await window.api.addCollection(name);
          if (result && result.id) {
            await window.api.addAssetToCollection(state.selectedAsset.id, result.id);
            await loadCollections();
            hideModal();
          }
        }
      });
    }, 50);
  });

  document.getElementById('inspector-fav-btn').addEventListener('click', async () => {
    if (!state.selectedAsset) return;
    await window.api.toggleFavorite(state.selectedAsset.id);
    await selectAsset(state.selectedAsset.id);
    await loadAssets();
    await loadCategoryCounts();
  });

  document.getElementById('btn-open-external').addEventListener('click', () => {
    if (state.selectedAsset) window.api.openExternal(state.selectedAsset.file_path);
  });

  // Real-time updates
  window.api.onAssetAdded(() => { loadAssets(); loadCategoryCounts(); loadLibraries(); });
  window.api.onAssetUpdated(() => loadAssets());
  window.api.onAssetRemoved(() => {
    loadAssets();
    loadCategoryCounts();
    loadLibraries();
    if (state.selectedAsset) {
      document.getElementById('inspector-empty').style.display = 'flex';
      document.getElementById('inspector-content').style.display = 'none';
      state.selectedAsset = null;
    }
  });
}

async function showAddLibraryModal() {
  let selectedPath = '';

  showModal('Add Library Folder', `
    <div class="form-group">
      <label>Folder Path</label>
      <div style="display:flex; gap:8px;">
        <input type="text" id="modal-lib-path" placeholder="Select a folder..." readonly style="flex:1; cursor:pointer; padding:8px 12px; background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-primary); border-radius:var(--radius-sm); font-size:12px; font-family:inherit;">
        <button class="btn btn-secondary" id="modal-browse-folder" style="white-space:nowrap; padding:8px 14px;">Browse...</button>
      </div>
    </div>
    <div class="form-group">
      <label>Ignore Regex <span style="color:var(--text-muted); font-weight:400;">(optional, exclude files/folders)</span></label>
      <input type="text" id="modal-lib-ignore" placeholder="e.g. node_modules|\\.tmp$" style="width:100%; padding:8px 12px; background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-primary); border-radius:var(--radius-sm); font-size:12px; font-family:inherit;">
    </div>
  `, `
    <button class="btn btn-secondary" id="modal-cancel-lib">Cancel</button>
    <button class="btn btn-primary" id="modal-confirm-add-lib">Add Library</button>
  `);

  setTimeout(() => {
    document.getElementById('modal-cancel-lib')?.addEventListener('click', hideModal);
    document.getElementById('modal-browse-folder')?.addEventListener('click', async () => {
      const folder = await window.api.browseFolder();
      if (folder) {
        selectedPath = folder;
        document.getElementById('modal-lib-path').value = folder;
      }
    });
    document.getElementById('modal-confirm-add-lib')?.addEventListener('click', async () => {
      const ignoreRegex = document.getElementById('modal-lib-ignore')?.value || '';
      if (selectedPath) {
        const result = await window.api.addLibrary(selectedPath, ignoreRegex);
        if (result && result.error) { alert(result.error); return; }
        await loadLibraries();
        await loadCategoryCounts();
        await loadAssets();
        updateBreadcrumb();
        hideModal();
      }
    });
  }, 50);
}

document.addEventListener('DOMContentLoaded', async () => {
  initEventListeners();
  await loadLibraries();
  await loadTags();
  await loadCollections();
  await loadCategoryCounts();
  await loadAssets();
  updateSidebarActive();
  updateBreadcrumb();
});
