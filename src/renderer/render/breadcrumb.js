import { state } from '../state.js';
import { CATEGORY_LABELS } from '../constants.js';

export function updateBreadcrumb() {
  const text = document.getElementById('breadcrumb-text');
  const parts = [];

  if (state.tagId) {
    const tag = state.tags.find(t => t.id === state.tagId);
    parts.push(tag ? tag.name : 'Tag');
  }
  if (state.collectionId) {
    const col = state.collections.find(c => c.id === state.collectionId);
    parts.push(col ? col.name : 'Collection');
  }
  if (state.libraryIds.length > 0) {
    if (state.libraryIds.length === 1) {
      const lib = state.libraries.find(l => l.id === state.libraryIds[0]);
      parts.push(lib ? lib.name : 'Source');
    } else {
      parts.push(`${state.libraryIds.length} Sources`);
    }
  }

  if (parts.length > 0) {
    text.textContent = parts.join(' + ');
  } else if (state.favorites) {
    text.textContent = 'Favorites';
  } else {
    text.textContent = CATEGORY_LABELS[state.currentCategory] || 'All Assets';
  }
}

export function updateSidebarActive() {
  document.querySelectorAll('.sidebar-item[data-category]').forEach(item => {
    const isFav = item.dataset.category === 'favorites';
    item.classList.toggle('active',
      (isFav && state.favorites && !state.tagId) ||
      (!isFav && item.dataset.category === state.currentCategory && !state.favorites && !state.collectionId && state.libraryIds.length === 0 && !state.tagId)
    );
  });
}
