import { state } from './state.js';
import { syncSelection } from './selection.js';

let grid = null;
let active = false;
let moved = false;
let bandConsumed = false;
let startX = 0;
let startY = 0;
let bandRect = null;
let cardCache = null;

function getBand() {
  let el = document.getElementById('rubber-band');
  if (!el) {
    el = document.createElement('div');
    el.id = 'rubber-band';
    el.className = 'rubber-band';
    grid.appendChild(el);
  }
  return el;
}

function contentPos(clientX, clientY) {
  const r = grid.getBoundingClientRect();
  return { x: clientX - r.left + grid.scrollLeft, y: clientY - r.top + grid.scrollTop };
}

function cardContentRect(card) {
  const r = grid.getBoundingClientRect();
  const cr = card.getBoundingClientRect();
  return {
    left: cr.left - r.left + grid.scrollLeft,
    top: cr.top - r.top + grid.scrollTop,
    right: cr.right - r.left + grid.scrollLeft,
    bottom: cr.bottom - r.top + grid.scrollTop
  };
}

function intersects(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function buildCardCache() {
  cardCache = [];
  grid.querySelectorAll('.asset-card').forEach(card => {
    cardCache.push({ id: parseInt(card.dataset.id), el: card, rect: cardContentRect(card) });
  });
}

function clearPreview() {
  if (cardCache) cardCache.forEach(({ el }) => el.classList.remove('rubber-target'));
}

function updatePreview(e) {
  if (!cardCache || !bandRect) return;
  const ctrl = e.ctrlKey || e.metaKey;
  cardCache.forEach(({ id, el, rect }) => {
    let on = false;
    if (intersects(bandRect, rect)) {
      if (ctrl || e.shiftKey) on = !state.selectedAssetIds.includes(id);
      else on = true;
    }
    el.classList.toggle('rubber-target', on);
  });
}

function resetBand() {
  active = false;
  moved = false;
  bandRect = null;
  clearPreview();
  cardCache = null;
  grid.classList.remove('rubber-dragging');
  const band = getBand();
  band.style.display = 'none';
}

export function consumeRubberSelect() {
  const v = bandConsumed;
  bandConsumed = false;
  return v;
}

export function initRubberBand() {
  grid = document.getElementById('asset-grid');
  if (!grid) return;

  grid.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.asset-card')) return;
    e.preventDefault();
    active = true;
    moved = false;
    buildCardCache();
    const p = contentPos(e.clientX, e.clientY);
    startX = p.x;
    startY = p.y;
    grid.classList.add('rubber-dragging');
    const band = getBand();
    band.style.display = 'block';
    band.style.left = startX + 'px';
    band.style.top = startY + 'px';
    band.style.width = '0px';
    band.style.height = '0px';
    try { grid.setPointerCapture(e.pointerId); } catch (err) {}
  });

  grid.addEventListener('pointermove', (e) => {
    if (!active) return;
    const p = contentPos(e.clientX, e.clientY);
    const left = Math.min(startX, p.x);
    const top = Math.min(startY, p.y);
    const right = Math.max(startX, p.x);
    const bottom = Math.max(startY, p.y);
    bandRect = { left, top, right, bottom };
    const band = getBand();
    band.style.left = left + 'px';
    band.style.top = top + 'px';
    band.style.width = (right - left) + 'px';
    band.style.height = (bottom - top) + 'px';
    if (!moved && (Math.abs(p.x - startX) > 3 || Math.abs(p.y - startY) > 3)) moved = true;
    updatePreview(e);
  });

  grid.addEventListener('pointerup', (e) => {
    if (!active) return;
    const rect = bandRect;
    const cache = cardCache;
    if (!moved || !rect || !cache) {
      resetBand();
      return;
    }
    const ids = [];
    cache.forEach(({ id, rect: r }) => {
      if (intersects(rect, r)) ids.push(id);
    });
    resetBand();

    bandConsumed = true;

    if (ids.length > 0) {
      if (e.ctrlKey || e.metaKey) {
        ids.forEach(id => {
          const idx = state.selectedAssetIds.indexOf(id);
          if (idx >= 0) state.selectedAssetIds.splice(idx, 1);
          else state.selectedAssetIds.push(id);
        });
      } else if (e.shiftKey) {
        ids.forEach(id => {
          if (!state.selectedAssetIds.includes(id)) state.selectedAssetIds.push(id);
        });
      } else {
        state.selectedAssetIds = ids.slice();
      }
      state.focusedAssetId = ids[ids.length - 1];
      syncSelection();
    } else if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      state.selectedAssetIds = [];
      state.focusedAssetId = null;
      syncSelection();
    }
  });

  grid.addEventListener('pointercancel', resetBand);
}
