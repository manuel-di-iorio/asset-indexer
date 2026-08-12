import { state } from '../state.js';
import { escapeHtml } from '../utils.js';
import { showModal, hideModal } from './modal.js';

export function showRenameCollectionModal(collectionId) {
  const collection = state.collections.find(c => c.id === collectionId);
  if (!collection) return;

  showModal('Rename Collection', `
    <div class="form-group">
      <label>Name</label>
      <input type="text" id="modal-rename-collection-input" value="${escapeHtml(collection.name)}">
    </div>
    <div class="form-group">
      <label>Description</label>
      <input type="text" id="modal-rename-collection-desc" value="${escapeHtml(collection.description || '')}">
    </div>
    <div id="modal-rename-collection-error" style="color:var(--red); font-size:12px; min-height:16px;"></div>
  `, `
    <button class="btn btn-secondary" id="modal-cancel-rename-collection">Cancel</button>
    <button class="btn btn-primary" id="modal-confirm-rename-collection">Rename</button>
  `);

  setTimeout(() => {
    const input = document.getElementById('modal-rename-collection-input');
    input.focus();
    input.select();
    document.getElementById('modal-cancel-rename-collection').addEventListener('click', hideModal);

    const doRename = async () => {
      const name = input.value.trim();
      const desc = document.getElementById('modal-rename-collection-desc').value.trim();
      if (!name) {
        document.getElementById('modal-rename-collection-error').textContent = 'Name cannot be empty';
        return;
      }
      const result = await window.api.renameCollection(collectionId, name, desc);
      if (result?.error) {
        document.getElementById('modal-rename-collection-error').textContent = result.error;
        return;
      }
      hideModal();
      document.dispatchEvent(new CustomEvent('sidebar-refresh'));
      document.dispatchEvent(new CustomEvent('breadcrumb-update'));
    };

    document.getElementById('modal-confirm-rename-collection').addEventListener('click', doRename);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doRename();
    });
  }, 50);
}
