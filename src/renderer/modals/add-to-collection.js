import { state } from '../state.js';
import { escapeHtml } from '../utils.js';
import { showModal, hideModal } from './modal.js';

export function showAddToCollectionModal() {
  const ids = state.selectedAssetIds.length ? state.selectedAssetIds : (state.selectedAsset ? [state.selectedAsset.id] : []);
  if (ids.length === 0) return;

  showModal(ids.length > 1 ? `Add to Collection (${ids.length})` : 'Add to Collection', `
    <div class="form-group">
      <label>Select Collection</label>
      <select id="modal-select-collection" style="width:100%; padding:8px 12px; background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-primary); border-radius:var(--radius-sm); font-size:13px; font-family:inherit;">
        ${state.collections.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
      </select>
    </div>
    <div style="border-top:1px solid var(--border-color); padding-top:12px; margin-top:4px;">
      <label style="font-size:11px; color:var(--text-muted); margin-bottom:6px; display:block;">Or create new collection</label>
      <div style="display:flex; gap:6px;">
        <input type="text" id="modal-new-col-name" placeholder="New collection name" style="flex:1; padding:6px 10px; background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-primary); border-radius:var(--radius-sm); font-size:12px; font-family:inherit;">
        <button class="btn btn-primary" id="modal-create-and-add-col" style="padding:6px 12px; font-size:11px;">Create</button>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" id="modal-cancel-col-asset">Cancel</button>
    <button class="btn btn-primary" id="modal-confirm-add-col-to-asset">Add</button>
  `);
  setTimeout(() => {
    document.getElementById('modal-cancel-col-asset')?.addEventListener('click', hideModal);
    document.getElementById('modal-confirm-add-col-to-asset')?.addEventListener('click', async () => {
      const sel = document.getElementById('modal-select-collection');
      const colId = sel ? parseInt(sel.value) : 0;
      if (colId) {
        for (const id of ids) {
          await window.api.addAssetToCollection(id, colId);
        }
        document.dispatchEvent(new CustomEvent('sidebar-refresh'));
        document.dispatchEvent(new CustomEvent('asset-refresh'));
        hideModal();
      }
    });
    document.getElementById('modal-create-and-add-col')?.addEventListener('click', async () => {
      const name = document.getElementById('modal-new-col-name')?.value.trim();
      if (name) {
        const result = await window.api.addCollection(name);
        if (result && result.id) {
          for (const id of ids) {
            await window.api.addAssetToCollection(id, result.id);
          }
          document.dispatchEvent(new CustomEvent('sidebar-refresh'));
          document.dispatchEvent(new CustomEvent('asset-refresh'));
          hideModal();
        }
      }
    });
  }, 50);
}
