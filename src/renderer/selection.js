import { state } from './state.js';
import { selectAsset, clearInspector, showMultiSelection } from './render/inspector.js';

let selectionToken = 0;
let anchorId = null;
let prevSelectedSet = new Set();
let prevFocusedId = null;

const cardElementMap = new Map();
let cachedGridCols = 1;
let lastGridWidth = 0;
let idIndexMap = new Map();

export function rebuildIdIndexMap() {
  idIndexMap.clear();
  state.assets.forEach((a, i) => idIndexMap.set(a.id, i));
}

export function registerCardElement(id, el) {
  cardElementMap.set(id, el);
}

export function unregisterCardElement(id) {
  cardElementMap.delete(id);
}

export function clearCardElementMap() {
  cardElementMap.clear();
}

export function getSelectedIds() {
  return state.selectedAssetIds;
}

export function updateSelectionUI() {
  const n = state.selectedAssetIds.length;
  const selectedSet = new Set(state.selectedAssetIds);

  const status = document.getElementById('status-selected');
  if (status) status.textContent = `${n} selected`;

  const bulkBar = document.getElementById('bulk-bar');
  if (bulkBar) bulkBar.style.display = n >= 1 ? 'flex' : 'none';
  const bulkCount = document.getElementById('bulk-count');
  if (bulkCount) bulkCount.textContent = `${n} selected`;

  const renameBtn = document.getElementById('bulk-btn-rename');
  if (renameBtn) renameBtn.style.display = n === 1 ? '' : 'none';

  const deleteBtn = document.getElementById('bulk-btn-delete');
  if (deleteBtn) deleteBtn.textContent = n === 1 ? 'Delete Asset' : `Delete ${n} Assets`;

  const copyBtn = document.getElementById('bulk-btn-copy');
  if (copyBtn) copyBtn.textContent = n === 1 ? 'Copy Path' : 'Copy Paths';

  const showBulkExtras = n >= 1;

  const removeTagBtn = document.getElementById('bulk-btn-remove-tag');
  if (removeTagBtn) {
    let hasRemovableTag = false;
    if (showBulkExtras) {
      for (const asset of state.assets) {
        if (selectedSet.has(asset.id) && asset.tags) { hasRemovableTag = true; break; }
      }
    }
    removeTagBtn.style.display = hasRemovableTag ? '' : 'none';
  }

  const addTagBtn = document.getElementById('bulk-btn-tag');
  if (addTagBtn) {
    let hasAddableTag = false;
    if (showBulkExtras && state.tags.length > 0) {
      const selectedAssets = [];
      for (const asset of state.assets) {
        if (selectedSet.has(asset.id)) selectedAssets.push(asset);
      }
      const tagSets = selectedAssets.map(a => {
        const tags = a.tags || '';
        return tags ? new Set(tags.split(',').map(s => s.trim())) : new Set();
      });
      addTagLoop:
      for (const tag of state.tags) {
        for (const ts of tagSets) {
          if (!ts.has(tag.name)) { hasAddableTag = true; break addTagLoop; }
        }
      }
    }
    addTagBtn.style.display = hasAddableTag ? '' : 'none';
  }

  const removeColBtn = document.getElementById('bulk-btn-remove-collection');
  if (removeColBtn) {
    let hasRemovableCol = false;
    if (showBulkExtras) {
      for (const asset of state.assets) {
        if (selectedSet.has(asset.id) && asset.collections) { hasRemovableCol = true; break; }
      }
    }
    removeColBtn.style.display = hasRemovableCol ? '' : 'none';
  }

  const addColBtn = document.getElementById('bulk-btn-collection');
  if (addColBtn) {
    let hasAddableCol = false;
    if (showBulkExtras && state.collections.length > 0) {
      const selectedAssets = [];
      for (const asset of state.assets) {
        if (selectedSet.has(asset.id)) selectedAssets.push(asset);
      }
      const colSets = selectedAssets.map(a => {
        const cols = a.collections || '';
        return cols ? new Set(cols.split(',').map(s => s.trim())) : new Set();
      });
      addColLoop:
      for (const col of state.collections) {
        for (const cs of colSets) {
          if (!cs.has(col.name)) { hasAddableCol = true; break addColLoop; }
        }
      }
    }
    addColBtn.style.display = hasAddableCol ? '' : 'none';
  }

  const favBtn = document.getElementById('bulk-btn-favorite');
  if (favBtn) favBtn.style.display = showBulkExtras ? '' : 'none';

  const openInExplorerBtn = document.getElementById('btn-open-external');
  if (openInExplorerBtn) openInExplorerBtn.disabled = n > 1;

  const grid = document.getElementById('asset-grid');
  if (grid) {
    grid.classList.toggle('has-bulk', n >= 1);

    const changed = [...prevSelectedSet, ...selectedSet].filter(
      id => prevSelectedSet.has(id) !== selectedSet.has(id)
    );
    if (changed.length > 50) {
      for (const [id, card] of cardElementMap) {
        card.classList.toggle('selected', selectedSet.has(id));
        card.classList.toggle('focused', id === state.focusedAssetId);
      }
    } else {
      changed.forEach(id => {
        const card = cardElementMap.get(id);
        if (card) card.classList.toggle('selected', selectedSet.has(id));
      });
      if (prevFocusedId !== state.focusedAssetId) {
        if (prevFocusedId !== null) {
          const prev = cardElementMap.get(prevFocusedId);
          if (prev) prev.classList.remove('focused');
        }
        if (state.focusedAssetId !== null) {
          const next = cardElementMap.get(state.focusedAssetId);
          if (next) next.classList.add('focused');
        }
      }
    }
  }

  prevSelectedSet = selectedSet;
  prevFocusedId = state.focusedAssetId;
}

