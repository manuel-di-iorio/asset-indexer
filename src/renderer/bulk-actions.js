import { state } from './state.js';

function assetById(id) {
  return state.assets.find(a => a.id === id) || null;
}

export async function toggleFavoriteSelected() {
  const ids = [...state.selectedAssetIds];
  if (ids.length === 0) return;
  for (const id of ids) {
    await window.api.toggleFavorite(id);
  }
  document.dispatchEvent(new CustomEvent('sidebar-refresh'));
  document.dispatchEvent(new CustomEvent('asset-refresh'));
}

export function copySelectedPaths() {
  if (state.selectedAssetIds.length === 0) return;
  const paths = state.selectedAssetIds
    .map(assetById)
    .filter(Boolean)
    .map(a => a.file_path);
  if (paths.length === 0) return;
  navigator.clipboard.writeText(paths.join('\n'));

  const bulkCount = document.getElementById('bulk-count');
  if (bulkCount) {
    bulkCount.textContent = 'Paths copied!';
    setTimeout(() => {
      bulkCount.textContent = `${state.selectedAssetIds.length} selected`;
    }, 1200);
  }
}

export function openSelectedInExplorer() {
  if (state.selectedAsset) {
    window.api.openExternal(state.selectedAsset.file_path);
    return;
  }
  const id = state.focusedAssetId !== null
    ? state.focusedAssetId
    : (state.selectedAssetIds.length ? state.selectedAssetIds[0] : null);
  if (id === null) return;
  const asset = assetById(id);
  if (asset) window.api.openExternal(asset.file_path);
}
