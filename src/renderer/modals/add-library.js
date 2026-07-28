import { showModal, hideModal } from './modal.js';

export async function showAddLibraryModal() {
  let selectedPath = '';

  showModal('Add Library Folder', `
    <div class="form-group">
      <label>Folder Path</label>
      <div style="display:flex; gap:8px;">
        <input type="text" id="modal-lib-path" placeholder="Select a folder..." readonly style="flex:1; cursor:pointer; padding:8px 12px; background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-primary); border-radius:var(--radius-sm); font-size:12px; font-family:inherit;">
        <button class="btn btn-secondary" id="modal-browse-folder" style="white-space:nowrap; padding:8px 14px;">Browse...</button>
      </div>
    </div>
    <div class="form-group">
      <label>Ignore Regex <span style="color:var(--text-muted); font-weight:400;">(optional, exclude files/folders)</span></label>
      <input type="text" id="modal-lib-ignore" placeholder="e.g. node_modules|\\.tmp$" style="width:100%; padding:8px 12px; background:var(--bg-input); border:1px solid var(--border-color); color:var(--text-primary); border-radius:var(--radius-sm); font-size:12px; font-family:inherit;">
    </div>
  `, `
    <button class="btn btn-secondary" id="modal-cancel-lib">Cancel</button>
    <button class="btn btn-primary" id="modal-confirm-add-lib">Add Library</button>
  `);

  setTimeout(() => {
    document.getElementById('modal-cancel-lib')?.addEventListener('click', hideModal);
    document.getElementById('modal-browse-folder')?.addEventListener('click', async () => {
      const folder = await window.api.browseFolder();
      if (folder) {
        selectedPath = folder;
        document.getElementById('modal-lib-path').value = folder;
      }
    });
    document.getElementById('modal-confirm-add-lib')?.addEventListener('click', async () => {
      const ignoreRegex = document.getElementById('modal-lib-ignore')?.value || '';
      if (selectedPath) {
        const result = await window.api.addLibrary(selectedPath, ignoreRegex);
        if (result && result.error) { alert(result.error); return; }
        document.dispatchEvent(new CustomEvent('library-added'));
        hideModal();
      }
    });
  }, 50);
}
