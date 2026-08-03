import { state } from './state.js';

export async function loadLibraries() {
  state.libraries = await window.api.getLibraries();
}

export async function loadTags() {
  state.tags = await window.api.getTags();
}

export async function loadCollections() {
  state.collections = await window.api.getCollections();
}

export async function loadCategoryCounts() {
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

export async function loadAssets() {
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
  document.getElementById('status-selected').textContent = state.selectedAssetIds.length ? `${state.selectedAssetIds.length} selected` : '0 selected';
}