export function syncSelectionCache() {
  prevSelectedSet = new Set(state.selectedAssetIds);
  prevFocusedId = state.focusedAssetId;
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
  if (idIndexMap.size === 0) rebuildIdIndexMap();
  const end = idIndexMap.get(id);
  if (end === undefined) { await selectSingle(id); return; }

  let anchor = anchorId;
  if (anchor === null || !idIndexMap.has(anchor)) {
    anchor = state.focusedAssetId !== null && idIndexMap.has(state.focusedAssetId)
      ? state.focusedAssetId
      : (state.selectedAssetIds.length ? state.selectedAssetIds[state.selectedAssetIds.length - 1] : null);
  }
  if (anchor === null) { await selectSingle(id); return; }

  const anchorIdx = idIndexMap.get(anchor);
  if (anchorIdx === undefined) { await selectSingle(id); return; }
  const from = Math.min(anchorIdx, end);
  const to = Math.max(anchorIdx, end);
  state.selectedAssetIds = state.assets.slice(from, to + 1).map(a => a.id);
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

  if (idIndexMap.size === 0) rebuildIdIndexMap();

  let idx = state.focusedAssetId !== null && idIndexMap.has(state.focusedAssetId)
    ? idIndexMap.get(state.focusedAssetId)
    : (state.selectedAssetIds.length ? idIndexMap.get(state.selectedAssetIds[state.selectedAssetIds.length - 1]) : -1);

  if (idx === undefined) idx = -1;

  if (idx < 0) {
    if (extend) rangeSelect(list[0].id);
    else selectSingle(list[0].id);
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

  idx = Math.max(0, Math.min(list.length - 1, idx));
  if (idx === startIdx && !extend) return;

  const targetId = list[idx].id;

  if (extend) rangeSelect(targetId);
  else selectSingle(targetId);

  const card = cardElementMap.get(targetId);
  if (card) card.scrollIntoView({ block: 'nearest' });
}

export function getGridColumns(grid) {
  if (!grid) return 1;
  const gridWidth = grid.clientWidth - 40;
  if (gridWidth === lastGridWidth) return cachedGridCols;
  lastGridWidth = gridWidth;
  const isList = grid.classList.contains('list-view');
  if (isList) { cachedGridCols = 1; return 1; }
  const minCardWidth = 180 + 14;
  cachedGridCols = Math.max(1, Math.floor((gridWidth + 14) / minCardWidth));
  return cachedGridCols;
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
