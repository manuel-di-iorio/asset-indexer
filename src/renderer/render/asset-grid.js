import { state } from '../state.js';
import { escapeHtml, getCategoryFromExt } from '../utils.js';
import { CATEGORY_ICONS, CATEGORY_COLORS, CATEGORY_LABELS } from '../constants.js';

let thumbObserver = null;
let thumbnailCache = {};
let currentRenderId = 0;

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
  thumbObserver = new IntersectionObserver(() => {
    loadThumbnailsForVisible();
  }, { rootMargin: '300px' });
  thumbObserver.observe(grid);
}

export function renderAssets() {
  const renderId = ++currentRenderId;
  const grid = document.getElementById('asset-grid');
  const emptyState = document.getElementById('empty-state');

  if (state.assets.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';
  const selId = state.selectedAsset ? state.selectedAsset.id : null;
  const frag = document.createDocumentFragment();
  const temp = document.createElement('div');

  state.assets.forEach(asset => {
    temp.innerHTML = createCardHTML(asset);
    const el = temp.firstElementChild;
    if (asset.id === selId) el.classList.add('selected');
    el.addEventListener('click', () => {
      if (currentRenderId !== renderId) return;
      document.dispatchEvent(new CustomEvent('select-asset', { detail: { assetId: asset.id } }));
      grid.querySelectorAll('.asset-card.selected').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
    });
    frag.appendChild(el);
  });

  grid.innerHTML = '';
  grid.appendChild(frag);
  grid.classList.toggle('list-view', state.viewMode === 'list');

  loadThumbnailsForVisible();
  setupThumbnailObserver();
}
