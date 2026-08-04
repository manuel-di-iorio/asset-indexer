import { state } from '../state.js';
import { escapeHtml } from '../utils.js';
import { showModal, hideModal } from './modal.js';

export function showRemoveTagFromAssetsModal() {
  const ids = state.selectedAssetIds.length ? state.selectedAssetIds : (state.selectedAsset ? [state.selectedAsset.id] : []);
  if (ids.length === 0) return;

  const selectedAssets = state.assets.filter(a => ids.includes(a.id));
  const tagSet = new Set();
  selectedAssets.forEach(a => (a.tags ? a.tags.split(',') : []).forEach(t => { const tt = t.trim(); if (tt) tagSet.add(tt); }));
  const applicable = state.tags.filter(t => tagSet.has(t.name));

  if (applicable.length === 0) {
    showModal('Remove Tag', '<p style="color:var(--text-muted); font-size:13px;">None of the selected assets have tags.</p>', '<button class="btn btn-secondary" id="modal-ok-remove-tag">OK</button>');
    setTimeout(() => {
      document.getElementById('modal-ok-remove-tag')?.addEventListener('click', hideModal);
    }, 50);
    return;
  }

  showModal(ids.length > 1 ? `Remove Tag from ${ids.length} Assets` : 'Remove Tag from Asset', `
    <div class="form-group">
      <label>Select Tag to Remove</label>
      <select id="modal-select-remove-tag" style="width:100%; padding:8px 12px; background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-primary); border-radius:var(--radius-sm); font-size:13px; font-family:inherit;">
        ${applicable.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}
      </select>
    </div>
  `, `
    <button class="btn btn-secondary" id="modal-cancel-remove-tag">Cancel</button>
    <button class="btn btn-danger" id="modal-confirm-remove-tag">Remove</button>
  `);
  setTimeout(() => {
    document.getElementById('modal-cancel-remove-tag')?.addEventListener('click', hideModal);
    document.getElementById('modal-confirm-remove-tag')?.addEventListener('click', async () => {
      const sel = document.getElementById('modal-select-remove-tag');
      const tagId = sel ? parseInt(sel.value) : 0;
      if (tagId) {
        await window.api.removeTagFromAssets(ids, tagId);
        document.dispatchEvent(new CustomEvent('sidebar-refresh'));
        document.dispatchEvent(new CustomEvent('asset-refresh'));
        hideModal();
      }
    });
  }, 50);
}
