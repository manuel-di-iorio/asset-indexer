import { state } from './state.js';

export const PAGE_SIZE = 500;

let assetsToken = 0;

function buildParams(offset, limit) {
  return {
    categories: state.selectedCategories,
    search: state.searchQuery,
    sort: state.sortBy,
    favorites: state.favorites,
    collectionIds: state.collectionIds,
    tagIds: state.tagIds,
    libraryIds: state.libraryIds,
    limit,
    offset
  };
}

function updateCountLabels() {
  document.getElementById('asset-count-label').textContent = `${state.totalCount.toLocaleString()} assets`;
  document.getElementById('status-selected').textContent = state.selectedAssetIds.length ? `${state.selectedAssetIds.length} selected` : '0 selected';
}

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
  const token = ++assetsToken;
  state.assets = await window.api.getAssets(buildParams(0, PAGE_SIZE));
  if (token !== assetsToken) return;
  state.totalCount = await window.api.getAssetCount(buildParams(0));
  if (token !== assetsToken) return;
  state.hasMore = state.assets.length < state.totalCount;
  updateCountLabels();
}

export async function loadMoreAssets() {
  const token = assetsToken;
  if (state.isLoading || !state.hasMore) return;
  state.isLoading = true;
  let more = [];
  try {
    more = await window.api.getAssets(buildParams(state.assets.length, PAGE_SIZE));
  } finally {
    state.isLoading = false;
  }
  if (token !== assetsToken) return;
  state.assets.push(...more);
  state.hasMore = state.assets.length < state.totalCount;
}
