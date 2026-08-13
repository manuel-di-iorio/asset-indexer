import { state } from '../state.js';
import { CATEGORY_LABELS } from '../constants.js';

export function updateBreadcrumb() {
  const text = document.getElementById('breadcrumb-text');
  const parts = [];

  if (state.favorites) {
    parts.push('Favorites');
  }
  if (state.selectedCategories.length > 0) {
    if (state.selectedCategories.length === 1) {
      parts.push(CATEGORY_LABELS[state.selectedCategories[0]] || state.selectedCategories[0]);
    } else {
      parts.push(`${state.selectedCategories.length} Categories`);
    }
  }
  if (state.tagIds.length > 0) {
    if (state.tagIds.length === 1) {
      const tag = state.tags.find(t => t.id === state.tagIds[0]);
      parts.push(tag ? tag.name : 'Tag');
    } else {
      parts.push(`${state.tagIds.length} Tags`);
    }
  }
  if (state.collectionIds.length > 0) {
    if (state.collectionIds.length === 1) {
      const col = state.collections.find(c => c.id === state.collectionIds[0]);
      parts.push(col ? col.name : 'Collection');
    } else {
      parts.push(`${state.collectionIds.length} Collections`);
    }
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
  } else {
    text.textContent = CATEGORY_LABELS['all'] || 'All Assets';
  }
}

export function updateSidebarActive() {
  document.querySelectorAll('.sidebar-item[data-category]').forEach(item => {
    const cat = item.dataset.category;
    const isFav = cat === 'favorites';
    item.classList.toggle('active',
      (isFav && state.favorites) ||
      (cat === 'all' && !state.favorites && state.selectedCategories.length === 0) ||
      (!isFav && cat !== 'all' && state.selectedCategories.includes(cat))
    );
  });
}
