import { state } from './state.js';

export const INITIAL_PAGE_SIZE = 150;
export const PAGE_SIZE = 500;

let assetsToken = 0;

let countLabelEl = null;
let statusSelectedEl = null;

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
  if (!countLabelEl) countLabelEl = document.getElementById('asset-count-label');
  if (!statusSelectedEl) statusSelectedEl = document.getElementById('status-selected');
  if (countLabelEl) countLabelEl.textContent = `${state.totalCount.toLocaleString()} assets`;
  if (statusSelectedEl) statusSelectedEl.textContent = state.selectedAssetIds.length ? `${state.selectedAssetIds.length} selected` : '0 selected';
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
  const [counts, total, favCount] = await Promise.all([
    window.api.getCategoryCounts(),
    window.api.getTotalAssets(),
    window.api.getAssetCount({ favorites: true })
  ]);

  const countAllEl = document.getElementById('count-all');
  const countFavEl = document.getElementById('count-favorites');
  if (countAllEl) countAllEl.textContent = total.toLocaleString();
  if (countFavEl) countFavEl.textContent = favCount.toLocaleString();

  ['audio', '3d-models', 'materials', 'images', 'scripts', 'videos', 'documents'].forEach(cat => {
    const el = document.getElementById(`count-${cat}`);
    if (el) el.textContent = (counts[cat] || 0).toLocaleString();
  });

  const statusTotalEl = document.getElementById('status-total');
  const statusLibsEl = document.getElementById('status-libraries');
  if (statusTotalEl) statusTotalEl.textContent = `${total.toLocaleString()} assets`;
  if (statusLibsEl) statusLibsEl.textContent = `${state.libraries.length} libs`;
}

export async function loadAssets() {
  const token = ++assetsToken;
  const params = buildParams(0, INITIAL_PAGE_SIZE);
  const countParams = buildParams(0);
  const [assets, totalCount] = await Promise.all([
    window.api.getAssets(params),
    window.api.getAssetCount(countParams)
  ]);
  if (token !== assetsToken) return;
  state.assets = assets;
  state.totalCount = totalCount;
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
