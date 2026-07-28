import { showModal, hideModal } from './modal.js';

export function showAddCollectionModal() {
  showModal('Add Collection', `
    <div class="form-group">
      <label>Name</label>
      <input type="text" id="modal-collection-name" placeholder="Collection name">
    </div>
    <div class="form-group">
      <label>Description</label>
      <input type="text" id="modal-collection-desc" placeholder="Optional description">
    </div>
  `, `
    <button class="btn btn-secondary" id="modal-cancel-collection">Cancel</button>
    <button class="btn btn-primary" id="modal-confirm-add-collection">Add</button>
  `);
  setTimeout(() => {
    document.getElementById('modal-cancel-collection')?.addEventListener('click', hideModal);
    document.getElementById('modal-confirm-add-collection')?.addEventListener('click', async () => {
      const name = document.getElementById('modal-collection-name').value.trim();
      const desc = document.getElementById('modal-collection-desc').value.trim();
      if (name) { await window.api.addCollection(name, desc); document.dispatchEvent(new CustomEvent('sidebar-refresh')); hideModal(); }
    });
    document.getElementById('modal-collection-name')?.focus();
  }, 50);
}
