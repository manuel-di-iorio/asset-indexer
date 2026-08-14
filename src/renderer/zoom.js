const UI_ZOOM_KEY = 'ui-zoom';
const TEXT_ZOOM_KEY = 'text-zoom';

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2;

function clamp(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, num));
}

export function applyUiZoom(value) {
  const zoom = clamp(value);
  document.body.style.zoom = String(zoom);
  document.documentElement.style.setProperty('--ui-zoom', String(zoom));
  try { localStorage.setItem(UI_ZOOM_KEY, String(zoom)); } catch (e) {}
  return zoom;
}

export function applyTextZoom(value) {
  const zoom = clamp(value);
  document.documentElement.style.setProperty('--text-zoom', String(zoom));
  try { localStorage.setItem(TEXT_ZOOM_KEY, String(zoom)); } catch (e) {}
  return zoom;
}

export function getUiZoom() {
  try { return clamp(localStorage.getItem(UI_ZOOM_KEY) || 1); } catch (e) { return 1; }
}

export function getTextZoom() {
  try { return clamp(localStorage.getItem(TEXT_ZOOM_KEY) || 1); } catch (e) { return 1; }
}

export function initZoom() {
  applyUiZoom(getUiZoom());
  applyTextZoom(getTextZoom());
}
