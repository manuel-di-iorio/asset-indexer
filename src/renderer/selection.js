import { state } from './state.js';
import { selectAsset, clearInspector, showMultiSelection } from './render/inspector.js';

let selectionToken = 0;
let anchorId = null;

export function getSelectedIds() {
  return state.selectedAssetIds;
}

export function updateSelectionUI() {
  const n = state.selectedAssetIds.length;

  const status = document.getElementById('status-selected');
  if (status) status.textContent = `${n} selected`;

  const bulkBar = document.getElementById('bulk-bar');
  if (bulkBar) bulkBar.style.display = n > 1 ? 'flex' : 'none';
  const bulkCount = document.getElementById('bulk-count');
  if (bulkCount) bulkCount.textContent = `${n} selected`;

  const removeTagBtn = document.getElementById('bulk-btn-remove-tag');
  if (removeTagBtn) {
    const hasTags = state.assets.some(a => state.selectedAssetIds.includes(a.id) && a.tags);
    removeTagBtn.style.display = hasTags ? '' : 'none';
  }

  const removeColBtn = document.getElementById('bulk-btn-remove-collection');
  if (removeColBtn) {
    const hasCollections = state.assets.some(a => state.selectedAssetIds.includes(a.id) && a.collections);
    removeColBtn.style.display = hasCollections ? '' : 'none';
  }

  const openBtn = document.getElementById('btn-open-external');
  if (openBtn) openBtn.disabled = n > 1;

  const grid = document.getElementById('asset-grid');
  if (grid) {
    grid.classList.toggle('has-bulk', n > 1);
    grid.querySelectorAll('.asset-card').forEach(card => {
      const id = parseInt(card.dataset.id);
      card.classList.toggle('selected', state.selectedAssetIds.includes(id));
      card.classList.toggle('focused', id === state.focusedAssetId);
    });
  }
}

export async function syncSelection() {
  const token = ++selectionToken;
  const ids = state.selectedAssetIds;

  if (ids.length === 0) {
    state.focusedAssetId = null;
    clearInspector();
  } else if (ids.length === 1) {
    state.focusedAssetId = ids[0];
    await selectAsset(ids[0]);
    if (token !== selectionToken) return;
  } else {
    if (state.focusedAssetId === null) state.focusedAssetId = ids[0];
    showMultiSelection(ids.length);
  }
  updateSelectionUI();
}

export async function selectSingle(id) {
  state.selectedAssetIds = [id];
  state.focusedAssetId = id;
  anchorId = id;
  await syncSelection();
}

export async function toggleSelect(id) {
  const wasSelected = state.selectedAssetIds.includes(id);
  if (wasSelected) {
    state.selectedAssetIds.splice(state.selectedAssetIds.indexOf(id), 1);
    if (id === state.focusedAssetId) {
      state.focusedAssetId = state.selectedAssetIds.length
        ? state.selectedAssetIds[state.selectedAssetIds.length - 1]
        : null;
    }
  } else {
    state.selectedAssetIds.push(id);
    state.focusedAssetId = id;
    if (anchorId === null) anchorId = id;
  }
  if (anchorId !== null && !state.selectedAssetIds.includes(anchorId)) {
    anchorId = state.selectedAssetIds.length ? state.selectedAssetIds[0] : null;
  }
  await syncSelection();
}

export async function rangeSelect(id) {
  const list = state.assets.map(a => a.id);
  const end = list.indexOf(id);
  if (end < 0) { await selectSingle(id); return; }

  let anchor = anchorId;
  if (anchor === null || !list.includes(anchor)) {
    anchor = state.focusedAssetId !== null && list.includes(state.focusedAssetId)
      ? state.focusedAssetId
      : (state.selectedAssetIds.length ? state.selectedAssetIds[state.selectedAssetIds.length - 1] : null);
  }
  if (anchor === null) { await selectSingle(id); return; }

  const anchorIdx = list.indexOf(anchor);
  const from = Math.min(anchorIdx, end);
  const to = Math.max(anchorIdx, end);
  state.selectedAssetIds = list.slice(from, to + 1);
  state.focusedAssetId = id;
  await syncSelection();
}

export function selectAll() {
  if (state.assets.length === 0) return;
  state.selectedAssetIds = state.assets.map(a => a.id);
  state.focusedAssetId = state.assets[state.assets.length - 1].id;
  anchorId = state.assets[0].id;
  syncSelection();
}

export function selectFirst() {
  if (state.assets.length === 0) return;
  state.selectedAssetIds = [state.assets[0].id];
  state.focusedAssetId = state.assets[0].id;
  anchorId = state.assets[0].id;
  syncSelection();
}

export function selectLast() {
  if (state.assets.length === 0) return;
  const id = state.assets[state.assets.length - 1].id;
  state.selectedAssetIds = [id];
  state.focusedAssetId = id;
  anchorId = id;
  syncSelection();
}

export function clearSelection() {
  state.selectedAssetIds = [];
  state.focusedAssetId = null;
  anchorId = null;
  syncSelection();
}

export function moveSelection(dx, dy, extend = false) {
  const list = state.assets;
  if (list.length === 0) return;
  const ids = list.map(a => a.id);

  let idx = state.focusedAssetId !== null && ids.includes(state.focusedAssetId)
    ? ids.indexOf(state.focusedAssetId)
    : (state.selectedAssetIds.length ? ids.indexOf(state.selectedAssetIds[state.selectedAssetIds.length - 1]) : -1);

  if (idx < 0) {
    if (extend) rangeSelect(ids[0]);
    else selectSingle(ids[0]);
    return;
  }

  const grid = document.getElementById('asset-grid');
  const isList = grid ? grid.classList.contains('list-view') : false;
  const startIdx = idx;

  if (isList) {
    if (dx !== 0) return;
    idx += dy;
  } else {
    const cols = getGridColumns(grid);
    if (dx !== 0) idx += dx;
    if (dy !== 0) idx += dy * cols;
  }

  idx = Math.max(0, Math.min(ids.length - 1, idx));
  if (idx === startIdx && !extend) return;

  const targetId = ids[idx];

  if (extend) rangeSelect(targetId);
  else selectSingle(targetId);

  const card = grid ? grid.querySelector(`.asset-card[data-id="${targetId}"]`) : null;
  if (card) card.scrollIntoView({ block: 'nearest' });
}

function getGridColumns(grid) {
  if (!grid) return 1;
  const cards = grid.querySelectorAll('.asset-card');
  if (cards.length < 2) return 1;
  const firstTop = cards[0].offsetTop;
  let cols = 1;
  while (cols < cards.length && cards[cols].offsetTop === firstTop) cols++;
  return cols;
}

export function removeSelectedId(removedId) {
  const idx = state.selectedAssetIds.indexOf(removedId);
  if (idx < 0) return false;
  state.selectedAssetIds.splice(idx, 1);
  if (state.focusedAssetId === removedId) {
    state.focusedAssetId = state.selectedAssetIds.length
      ? state.selectedAssetIds[Math.min(idx, state.selectedAssetIds.length - 1)]
      : null;
  }
  if (anchorId === removedId) {
    anchorId = state.selectedAssetIds.length ? state.selectedAssetIds[0] : null;
  }
  if (state.selectedAsset && state.selectedAsset.id === removedId) state.selectedAsset = null;
  syncSelection();
  return true;
}
