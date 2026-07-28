import { showModal, hideModal } from './modal.js';

export function showAddTagModal() {
  showModal('Add Tag', `
    <div class="form-group">
      <label>Name</label>
      <input type="text" id="modal-tag-name" placeholder="Tag name">
    </div>
    <div class="form-group">
      <label>Color</label>
      <input type="color" id="modal-tag-color" value="#7c3aed">
    </div>
  `, `
    <button class="btn btn-secondary" id="modal-cancel-tag">Cancel</button>
    <button class="btn btn-primary" id="modal-confirm-add-tag">Add</button>
  `);
  setTimeout(() => {
    document.getElementById('modal-cancel-tag')?.addEventListener('click', hideModal);
    document.getElementById('modal-confirm-add-tag')?.addEventListener('click', async () => {
      const name = document.getElementById('modal-tag-name').value.trim();
      const color = document.getElementById('modal-tag-color').value;
      if (name) { await window.api.addTag(name, color); document.dispatchEvent(new CustomEvent('sidebar-refresh')); hideModal(); }
    });
    document.getElementById('modal-tag-name')?.focus();
  }, 50);
}
