import { state } from '../state.js';
import { escapeHtml, toFileUrl, getCategoryFromExt, formatFileSize, formatDate } from '../utils.js';
import { CATEGORY_COLORS, CATEGORY_ICONS, CATEGORY_LABELS } from '../constants.js';
import { loadPreview } from './preview/index.js';

function detailRow(label, value, cls = '') {
  return `
    <div class="detail-row">
      <span class="detail-label">${label}</span>
      <span class="detail-value ${cls}">${escapeHtml(value || '-')}</span>
    </div>
  `;
}

export async function selectAsset(assetId) {
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
  const previewResult = await loadPreview(asset);
  if (previewResult?.width && previewResult?.height) {
    renderImageDimensions(previewResult.width, previewResult.height);
  }

  document.querySelectorAll('.asset-card').forEach(card => {
    card.classList.toggle('selected', parseInt(card.dataset.id) === assetId);
  });
}

export function renderAssetDetails(asset) {
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

function renderImageDimensions(width, height) {
  const container = document.getElementById('inspector-details');
  container.innerHTML += detailRow('Dimensions', `${width}×${height}px`);
}

export function renderAssetTags(asset) {
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
        await selectAsset(state.selectedAsset.id);
        document.dispatchEvent(new CustomEvent('sidebar-refresh'));
      }
    });
  });
}

export function renderAssetCollections(asset) {
  const container = document.getElementById('inspector-collection-chips');
  const collectionNames = asset.collections ? asset.collections.split(',') : [];

  container.innerHTML = collectionNames.map(name => {
    const col = state.collections.find(c => c.name === name);
    return `
      <div class="tag-chip" style="border-color: var(--accent)40">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
        ${escapeHtml(name)}
        <button class="tag-remove" data-collection-id="${col ? col.id : ''}" title="Remove from collection">&times;</button>
      </div>
    `;
  }).join('');

  if (collectionNames.length === 0) {
    container.innerHTML = '<span style="font-size:11px; color:var(--text-muted)">No collections</span>';
  }

  container.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const colId = parseInt(btn.dataset.collectionId);
      if (colId && state.selectedAsset) {
        await window.api.removeAssetFromCollection(state.selectedAsset.id, colId);
        await selectAsset(state.selectedAsset.id);
        document.dispatchEvent(new CustomEvent('sidebar-refresh'));
      }
    });
  });
}
