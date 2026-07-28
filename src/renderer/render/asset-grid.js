import { state } from '../state.js';
import { escapeHtml, toFileUrl, getCategoryFromExt } from '../utils.js';
import { CATEGORY_ICONS, CATEGORY_COLORS, CATEGORY_LABELS } from '../constants.js';

export function renderAssets() {
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
    card.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('select-asset', { detail: { assetId: parseInt(card.dataset.id) } }));
    });
  });
}
