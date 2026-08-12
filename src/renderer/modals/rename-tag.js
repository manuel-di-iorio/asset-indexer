import { state } from '../state.js';
import { escapeHtml } from '../utils.js';
import { showModal, hideModal } from './modal.js';

export function showRenameTagModal(tagId) {
  const tag = state.tags.find(t => t.id === tagId);
  if (!tag) return;

  showModal('Rename Tag', `
    <div class="form-group">
      <label>Name</label>
      <input type="text" id="modal-rename-tag-input" value="${escapeHtml(tag.name)}">
    </div>
    <div class="form-group">
      <label>Color</label>
      <input type="color" id="modal-rename-tag-color" value="${escapeHtml(tag.color)}">
    </div>
    <div id="modal-rename-tag-error" style="color:var(--red); font-size:12px; min-height:16px;"></div>
  `, `
    <button class="btn btn-secondary" id="modal-cancel-rename-tag">Cancel</button>
    <button class="btn btn-primary" id="modal-confirm-rename-tag">Rename</button>
  `);

  setTimeout(() => {
    const input = document.getElementById('modal-rename-tag-input');
    input.focus();
    input.select();
    document.getElementById('modal-cancel-rename-tag').addEventListener('click', hideModal);

    const doRename = async () => {
      const name = input.value.trim();
      const color = document.getElementById('modal-rename-tag-color').value;
      if (!name) {
        document.getElementById('modal-rename-tag-error').textContent = 'Name cannot be empty';
        return;
      }
      const result = await window.api.renameTag(tagId, name, color);
      if (result?.error) {
        document.getElementById('modal-rename-tag-error').textContent = result.error;
        return;
      }
      hideModal();
      document.dispatchEvent(new CustomEvent('sidebar-refresh'));
      document.dispatchEvent(new CustomEvent('breadcrumb-update'));
    };

    document.getElementById('modal-confirm-rename-tag').addEventListener('click', doRename);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doRename();
    });
  }, 50);
}
