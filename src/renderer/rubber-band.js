import { state } from './state.js';
import { syncSelection } from './selection.js';

let grid = null;
let active = false;
let moved = false;
let bandConsumed = false;
let startX = 0;
let startY = 0;
let lastClientX = 0;
let lastClientY = 0;
let lastMods = { shift: false, ctrl: false };
let bandRect = null;
let cardCache = null;
let rafId = null;

const EDGE_MARGIN = 48;
const MAX_SCROLL = 24;

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

function normalizeBand(x1, y1, x2, y2) {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    right: Math.max(x1, x2),
    bottom: Math.max(y1, y2)
  };
}

function clampBand(rect) {
  const maxRight = Math.max(grid.scrollWidth, 0);
  const maxBottom = Math.max(grid.scrollHeight, 0);
  return {
    left: Math.max(0, Math.min(rect.left, maxRight)),
    top: Math.max(0, Math.min(rect.top, maxBottom)),
    right: Math.max(0, Math.min(rect.right, maxRight)),
    bottom: Math.max(0, Math.min(rect.bottom, maxBottom))
  };
}

function applyBand(rect) {
  const band = getBand();
  band.style.left = rect.left + 'px';
  band.style.top = rect.top + 'px';
  band.style.width = (rect.right - rect.left) + 'px';
  band.style.height = (rect.bottom - rect.top) + 'px';
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

function updatePreview(mods) {
  if (!cardCache || !bandRect) return;
  const ctrl = mods.ctrl;
  cardCache.forEach(({ id, el, rect }) => {
    let on = false;
    if (intersects(bandRect, rect)) {
      if (ctrl || mods.shift) on = !state.selectedAssetIds.includes(id);
      else on = true;
    }
    el.classList.toggle('rubber-target', on);
  });
}

function scrollFrame() {
  if (!active) { rafId = null; return; }
  if (moved) {
    const r = grid.getBoundingClientRect();
    let dx = 0, dy = 0;
    if (lastClientY < r.top + EDGE_MARGIN) dy = -((r.top + EDGE_MARGIN - lastClientY) / EDGE_MARGIN) * MAX_SCROLL;
    else if (lastClientY > r.bottom - EDGE_MARGIN) dy = ((lastClientY - (r.bottom - EDGE_MARGIN)) / EDGE_MARGIN) * MAX_SCROLL;
    if (lastClientX < r.left + EDGE_MARGIN) dx = -((r.left + EDGE_MARGIN - lastClientX) / EDGE_MARGIN) * MAX_SCROLL;
    else if (lastClientX > r.right - EDGE_MARGIN) dx = ((lastClientX - (r.right - EDGE_MARGIN)) / EDGE_MARGIN) * MAX_SCROLL;
    if (dx !== 0 || dy !== 0) {
      const maxTop = Math.max(grid.scrollHeight - grid.clientHeight, 0);
      const maxLeft = Math.max(grid.scrollWidth - grid.clientWidth, 0);
      grid.scrollLeft = Math.min(Math.max(grid.scrollLeft + dx, 0), maxLeft);
      grid.scrollTop = Math.min(Math.max(grid.scrollTop + dy, 0), maxTop);
      const p = contentPos(lastClientX, lastClientY);
      bandRect = clampBand(normalizeBand(startX, startY, p.x, p.y));
      applyBand(bandRect);
      updatePreview(lastMods);
    }
  }
  rafId = requestAnimationFrame(scrollFrame);
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
    const r = grid.getBoundingClientRect();
    if (grid.scrollHeight > grid.clientHeight + 1 && e.clientX >= r.right - 12) return;
    if (grid.scrollWidth > grid.clientWidth + 1 && e.clientY >= r.bottom - 12) return;
    e.preventDefault();
    active = true;
    moved = false;
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    lastMods = { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey };
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
    rafId = requestAnimationFrame(scrollFrame);
  });

  grid.addEventListener('pointermove', (e) => {
    if (!active) return;
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    lastMods = { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey };
    const p = contentPos(e.clientX, e.clientY);
    bandRect = clampBand(normalizeBand(startX, startY, p.x, p.y));
    applyBand(bandRect);
    if (!moved && (Math.abs(p.x - startX) > 3 || Math.abs(p.y - startY) > 3)) moved = true;
    updatePreview(lastMods);
  });

  grid.addEventListener('pointerup', (e) => {
    if (!active) return;
    const rect = bandRect;
    const cache = cardCache;
    const mods = lastMods;
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
      if (mods.ctrl) {
        ids.forEach(id => {
          const idx = state.selectedAssetIds.indexOf(id);
          if (idx >= 0) state.selectedAssetIds.splice(idx, 1);
          else state.selectedAssetIds.push(id);
        });
      } else if (mods.shift) {
        ids.forEach(id => {
          if (!state.selectedAssetIds.includes(id)) state.selectedAssetIds.push(id);
        });
      } else {
        state.selectedAssetIds = ids.slice();
      }
      state.focusedAssetId = ids[ids.length - 1];
      syncSelection();
    } else if (!mods.shift && !mods.ctrl) {
      state.selectedAssetIds = [];
      state.focusedAssetId = null;
      syncSelection();
    }
  });

  grid.addEventListener('pointercancel', resetBand);
}
