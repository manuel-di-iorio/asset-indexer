import { state } from '../state.js';
import { escapeHtml, toFileUrl, getCategoryFromExt, formatFileSize, formatDate } from '../utils.js';
import { CATEGORY_COLORS, CATEGORY_ICONS, CATEGORY_LABELS } from '../constants.js';
import { loadPreview } from './preview/index.js';

let inspectorTagChipContainer = null;
let inspectorCollectionChipContainer = null;

function detailRow(label, value, cls = '') {
  return `
    <div class="detail-row">
      <span class="detail-label">${label}</span>
      <span class="detail-value ${cls}">${escapeHtml(value || '-')}</span>
    </div>
  `;
}

function gcd(a, b) {
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

function ratioString(w, h) {
  const g = gcd(w, h);
  const rw = w / g;
  const rh = h / g;
  if (rw > 21 || rh > 21) return null;
  return `${rw}:${rh}`;
}

function textureResolution(maxDim) {
  if (maxDim >= 8192) return '8K';
  if (maxDim >= 4096) return '4K';
  if (maxDim >= 2048) return '2K';
  if (maxDim >= 1024) return '1K';
  if (maxDim >= 512) return '512';
  if (maxDim >= 256) return '256';
  return null;
}

export async function selectAsset(assetId) {
  flushUsageSave();
  const licInput = usageLicenseInput();
  const notesInput = usageNotesInput();
  if (licInput) licInput.value = '';
  if (notesInput) notesInput.value = '';
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
  renderUsage(asset);
  const previewResult = await loadPreview(asset);
  if (previewResult?.width && previewResult?.height) {
    renderImageDimensions(previewResult.width, previewResult.height);
  }
}

export function clearInspector() {
  flushUsageSave();
  state.selectedAsset = null;
  document.getElementById('inspector-empty').style.display = 'flex';
  document.getElementById('inspector-content').style.display = 'none';
}

export function showMultiSelection(count) {
  flushUsageSave();
  state.selectedAsset = null;
  document.getElementById('inspector-empty').style.display = 'none';
  document.getElementById('inspector-content').style.display = 'flex';
  document.getElementById('inspector-title').textContent = `${count} items selected`;

  document.getElementById('inspector-preview').innerHTML = `
    <div class="preview-placeholder" style="background: var(--accent-subtle);">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1" opacity="0.5">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
      </svg>
    </div>`;

  document.getElementById('inspector-details').innerHTML = `
    <div class="detail-row">
      <span class="detail-value" style="color: var(--text-secondary);">${count} assets selected. Actions below will apply to all selected items.</span>
    </div>`;

  document.getElementById('inspector-tag-chips').innerHTML = '';
  document.getElementById('inspector-collection-chips').innerHTML = '';

  showUsageEmpty(count);

  const favBtn = document.getElementById('inspector-fav-btn');
  const selectedIdSet = new Set(state.selectedAssetIds);
  const selected = state.assets.filter(a => selectedIdSet.has(a.id));
  favBtn.classList.toggle('active', selected.length > 0 && selected.every(a => a.is_favorite));
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

  if (category === 'images') {
    if (asset.width && asset.height) {
      const ratio = ratioString(asset.width, asset.height);
      details += detailRow('Dimensions', `${asset.width}×${asset.height}px${ratio ? ` (${ratio})` : ''}`);
      const res = textureResolution(Math.max(asset.width, asset.height));
      if (res) details += detailRow('Resolution', res);
    }
    if (asset.bit_depth) details += detailRow('Bit Depth', `${asset.bit_depth}-bit`);
    if (asset.has_alpha !== null && asset.has_alpha !== undefined) {
      details += detailRow('Alpha Channel', asset.has_alpha ? 'Yes' : 'No');
    }
  }

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
  if (container.innerHTML.includes('Dimensions')) return;
  const ratio = ratioString(width, height);
  container.innerHTML += detailRow('Dimensions', `${width}×${height}px${ratio ? ` (${ratio})` : ''}`);
}

const usageLicenseInput = () => document.getElementById('usage-license-input');
const usageNotesInput = () => document.getElementById('usage-notes-input');
const usageMultiHint = () => document.getElementById('usage-multi-hint');

let usageSaveTimer = null;
let usagePending = null;

function scheduleUsageSave() {
  const ids = state.selectedAssetIds.length ? state.selectedAssetIds : (state.selectedAsset ? [state.selectedAsset.id] : []);
  if (ids.length === 0) return;
  const licInput = usageLicenseInput();
  const notesInput = usageNotesInput();
  usagePending = {
    ids: [...ids],
    license: licInput ? licInput.value.trim() : '',
    notes: notesInput ? notesInput.value : ''
  };
  clearTimeout(usageSaveTimer);
  usageSaveTimer = setTimeout(flushUsageSave, 600);
}

function flushUsageSave() {
  if (usageSaveTimer) { clearTimeout(usageSaveTimer); usageSaveTimer = null; }
  if (!usagePending) return;
  const pending = usagePending;
  usagePending = null;
  if (pending.ids.length === 1) {
    window.api.updateAssetMetadata(pending.ids[0], { license: pending.license, notes: pending.notes });
    const cur = state.selectedAsset;
    if (cur && cur.id === pending.ids[0]) { cur.license = pending.license; cur.notes = pending.notes; }
  } else if (pending.ids.length > 1) {
    window.api.updateAssetsMetadata(pending.ids, { license: pending.license, notes: pending.notes });
  }
}

function renderUsage(asset) {
  document.getElementById('inspector-usage').style.display = 'block';
  const hint = usageMultiHint();
  if (hint) hint.style.display = 'none';
  const licInput = usageLicenseInput();
  const notesInput = usageNotesInput();
  if (licInput) licInput.value = asset.license || '';
  if (notesInput) notesInput.value = asset.notes || '';
}

function showUsageEmpty(count) {
  document.getElementById('inspector-usage').style.display = 'block';
  const hint = usageMultiHint();
  if (hint) {
    hint.textContent = `License/notes will be applied to all ${count} selected assets.`;
    hint.style.display = 'block';
  }
  const licInput = usageLicenseInput();
  const notesInput = usageNotesInput();
  if (licInput) licInput.value = '';
  if (notesInput) notesInput.value = '';
}

const licenseInputEl = usageLicenseInput();
const notesInputEl = usageNotesInput();
if (licenseInputEl) {
  licenseInputEl.addEventListener('input', scheduleUsageSave);
  licenseInputEl.addEventListener('blur', flushUsageSave);
}
if (notesInputEl) {
  notesInputEl.addEventListener('input', scheduleUsageSave);
  notesInputEl.addEventListener('blur', flushUsageSave);
}

let tagChipDelegationSetup = false;
let colChipDelegationSetup = false;

function setupTagChipDelegation() {
  if (tagChipDelegationSetup) return;
  tagChipDelegationSetup = true;
  const container = document.getElementById('inspector-tag-chips');
  if (!container) return;
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('.tag-remove');
    if (!btn) return;
    e.stopPropagation();
    const tagId = parseInt(btn.dataset.tagId);
    if (tagId && state.selectedAsset) {
      await window.api.removeTagFromAsset(state.selectedAsset.id, tagId);
      await selectAsset(state.selectedAsset.id);
      document.dispatchEvent(new CustomEvent('sidebar-refresh'));
    }
  });
}

