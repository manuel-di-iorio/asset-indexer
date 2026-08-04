import { state } from './state.js';
import { loadLibraries, loadTags, loadCollections, loadCategoryCounts, loadAssets } from './api.js';
import { renderAssets } from './render/asset-grid.js';
import { renderSources, renderTags, renderCollections } from './render/sidebar.js';
import { updateBreadcrumb, updateSidebarActive } from './render/breadcrumb.js';
import { hideContextMenu } from './context-menu.js';
import { syncSelection, clearSelection, removeSelectedId } from './selection.js';
import { toggleFavoriteSelected, copySelectedPaths, openSelectedInExplorer } from './bulk-actions.js';
import { initKeyboardShortcuts } from './keyboard.js';
import { showAddLibraryModal } from './modals/add-library.js';
import { showAddTagModal } from './modals/add-tag.js';
import { showAddTagToAssetModal } from './modals/add-tag-to-asset.js';
import { showAddCollectionModal } from './modals/add-collection.js';
import { showAddToCollectionModal } from './modals/add-to-collection.js';
import { showRemoveTagFromAssetsModal } from './modals/remove-tag-from-assets.js';

let searchTimeout = null;
let requestId = 0;

function safeLoadAssets() {
  const id = ++requestId;
  loadAssets().then(() => {
    if (id === requestId) renderAssets();
  });
}

function doFullRefresh() {
  const id = ++requestId;
  loadLibraries().then(() => { if (id === requestId) { renderSources(); updateBreadcrumb(); } });
  loadTags().then(() => { if (id === requestId) renderTags(); });
  loadCollections().then(() => { if (id === requestId) renderCollections(); });
  loadCategoryCounts();
  loadAssets().then(() => { if (id === requestId) renderAssets(); });
}

export function initEventListeners() {
  document.getElementById('btn-minimize').addEventListener('click', () => window.api.windowMinimize());
  document.getElementById('btn-maximize').addEventListener('click', () => window.api.windowMaximize());
  document.getElementById('btn-close').addEventListener('click', () => window.api.windowClose());

  document.addEventListener('click', hideContextMenu);

  document.getElementById('asset-grid').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) clearSelection();
  });

  document.getElementById('bulk-btn-tag').addEventListener('click', showAddTagToAssetModal);
  document.getElementById('bulk-btn-remove-tag').addEventListener('click', showRemoveTagFromAssetsModal);
  document.getElementById('bulk-btn-collection').addEventListener('click', showAddToCollectionModal);
  document.getElementById('bulk-btn-favorite').addEventListener('click', () => {
    toggleFavoriteSelected();
    loadCategoryCounts();
  });
  document.getElementById('bulk-btn-copy').addEventListener('click', copySelectedPaths);
  document.getElementById('bulk-btn-clear').addEventListener('click', clearSelection);

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
    safeLoadAssets();
    updateBreadcrumb();
  });

  document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = e.target.value;
      safeLoadAssets();
    }, 200);
  });

  document.getElementById('sort-select').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    safeLoadAssets();
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

  document.getElementById('btn-toggle-inspector').addEventListener('click', () => {
    state.inspectorVisible = !state.inspectorVisible;
    document.getElementById('inspector').classList.toggle('hidden', !state.inspectorVisible);
    document.getElementById('btn-toggle-inspector').classList.toggle('active', state.inspectorVisible);
  });

  document.getElementById('btn-add-library').addEventListener('click', showAddLibraryModal);
  document.getElementById('btn-empty-add-library').addEventListener('click', showAddLibraryModal);

  document.getElementById('btn-add-collection').addEventListener('click', showAddCollectionModal);
  document.getElementById('btn-add-tag').addEventListener('click', showAddTagModal);
  document.getElementById('btn-add-tag-to-asset').addEventListener('click', showAddTagToAssetModal);
  document.getElementById('btn-add-to-collection').addEventListener('click', showAddToCollectionModal);

  document.getElementById('inspector-fav-btn').addEventListener('click', () => {
    toggleFavoriteSelected();
    loadCategoryCounts();
  });

  document.getElementById('btn-open-external').addEventListener('click', () => {
    if (state.selectedAssetIds.length > 0 || state.selectedAsset) openSelectedInExplorer();
  });

  document.getElementById('btn-copy-path').addEventListener('click', (e) => {
    if (state.selectedAssetIds.length === 0 && !state.selectedAsset) return;
    if (state.selectedAssetIds.length > 1) {
      copySelectedPaths();
      return;
    }
    const asset = state.selectedAsset || state.assets.find(a => a.id === state.selectedAssetIds[0]);
    if (!asset) return;
    navigator.clipboard.writeText(asset.file_path);
    const btn = e.currentTarget;
    const original = btn.innerHTML;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    setTimeout(() => { btn.innerHTML = original; }, 1500);
  });

  window.api.onAssetAdded(() => doFullRefresh());
  window.api.onAssetUpdated(() => safeLoadAssets());
  window.api.onAssetRemoved((data) => {
    if (data?.filePath) {
      const removed = state.assets.find(a => a.file_path === data.filePath);
      if (removed) removeSelectedId(removed.id);
    }
    safeLoadAssets();
    loadCategoryCounts();
    loadLibraries().then(() => renderSources());
  });

  document.addEventListener('sidebar-update', () => {
    updateSidebarActive();
    safeLoadAssets();
    updateBreadcrumb();
    renderSources();
    renderTags();
    renderCollections();
  });

  document.addEventListener('sidebar-refresh', () => {
    loadTags().then(() => renderTags());
    loadCollections().then(() => renderCollections());
    safeLoadAssets();
    loadCategoryCounts();
  });

  document.addEventListener('breadcrumb-update', () => updateBreadcrumb());

  document.addEventListener('library-added', () => doFullRefresh());

  document.addEventListener('asset-refresh', async () => {
    await syncSelection();
    safeLoadAssets();
  });

  initKeyboardShortcuts();
}
