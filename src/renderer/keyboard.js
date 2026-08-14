import { state } from './state.js';
import { moveSelection, selectAll, selectFirst, selectLast, clearSelection } from './selection.js';
import { hideContextMenu } from './context-menu.js';
import { openSelectedInExplorer } from './bulk-actions.js';
import { showRenameAssetModal } from './modals/rename-asset.js';
import { toggleDebugMode } from './fps.js';

function isTypingTarget(el) {
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

function isModalOpen() {
  const overlay = document.getElementById('modal-overlay');
  return overlay && overlay.style.display !== 'none';
}

function isContextMenuOpen() {
  const menu = document.getElementById('context-menu');
  return menu && menu.style.display !== 'none';
}

export function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (isModalOpen() || isTypingTarget(e.target)) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      selectAll();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      toggleDebugMode();
      return;
    }

    const ctxOpen = isContextMenuOpen();

    switch (e.key) {
      case 'ArrowUp':
        if (ctxOpen) return;
        e.preventDefault();
        moveSelection(0, -1, e.shiftKey);
        break;
      case 'ArrowDown':
        if (ctxOpen) return;
        e.preventDefault();
        moveSelection(0, 1, e.shiftKey);
        break;
      case 'ArrowLeft':
        if (ctxOpen) return;
        e.preventDefault();
        moveSelection(-1, 0, e.shiftKey);
        break;
      case 'ArrowRight':
        if (ctxOpen) return;
        e.preventDefault();
        moveSelection(1, 0, e.shiftKey);
        break;
      case 'Home':
        if (ctxOpen) return;
        e.preventDefault();
        selectFirst();
        break;
      case 'End':
        if (ctxOpen) return;
        e.preventDefault();
        selectLast();
        break;
      case 'Escape':
        if (ctxOpen) {
          e.preventDefault();
          hideContextMenu();
        } else if (state.selectedAssetIds.length > 0) {
          clearSelection();
        }
        break;
      case 'Enter': {
        const active = document.activeElement;
        if (ctxOpen || (active && active.tagName === 'BUTTON')) return;
        e.preventDefault();
        if (state.selectedAssetIds.length > 0) openSelectedInExplorer();
        break;
      }
      case 'F2': {
        if (ctxOpen) return;
        e.preventDefault();
        if (state.selectedAssetIds.length === 1) showRenameAssetModal();
        break;
      }
    }
  });
}
