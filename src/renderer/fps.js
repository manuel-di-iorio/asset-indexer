let overlay = null;
let active = false;
let lastTime = 0;
let frameCount = 0;
let rafId = null;

function tick(time) {
  frameCount++;
  if (time - lastTime >= 500) {
    const fps = Math.round(frameCount * 1000 / (time - lastTime));
    overlay.textContent = `${fps} FPS`;
    overlay.style.color = fps >= 55 ? 'var(--green)' : fps >= 30 ? 'var(--yellow)' : 'var(--red)';
    lastTime = time;
    frameCount = 0;
  }
  if (active) rafId = requestAnimationFrame(tick);
}

export function toggleDebugMode() {
  active = !active;
  if (active) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'fps-overlay';
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'block';
    lastTime = performance.now();
    frameCount = 0;
    rafId = requestAnimationFrame(tick);
  } else {
    if (overlay) overlay.style.display = 'none';
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }
}
