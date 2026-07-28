import { state } from '../state.js';
import { escapeHtml } from '../utils.js';
import { showModal, hideModal } from './modal.js';

export function showAddTagToAssetModal() {
  if (!state.selectedAsset) return;
  const assetTags = state.selectedAsset.tags ? state.selectedAsset.tags.split(',') : [];

  showModal('Add Tag to Asset', `
    <div class="form-group">
      <label>Select Tag</label>
      <select id="modal-select-tag" style="width:100%; padding:8px 12px; background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-primary); border-radius:var(--radius-sm); font-size:13px; font-family:inherit;">
        ${state.tags.filter(t => !assetTags.includes(t.name)).map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}
      </select>
    </div>
    <div style="border-top:1px solid var(--border-color); padding-top:12px; margin-top:4px;">
      <label style="font-size:11px; color:var(--text-muted); margin-bottom:6px; display:block;">Or create new tag</label>
      <div style="display:flex; gap:6px;">
        <input type="text" id="modal-new-tag-name" placeholder="New tag name" style="flex:1; padding:6px 10px; background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-primary); border-radius:var(--radius-sm); font-size:12px; font-family:inherit;">
        <input type="color" id="modal-new-tag-color" value="#7c3aed" style="width:32px; height:28px; padding:1px; border:1px solid var(--border-color); border-radius:var(--radius-sm); cursor:pointer;">
        <button class="btn btn-primary" id="modal-create-and-add-tag" style="padding:6px 12px; font-size:11px;">Create</button>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" id="modal-cancel-tag-asset">Cancel</button>
    <button class="btn btn-primary" id="modal-confirm-add-tag-to-asset">Add</button>
  `);
  setTimeout(() => {
    document.getElementById('modal-cancel-tag-asset')?.addEventListener('click', hideModal);
    document.getElementById('modal-confirm-add-tag-to-asset')?.addEventListener('click', async () => {
      const sel = document.getElementById('modal-select-tag');
      const tagId = sel ? parseInt(sel.value) : 0;
      if (tagId) {
        await window.api.addTagToAsset(state.selectedAsset.id, tagId);
        document.dispatchEvent(new CustomEvent('asset-refresh', { detail: { assetId: state.selectedAsset.id } }));
        document.dispatchEvent(new CustomEvent('sidebar-refresh'));
        hideModal();
      }
    });
    document.getElementById('modal-create-and-add-tag')?.addEventListener('click', async () => {
      const name = document.getElementById('modal-new-tag-name')?.value.trim();
      const color = document.getElementById('modal-new-tag-color')?.value;
      if (name) {
        const result = await window.api.addTag(name, color);
        if (result && result.id) {
          await window.api.addTagToAsset(state.selectedAsset.id, result.id);
          document.dispatchEvent(new CustomEvent('asset-refresh', { detail: { assetId: state.selectedAsset.id } }));
          document.dispatchEvent(new CustomEvent('sidebar-refresh'));
          hideModal();
        }
      }
    });
  }, 50);
}
