import { state } from '../state.js';
import { showModal, hideModal } from './modal.js';
import { clearSelection } from '../selection.js';

export function showDeleteAssetModal() {
  const ids = state.selectedAssetIds.length ? state.selectedAssetIds : (state.selectedAsset ? [state.selectedAsset.id] : []);
  if (ids.length === 0) return;

  const n = ids.length;
  const title = n === 1 ? 'Delete Asset' : `Delete ${n} Assets`;
  const body = n === 1
    ? 'This will move the selected file to the Recycle Bin and remove it from the library. This action cannot be undone.'
    : `This will move ${n} selected files to the Recycle Bin and remove them from the library. This action cannot be undone.`;

  showModal(title, `
    <p style="color:var(--text-muted); font-size:13px; line-height:1.5; margin:0;">${body}</p>
    <div id="modal-delete-error" style="color:var(--red); font-size:12px; min-height:16px; margin-top:8px;"></div>
  `, `
    <button class="btn btn-secondary" id="modal-cancel-delete">Cancel</button>
    <button class="btn btn-danger" id="modal-confirm-delete">Delete</button>
  `);

  setTimeout(() => {
    document.getElementById('modal-cancel-delete')?.addEventListener('click', hideModal);
    document.getElementById('modal-confirm-delete')?.addEventListener('click', async () => {
      const btn = document.getElementById('modal-confirm-delete');
      btn.disabled = true;
      const res = await window.api.deleteAssets(ids);
      if (res?.error) {
        const errEl = document.getElementById('modal-delete-error');
        if (errEl) errEl.textContent = res.error;
        btn.disabled = false;
        return;
      }
      clearSelection();
      hideModal();
      document.dispatchEvent(new CustomEvent('asset-refresh'));
      document.dispatchEvent(new CustomEvent('sidebar-refresh'));
    });
  }, 50);
}
