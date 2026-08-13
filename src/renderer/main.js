import './styles.css';
import { loadLibraries, loadTags, loadCollections, loadCategoryCounts, loadAssets } from './api.js';
import { renderAssets } from './render/asset-grid.js';
import { renderSources, renderTags, renderCollections } from './render/sidebar.js';
import { updateBreadcrumb, updateSidebarActive } from './render/breadcrumb.js';
import { initEventListeners } from './events.js';
import { initResizeHandles } from './resize.js';
import { initTheme } from './theme.js';
import { version } from '../../package.json';

function hideSplash() {
  const el = document.getElementById('app-splash');
  if (el) el.classList.add('hidden');
}

async function init() {
  setTimeout(hideSplash, 8000);
  initTheme();
  initResizeHandles();
  document.getElementById('status-version').textContent = `v${version}`;
  initEventListeners();
  await loadLibraries();
  await loadTags();
  await loadCollections();
  renderSources();
  renderTags();
  renderCollections();
  await loadCategoryCounts();
  await loadAssets();
  renderAssets();
  updateSidebarActive();
  updateBreadcrumb();
  hideSplash();
}

document.addEventListener('DOMContentLoaded', init);
