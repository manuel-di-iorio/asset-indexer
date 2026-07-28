import './styles.css';
import { loadLibraries, loadTags, loadCollections, loadCategoryCounts, loadAssets } from './api.js';
import { renderAssets } from './render/asset-grid.js';
import { renderSources, renderTags, renderCollections } from './render/sidebar.js';
import { updateBreadcrumb, updateSidebarActive } from './render/breadcrumb.js';
import { initEventListeners } from './events.js';
import { version } from '../../package.json';

async function init() {
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
}

document.addEventListener('DOMContentLoaded', init);
