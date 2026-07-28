import { escapeHtml } from './utils.js';
import { state } from './state.js';
import { loadLibraries, loadAssets, loadTags, loadCollections, loadCategoryCounts } from './api.js';

let contextMenuTarget = null;
let contextMenuType = null;

export function getContextMenuTarget() { return contextMenuTarget; }
export function getContextMenuType() { return contextMenuType; }

export function showContextMenu(x, y, items) {
  const menu = document.getElementById('context-menu');
  menu.innerHTML = items.map((item, i) => {
    if (item.type === 'separator') return '<div class="context-menu-separator"></div>';
    return `<div class="context-menu-item${item.danger ? ' danger' : ''}" data-action="${item.action}">${item.icon || ''}${escapeHtml(item.label)}</div>`;
  }).join('');

  menu.querySelectorAll('.context-menu-item').forEach(el => {
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
  if (action === 'rescan' && contextMenuType === 'source') {
    await window.api.rescanLibrary(contextMenuTarget);
    await loadLibraries();
    await loadCategoryCounts();
    await loadAssets();
  } else if (action === 'remove' && contextMenuType === 'source') {
    if (confirm('Remove this source and all its indexed assets?')) {
      await window.api.removeLibrary(contextMenuTarget);
      state.libraryIds = state.libraryIds.filter(id => id !== contextMenuTarget);
      await loadLibraries();
      await loadCategoryCounts();
      await loadAssets();
      document.dispatchEvent(new CustomEvent('breadcrumb-update'));
    }
  } else if (action === 'delete' && contextMenuType === 'tag') {
    if (confirm('Delete this tag from all assets?')) {
      await window.api.deleteTag(contextMenuTarget);
      if (state.tagId === contextMenuTarget) state.tagId = null;
      await loadTags();
      await loadAssets();
      document.dispatchEvent(new CustomEvent('breadcrumb-update'));
    }
  } else if (action === 'delete' && contextMenuType === 'collection') {
    if (confirm('Delete this collection?')) {
      await window.api.deleteCollection(contextMenuTarget);
      if (state.collectionId === contextMenuTarget) state.collectionId = null;
      await loadCollections();
      await loadAssets();
      document.dispatchEvent(new CustomEvent('breadcrumb-update'));
    }
  }
  hideContextMenu();
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
