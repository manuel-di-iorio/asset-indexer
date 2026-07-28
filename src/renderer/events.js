import { state } from './state.js';
import { loadLibraries, loadTags, loadCollections, loadCategoryCounts, loadAssets } from './api.js';
import { renderAssets } from './render/asset-grid.js';
import { renderSources, renderTags, renderCollections } from './render/sidebar.js';
import { updateBreadcrumb, updateSidebarActive } from './render/breadcrumb.js';
import { selectAsset } from './render/inspector.js';
import { hideContextMenu } from './context-menu.js';
import { showAddLibraryModal } from './modals/add-library.js';
import { showAddTagModal } from './modals/add-tag.js';
import { showAddTagToAssetModal } from './modals/add-tag-to-asset.js';
import { showAddCollectionModal } from './modals/add-collection.js';
import { showAddToCollectionModal } from './modals/add-to-collection.js';

let searchTimeout = null;

function doFullRefresh() {
  loadLibraries().then(() => { renderSources(); updateBreadcrumb(); });
  loadTags().then(() => renderTags());
  loadCollections().then(() => renderCollections());
  loadCategoryCounts();
  loadAssets().then(() => renderAssets());
}

export function initEventListeners() {
  document.getElementById('btn-minimize').addEventListener('click', () => window.api.windowMinimize());
  document.getElementById('btn-maximize').addEventListener('click', () => window.api.windowMaximize());
  document.getElementById('btn-close').addEventListener('click', () => window.api.windowClose());

  document.addEventListener('click', hideContextMenu);

  document.getElementById('btn-rescan-all').addEventListener('click', async () => {
    const btn = document.getElementById('btn-rescan-all');
    btn.disabled = true;
    await window.api.rescanAll();
    btn.disabled = false;
    doFullRefresh();
  });

  document.getElementById('library-list').addEventListener('click', (e) => {
    const item = e.target.closest('.sidebar-item');
    if (!item) return;
    const cat = item.dataset.category;
    if (cat === 'favorites') {
      state.favorites = true;
      state.currentCategory = 'all';
    } else {
      state.currentCategory = cat;
      state.favorites = false;
    }
    state.collectionId = null;
    state.tagId = null;
    state.libraryIds = [];
    updateSidebarActive();
    loadAssets().then(() => renderAssets());
    updateBreadcrumb();
  });

  document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = e.target.value;
      loadAssets().then(() => renderAssets());
    }, 200);
  });

  document.getElementById('sort-select').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    loadAssets().then(() => renderAssets());
  });

  document.getElementById('btn-grid-view').addEventListener('click', () => {
    state.viewMode = 'grid';
    document.getElementById('asset-grid').classList.remove('list-view');
    document.getElementById('btn-grid-view').classList.add('active');
    document.getElementById('btn-list-view').classList.remove('active');
  });

  document.getElementById('btn-list-view').addEventListener('click', () => {
    state.viewMode = 'list';
    document.getElementById('asset-grid').classList.add('list-view');
    document.getElementById('btn-list-view').classList.add('active');
    document.getElementById('btn-grid-view').classList.remove('active');
  });

  document.getElementById('btn-add-library').addEventListener('click', showAddLibraryModal);
  document.getElementById('btn-empty-add-library').addEventListener('click', showAddLibraryModal);

  document.getElementById('btn-add-collection').addEventListener('click', showAddCollectionModal);
  document.getElementById('btn-add-tag').addEventListener('click', showAddTagModal);
  document.getElementById('btn-add-tag-to-asset').addEventListener('click', showAddTagToAssetModal);
  document.getElementById('btn-add-to-collection').addEventListener('click', showAddToCollectionModal);

  document.getElementById('inspector-fav-btn').addEventListener('click', async () => {
    if (!state.selectedAsset) return;
    await window.api.toggleFavorite(state.selectedAsset.id);
    await selectAsset(state.selectedAsset.id);
    loadAssets().then(() => renderAssets());
    loadCategoryCounts();
  });

  document.getElementById('btn-open-external').addEventListener('click', () => {
    if (state.selectedAsset) window.api.openExternal(state.selectedAsset.file_path);
  });

  window.api.onAssetAdded(() => doFullRefresh());
  window.api.onAssetUpdated(() => { loadAssets().then(() => renderAssets()); });
  window.api.onAssetRemoved(() => {
    loadAssets().then(() => renderAssets());
    loadCategoryCounts();
    loadLibraries().then(() => renderSources());
    if (state.selectedAsset) {
      document.getElementById('inspector-empty').style.display = 'flex';
      document.getElementById('inspector-content').style.display = 'none';
      state.selectedAsset = null;
    }
  });

  document.addEventListener('select-asset', (e) => selectAsset(e.detail.assetId));

  document.addEventListener('sidebar-update', () => {
    updateSidebarActive();
    loadAssets().then(() => renderAssets());
    updateBreadcrumb();
    renderSources();
    renderTags();
    renderCollections();
  });

  document.addEventListener('sidebar-refresh', () => {
    loadTags().then(() => renderTags());
    loadCollections().then(() => renderCollections());
    loadAssets().then(() => renderAssets());
    loadCategoryCounts();
  });

  document.addEventListener('breadcrumb-update', () => updateBreadcrumb());

  document.addEventListener('library-added', () => doFullRefresh());

  document.addEventListener('asset-refresh', async (e) => {
    if (e.detail && e.detail.assetId) {
      await selectAsset(e.detail.assetId);
    }
    loadAssets().then(() => renderAssets());
  });
}
