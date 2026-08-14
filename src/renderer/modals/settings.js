import { showModal, hideModal } from './modal.js';
import { applyTheme } from '../theme.js';
import { applyUiZoom, applyTextZoom, getUiZoom, getTextZoom, ZOOM_MIN, ZOOM_MAX } from '../zoom.js';
import { escapeHtml } from '../utils.js';

function setStatus(msg, isError) {
  const el = document.getElementById('settings-status');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? 'var(--red)' : 'var(--green)';
}

export function showSettingsModal() {
  showModal('Options', `
    <div class="settings-section">
      <div class="settings-section-title">Appearance</div>
      <div class="form-group">
        <label for="settings-theme">Theme</label>
        <select id="settings-theme" class="settings-select">
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </div>
      <div class="form-group">
        <label for="settings-ui-zoom">Interface Zoom (<span id="settings-ui-zoom-value">100%</span>)</label>
        <input type="range" id="settings-ui-zoom" min="${ZOOM_MIN}" max="${ZOOM_MAX}" step="0.05" />
      </div>
      <div class="form-group" style="margin-bottom:0;">
        <label for="settings-text-zoom">Text Zoom (<span id="settings-text-zoom-value">100%</span>)</label>
        <input type="range" id="settings-text-zoom" min="${ZOOM_MIN}" max="${ZOOM_MAX}" step="0.05" />
      </div>
    </div>


    <div class="settings-section">
      <div class="settings-section-title">Database</div>
      <button class="secondary-btn settings-btn" id="settings-export">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export Database...
      </button>
      <button class="secondary-btn settings-btn" id="settings-import">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Import Database...
      </button>
      <button class="secondary-btn settings-btn" id="settings-open-folder">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
        Open Data Folder
      </button>
    </div>

    <div class="settings-status" id="settings-status"></div>
  `, `
    <button class="btn btn-secondary" id="modal-cancel-settings">Close</button>
  `, true);

  const themeSelect = document.getElementById('settings-theme');
  themeSelect.value = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));

  const uiZoomInput = document.getElementById('settings-ui-zoom');
  const uiZoomValue = document.getElementById('settings-ui-zoom-value');
  uiZoomInput.value = getUiZoom();
  uiZoomValue.textContent = `${Math.round(getUiZoom() * 100)}%`;
  uiZoomInput.addEventListener('input', () => {
    const zoom = applyUiZoom(uiZoomInput.value);
    uiZoomValue.textContent = `${Math.round(zoom * 100)}%`;
  });

  const textZoomInput = document.getElementById('settings-text-zoom');
  const textZoomValue = document.getElementById('settings-text-zoom-value');
  textZoomInput.value = getTextZoom();
  textZoomValue.textContent = `${Math.round(getTextZoom() * 100)}%`;
  textZoomInput.addEventListener('input', () => {
    const zoom = applyTextZoom(textZoomInput.value);
    textZoomValue.textContent = `${Math.round(zoom * 100)}%`;
  });

  document.getElementById('modal-cancel-settings')?.addEventListener('click', hideModal);

  document.getElementById('settings-export')?.addEventListener('click', async () => {
    setStatus('Exporting...');
    const res = await window.api.exportDatabase();
    if (!res) { setStatus('Export cancelled.'); return; }
    if (res.error) { setStatus(res.error, true); return; }
    setStatus(`Database exported to ${escapeHtml(res.path)}`);
  });

  document.getElementById('settings-import')?.addEventListener('click', async () => {
    setStatus('Importing...');
    const res = await window.api.importDatabase();
    if (!res) { setStatus('Import cancelled.'); return; }
    if (res.error) { setStatus(res.error, true); return; }
    setStatus('Database imported. The app will restart...');
  });

  document.getElementById('settings-open-folder')?.addEventListener('click', () => {
    window.api.openDataFolder();
  });
}
