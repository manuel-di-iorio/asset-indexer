import { state } from '../state.js';
import { escapeHtml, getCategoryFromExt } from '../utils.js';
import { CATEGORY_ICONS, CATEGORY_COLORS, CATEGORY_LABELS } from '../constants.js';
import { selectSingle, toggleSelect, rangeSelect } from '../selection.js';
import { showAssetContextMenu } from '../context-menu.js';
import { loadMoreAssets } from '../api.js';

let thumbObserver = null;
let thumbnailCache = {};
let currentRenderId = 0;
let thumbScrollHandler = null;
let renderedCount = 0;

function placeholderHTML(color, icon) {
  return `<div class="thumb-placeholder" style="color: ${color}">${icon}</div>`;
}

function starSVG() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
}

function createCardHTML(asset) {
  const category = asset.category || getCategoryFromExt(asset.file_ext);
  const icon = CATEGORY_ICONS[category] || CATEGORY_ICONS['other'];
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS['other'];
  const isFav = asset.is_favorite;
  const isImage = category === 'images';
  const cached = thumbnailCache[asset.file_path];

  const thumbContent = isImage && cached
    ? `<img class="card-thumb-img" src="${cached}" alt="" loading="lazy">`
    : placeholderHTML(color, icon);

  const thumbAttr = isImage && !cached
    ? ` data-thumb-path="${escapeHtml(asset.file_path)}"`
    : '';

  const favBadge = isFav ? `<div class="fav-badge">${starSVG()}</div>` : '';

  return `
    <div class="asset-card" data-id="${asset.id}" data-path="${escapeHtml(asset.file_path)}">
      <div class="card-thumbnail"${thumbAttr}>
        ${thumbContent}
        ${favBadge}
      </div>
      <div class="card-info">
        <div class="card-name">${escapeHtml(asset.file_name)}</div>
        <div class="card-type"><span>${CATEGORY_LABELS[category] || category}</span></div>
      </div>
    </div>
  `;
}

function loadThumbnailsForVisible() {
  const grid = document.getElementById('asset-grid');
  if (!grid) return;
  const thumbContainers = grid.querySelectorAll('.card-thumbnail[data-thumb-path]');
  if (thumbContainers.length === 0) return;

  const paths = [];
  const containerMap = [];
  thumbContainers.forEach(container => {
    const rect = container.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight + 300 && rect.bottom > -300;
    if (!isVisible) return;
    const path = container.dataset.thumbPath;
    if (thumbnailCache[path]) {
      container.innerHTML = `<img class="card-thumb-img" src="${thumbnailCache[path]}" alt="" loading="lazy">`;
      container.removeAttribute('data-thumb-path');
    } else {
      paths.push(path);
      containerMap.push(container);
    }
  });

  if (paths.length === 0) return;

  window.api.getThumbnailsBatch(paths).then(results => {
    Object.assign(thumbnailCache, results);
    containerMap.forEach((container, i) => {
      const thumb = results[paths[i]];
      if (thumb) {
        container.innerHTML = `<img class="card-thumb-img" src="${thumb}" alt="" loading="lazy">`;
        container.removeAttribute('data-thumb-path');
      }
    });
  });
}

function setupThumbnailObserver() {
  if (thumbObserver) thumbObserver.disconnect();
  const grid = document.getElementById('asset-grid');
  if (!grid) return;
  if (thumbScrollHandler) grid.removeEventListener('scroll', thumbScrollHandler);
  thumbObserver = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting)) loadThumbnailsForVisible();
  }, { root: grid, rootMargin: '300px' });
  grid.querySelectorAll('.card-thumbnail[data-thumb-path]').forEach(el => {
    thumbObserver.observe(el);
  });
  thumbScrollHandler = () => {
    loadThumbnailsForVisible();
    maybeLoadMore();
  };
  grid.addEventListener('scroll', thumbScrollHandler, { passive: true });
}

function maybeLoadMore() {
  const grid = document.getElementById('asset-grid');
  if (!grid || state.isLoading || !state.hasMore) return;
  if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 800) {
    loadMoreAssets().then(() => {
      appendMoreAssets();
      maybeLoadMore();
    });
  }
}

function buildCard(asset, renderId) {
  const temp = document.createElement('div');
  temp.innerHTML = createCardHTML(asset);
  const el = temp.firstElementChild;
  if (state.selectedAssetIds.includes(asset.id)) el.classList.add('selected');
  if (asset.id === state.focusedAssetId) el.classList.add('focused');
  el.addEventListener('click', (e) => {
    if (currentRenderId !== renderId) return;
    if (e.shiftKey) {
      rangeSelect(asset.id);
    } else if (e.ctrlKey || e.metaKey) {
      toggleSelect(asset.id);
    } else {
      selectSingle(asset.id);
    }
  });
  el.addEventListener('contextmenu', (e) => {
    if (currentRenderId !== renderId) return;
    e.preventDefault();
    e.stopPropagation();
    if (!state.selectedAssetIds.includes(asset.id)) {
      selectSingle(asset.id);
    }
    showAssetContextMenu(e.clientX, e.clientY);
  });
  return el;
}

function appendCards(renderId) {
  const grid = document.getElementById('asset-grid');
  const frag = document.createDocumentFragment();
  const slice = state.assets.slice(renderedCount);
  slice.forEach(asset => frag.appendChild(buildCard(asset, renderId)));
  renderedCount = state.assets.length;
  grid.appendChild(frag);
}

export function renderAssets() {
  const renderId = ++currentRenderId;
  const grid = document.getElementById('asset-grid');
  const emptyState = document.getElementById('empty-state');

  if (state.assets.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'flex';
    renderedCount = 0;
    return;
  }

  emptyState.style.display = 'none';
  grid.innerHTML = '';
  renderedCount = 0;
  appendCards(renderId);
  grid.classList.toggle('list-view', state.viewMode === 'list');

  loadThumbnailsForVisible();
  setupThumbnailObserver();
  maybeLoadMore();
}

export function appendMoreAssets() {
  const grid = document.getElementById('asset-grid');
  if (!grid || renderedCount >= state.assets.length) return;
  const renderId = currentRenderId;
  appendCards(renderId);
  loadThumbnailsForVisible();
  setupThumbnailObserver();
}
