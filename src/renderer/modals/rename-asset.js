import { state } from '../state.js';
import { escapeHtml } from '../utils.js';
import { showModal, hideModal } from './modal.js';

export function showRenameAssetModal() {
  const id = state.selectedAssetIds.length === 1 ? state.selectedAssetIds[0] : (state.selectedAsset ? state.selectedAsset.id : null);
  if (id === null) return;
  const asset = state.assets.find(a => a.id === id) || state.selectedAsset;
  if (!asset) return;

  showModal('Rename Asset', `
    <div class="form-group">
      <label>New file name</label>
      <input type="text" id="modal-rename-input" value="${escapeHtml(asset.file_name)}" style="width:100%; padding:8px 12px; background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-primary); border-radius:var(--radius-sm); font-size:13px; font-family:inherit;">
    </div>
    <div id="modal-rename-error" style="color:var(--red); font-size:12px; min-height:16px;"></div>
  `, `
    <button class="btn btn-secondary" id="modal-cancel-rename">Cancel</button>
    <button class="btn btn-primary" id="modal-confirm-rename">Rename</button>
  `);

  setTimeout(() => {
    const input = document.getElementById('modal-rename-input');
    input.focus();
    const dot = input.value.lastIndexOf('.');
    input.setSelectionRange(0, dot > 0 ? dot : input.value.length);

    document.getElementById('modal-cancel-rename').addEventListener('click', hideModal);

    const doRename = async () => {
      const newName = input.value.trim();
      if (!newName) {
        document.getElementById('modal-rename-error').textContent = 'Name cannot be empty';
        return;
      }
      const result = await window.api.renameAsset(id, newName);
      if (result?.error) {
        document.getElementById('modal-rename-error').textContent = result.error;
        return;
      }
      const existing = state.assets.find(a => a.id === id);
      if (existing) {
        existing.file_name = result.file_name;
        existing.file_path = result.file_path;
        existing.file_ext = result.file_ext;
        existing.category = result.category;
      }
      if (state.selectedAsset && state.selectedAsset.id === id) {
        state.selectedAsset.file_name = result.file_name;
        state.selectedAsset.file_path = result.file_path;
        state.selectedAsset.file_ext = result.file_ext;
        state.selectedAsset.category = result.category;
      }
      hideModal();
      document.dispatchEvent(new CustomEvent('asset-refresh'));
    };

    document.getElementById('modal-confirm-rename').addEventListener('click', doRename);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doRename();
    });
  }, 50);
}
