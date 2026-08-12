import { escapeHtml } from './utils.js';
import { state } from './state.js';
import { loadLibraries, loadAssets, loadTags, loadCollections, loadCategoryCounts } from './api.js';
import { showAddTagToAssetModal } from './modals/add-tag-to-asset.js';
import { showAddToCollectionModal } from './modals/add-to-collection.js';
import { showRemoveTagFromAssetsModal } from './modals/remove-tag-from-assets.js';
import { showRemoveFromCollectionModal } from './modals/remove-from-collection.js';
import { showRenameTagModal } from './modals/rename-tag.js';
import { showRenameCollectionModal } from './modals/rename-collection.js';
import { toggleFavoriteSelected, copySelectedPaths, openSelectedInExplorer } from './bulk-actions.js';

let contextMenuTarget = null;
let contextMenuType = null;

export function getContextMenuTarget() { return contextMenuTarget; }
export function getContextMenuType() { return contextMenuType; }

export function showContextMenu(x, y, items) {
  const menu = document.getElementById('context-menu');
  menu.innerHTML = items.map((item, i) => {
    if (item.type === 'separator') return '<div class="context-menu-separator"></div>';
    const disabled = item.disabled ? ' disabled' : '';
    return `<div class="context-menu-item${item.danger ? ' danger' : ''}${disabled}" data-action="${item.action}" ${item.disabled ? 'data-disabled="true"' : ''}>${item.icon || ''}${escapeHtml(item.label)}</div>`;
  }).join('');

  menu.querySelectorAll('.context-menu-item').forEach(el => {
    if (el.dataset.disabled === 'true') return;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      handleContextAction(el.dataset.action);
    });
  });

  menu.style.display = 'block';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';
}

async function handleContextAction(action) {
  const target = contextMenuTarget;
  const type = contextMenuType;
  hideContextMenu();
  if (action === 'rescan' && type === 'source') {
    await window.api.rescanLibrary(target);
    await loadLibraries();
    await loadCategoryCounts();
    await loadAssets();
  } else if (action === 'remove' && type === 'source') {
    if (confirm('Remove this source and all its indexed assets?')) {
      await window.api.removeLibrary(target);
      state.libraryIds = state.libraryIds.filter(id => id !== target);
      await loadLibraries();
      await loadCategoryCounts();
      await loadAssets();
      document.dispatchEvent(new CustomEvent('breadcrumb-update'));
    }
  } else if (action === 'delete' && type === 'tag') {
    if (confirm('Delete this tag from all assets?')) {
      await window.api.deleteTag(target);
      if (state.tagId === target) state.tagId = null;
      await loadTags();
      await loadAssets();
      document.dispatchEvent(new CustomEvent('breadcrumb-update'));
    }
  } else if (action === 'rename' && type === 'tag') {
    showRenameTagModal(target);
  } else if (action === 'delete' && type === 'collection') {
    if (confirm('Delete this collection?')) {
      await window.api.deleteCollection(target);
      if (state.collectionId === target) state.collectionId = null;
      await loadCollections();
      await loadAssets();
      document.dispatchEvent(new CustomEvent('breadcrumb-update'));
    }
  } else if (action === 'rename' && type === 'collection') {
    showRenameCollectionModal(target);
    showAddTagToAssetModal();
  } else if (action === 'remove-tag-selected') {
    showRemoveTagFromAssetsModal();
  } else if (action === 'remove-collection-selected') {
    showRemoveFromCollectionModal();
  } else if (action === 'collection-selected') {
    showAddToCollectionModal();
  } else if (action === 'favorite-selected') {
    toggleFavoriteSelected();
  } else if (action === 'copy-paths') {
    copySelectedPaths();
  } else if (action === 'open-selected') {
    openSelectedInExplorer();
  }
}

const ASSET_MENU_ICONS = {
  tag: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  folder: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
  favorite: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
  open: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'
};

export function showAssetContextMenu(x, y) {
  const n = state.selectedAssetIds.length;
  const hasTags = state.assets.some(a => state.selectedAssetIds.includes(a.id) && a.tags);
  const hasCollections = state.assets.some(a => state.selectedAssetIds.includes(a.id) && a.collections);

  const items = [
    { label: `Add Tag (${n})`, icon: ASSET_MENU_ICONS.tag, action: 'tag-selected' }
  ];
  if (hasTags) {
    items.push({ label: `Remove Tag (${n})`, icon: ASSET_MENU_ICONS.tag, action: 'remove-tag-selected' });
  }
  items.push(
    { label: `Add to Collection (${n})`, icon: ASSET_MENU_ICONS.folder, action: 'collection-selected' }
  );
  if (hasCollections) {
    items.push({ label: `Remove from Collection (${n})`, icon: ASSET_MENU_ICONS.folder, action: 'remove-collection-selected' });
  }
  items.push(
    { type: 'separator' },
    { label: 'Toggle Favorite', icon: ASSET_MENU_ICONS.favorite, action: 'favorite-selected' },
    { type: 'separator' },
    { label: 'Copy Paths', icon: ASSET_MENU_ICONS.copy, action: 'copy-paths' },
    { label: 'Open in File Explorer', icon: ASSET_MENU_ICONS.open, action: 'open-selected', disabled: n > 1 }
  );

  showContextMenu(x, y, items);
}

export function hideContextMenu() {
  document.getElementById('context-menu').style.display = 'none';
  contextMenuTarget = null;
  contextMenuType = null;
}

export function setContextMenuTarget(target, type) {
  contextMenuTarget = target;
  contextMenuType = type;
}
