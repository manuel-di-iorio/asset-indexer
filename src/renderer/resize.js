const SIDEBAR_KEY = 'layout.sidebarWidth';
const INSPECTOR_KEY = 'layout.inspectorWidth';

const CONFIG = {
  '--sidebar-width': { min: 180, max: 520, def: 240, key: SIDEBAR_KEY, invert: false },
  '--inspector-width': { min: 260, max: 720, def: 360, key: INSPECTOR_KEY, invert: true }
};

let active = null;

export function initResizeHandles() {
  for (const [varName, cfg] of Object.entries(CONFIG)) {
    const saved = parseInt(localStorage.getItem(cfg.key));
    if (saved) document.documentElement.style.setProperty(varName, saved + 'px');
  }

  const sidebarHandle = document.getElementById('sidebar-resize');
  const inspectorHandle = document.getElementById('inspector-resize');

  const onMove = (e) => {
    if (!active) return;
    e.preventDefault();
    const delta = active.cfg.invert ? -(e.clientX - active.x) : (e.clientX - active.x);
    const width = Math.max(active.cfg.min, Math.min(active.cfg.max, active.start + delta));
    document.documentElement.style.setProperty(active.varName, width + 'px');
    active.current = width;
  };

  const onUp = () => {
    if (!active) return;
    if (active.current) localStorage.setItem(active.cfg.key, String(active.current));
    document.body.classList.remove('resizing');
    active = null;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };

  const attach = (handle, varName) => {
    if (!handle) return;
    const cfg = CONFIG[varName];
    handle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const current = parseInt(document.documentElement.style.getPropertyValue(varName)) || cfg.def;
      active = { varName, cfg, start: current, current, x: e.clientX };
      document.body.classList.add('resizing');
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    handle.addEventListener('dblclick', () => {
      document.documentElement.style.setProperty(varName, cfg.def + 'px');
      localStorage.setItem(cfg.key, String(cfg.def));
    });
  };

  attach(sidebarHandle, '--sidebar-width');
  attach(inspectorHandle, '--inspector-width');
}
