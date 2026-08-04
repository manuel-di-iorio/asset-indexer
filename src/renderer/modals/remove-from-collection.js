import { state } from '../state.js';
import { escapeHtml } from '../utils.js';
import { showModal, hideModal } from './modal.js';

export function showRemoveFromCollectionModal() {
  const ids = state.selectedAssetIds.length ? state.selectedAssetIds : (state.selectedAsset ? [state.selectedAsset.id] : []);
  if (ids.length === 0) return;

  const selectedAssets = state.assets.filter(a => ids.includes(a.id));
  const colSet = new Set();
  selectedAssets.forEach(a => (a.collections ? a.collections.split(',') : []).forEach(c => { const cc = c.trim(); if (cc) colSet.add(cc); }));
  const applicable = state.collections.filter(c => colSet.has(c.name));

  if (applicable.length === 0) {
    showModal('Remove from Collection', '<p style="color:var(--text-muted); font-size:13px;">None of the selected assets are in any collection.</p>', '<button class="btn btn-secondary" id="modal-ok-remove-col">OK</button>');
    setTimeout(() => {
      document.getElementById('modal-ok-remove-col')?.addEventListener('click', hideModal);
    }, 50);
    return;
  }

  showModal(ids.length > 1 ? `Remove from Collection (${ids.length} Assets)` : 'Remove from Collection', `
    <div class="form-group">
      <label>Select Collection to Remove</label>
      <select id="modal-select-remove-collection" style="width:100%; padding:8px 12px; background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-primary); border-radius:var(--radius-sm); font-size:13px; font-family:inherit;">
        ${applicable.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
      </select>
    </div>
  `, `
    <button class="btn btn-secondary" id="modal-cancel-remove-col">Cancel</button>
    <button class="btn btn-danger" id="modal-confirm-remove-col">Remove</button>
  `);
  setTimeout(() => {
    document.getElementById('modal-cancel-remove-col')?.addEventListener('click', hideModal);
    document.getElementById('modal-confirm-remove-col')?.addEventListener('click', async () => {
      const sel = document.getElementById('modal-select-remove-collection');
      const colId = sel ? parseInt(sel.value) : 0;
      if (colId) {
        await window.api.removeAssetFromCollections(ids, colId);
        document.dispatchEvent(new CustomEvent('sidebar-refresh'));
        document.dispatchEvent(new CustomEvent('asset-refresh'));
        hideModal();
      }
    });
  }, 50);
}
