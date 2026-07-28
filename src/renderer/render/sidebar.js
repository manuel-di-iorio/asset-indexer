import { state } from '../state.js';
import { escapeHtml } from '../utils.js';
import { showContextMenu, setContextMenuTarget } from '../context-menu.js';

export function renderSources() {
  const container = document.getElementById('sources-list');
  if (!container) return;

  if (state.libraries.length === 0) {
    container.innerHTML = '<div style="padding: 8px 16px; font-size: 11.5px; color: var(--text-muted);">No folder added</div>';
    return;
  }

  container.innerHTML = state.libraries.map(lib => `
    <div class="sidebar-item source-item-row ${state.libraryIds.includes(lib.id) ? 'active' : ''}" data-library-id="${lib.id}" title="${escapeHtml(lib.path)}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
      <span class="item-name">${escapeHtml(lib.name)}</span>
      <span class="item-count">${(lib.asset_count || 0).toLocaleString()}</span>
    </div>
  `).join('');

  container.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const libId = parseInt(item.dataset.libraryId);
      const idx = state.libraryIds.indexOf(libId);
      if (idx >= 0) {
        state.libraryIds.splice(idx, 1);
      } else {
        state.libraryIds.push(libId);
      }
      document.dispatchEvent(new CustomEvent('sidebar-update'));
    });

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      setContextMenuTarget(parseInt(item.dataset.libraryId), 'source');
      showContextMenu(e.clientX, e.clientY, [
        { label: 'Rescan', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>', action: 'rescan' },
        { type: 'separator' },
        { label: 'Remove Source', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>', action: 'remove', danger: true }
      ]);
    });
  });
}

export function renderTags() {
  const container = document.getElementById('tags-list');
  container.innerHTML = state.tags.map(tag => `
    <div class="sidebar-item ${state.tagId === tag.id ? 'active' : ''}" data-tag-id="${tag.id}">
      <div class="tag-dot" style="background: ${tag.color}"></div>
      <span class="item-name">${escapeHtml(tag.name)}</span>
      <span class="item-count">${tag.asset_count || 0}</span>
    </div>
  `).join('');

  container.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      const tagId = parseInt(item.dataset.tagId);
      state.tagId = state.tagId === tagId ? null : tagId;
      document.dispatchEvent(new CustomEvent('sidebar-update'));
    });
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      setContextMenuTarget(parseInt(item.dataset.tagId), 'tag');
      showContextMenu(e.clientX, e.clientY, [
        { label: 'Delete Tag', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>', action: 'delete', danger: true }
      ]);
    });
  });
}

export function renderCollections() {
  const container = document.getElementById('collections-list');
  container.innerHTML = state.collections.map(col => `
    <div class="sidebar-item ${state.collectionId === col.id ? 'active' : ''}" data-collection-id="${col.id}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
      <span class="item-name">${escapeHtml(col.name)}</span>
      <span class="item-count">${col.asset_count || 0}</span>
    </div>
  `).join('');

  container.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      const colId = parseInt(item.dataset.collectionId);
      state.collectionId = state.collectionId === colId ? null : colId;
      document.dispatchEvent(new CustomEvent('sidebar-update'));
    });
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      setContextMenuTarget(parseInt(item.dataset.collectionId), 'collection');
      showContextMenu(e.clientX, e.clientY, [
        { label: 'Delete Collection', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>', action: 'delete', danger: true }
      ]);
    });
  });
}