function setupCollectionChipDelegation() {
  if (colChipDelegationSetup) return;
  colChipDelegationSetup = true;
  const container = document.getElementById('inspector-collection-chips');
  if (!container) return;
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('.tag-remove');
    if (!btn) return;
    e.stopPropagation();
    const colId = parseInt(btn.dataset.collectionId);
    if (colId && state.selectedAsset) {
      await window.api.removeAssetFromCollection(state.selectedAsset.id, colId);
      await selectAsset(state.selectedAsset.id);
      document.dispatchEvent(new CustomEvent('sidebar-refresh'));
    }
  });
}

export function renderAssetTags(asset) {
  const container = document.getElementById('inspector-tag-chips');
  setupTagChipDelegation();

  const tagNames = asset.tags ? asset.tags.split(',') : [];
  const tagColors = asset.tag_colors ? asset.tag_colors.split(',') : [];

  const tagMap = new Map(state.tags.map(t => [t.name, t]));

  container.innerHTML = tagNames.map((name, i) => {
    const color = tagColors[i] || '#7c3aed';
    const tag = tagMap.get(name);
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
}

export function renderAssetCollections(asset) {
  const container = document.getElementById('inspector-collection-chips');
  setupCollectionChipDelegation();

  const collectionNames = asset.collections ? asset.collections.split(',') : [];

  const colMap = new Map(state.collections.map(c => [c.name, c]));

  container.innerHTML = collectionNames.map(name => {
    const col = colMap.get(name);
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
}
