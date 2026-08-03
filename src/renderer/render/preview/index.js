import { escapeHtml, toFileUrl, getCategoryFromExt } from '../../utils.js';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../constants.js';
import { drawWaveform, startWaveformTracking } from './waveform.js';

let currentWaveform = null;

export async function loadPreview(asset) {
  const previewEl = document.getElementById('inspector-preview');
  const category = asset.category || getCategoryFromExt(asset.file_ext);
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS['other'];
  const icon = CATEGORY_ICONS[category] || CATEGORY_ICONS['other'];

  previewEl.innerHTML = `<div class="preview-placeholder" style="color: ${color}">${icon}</div>`;

  const result = await window.api.getFileContent(asset.file_path);
  if (result.error || result.type === 'binary') {
    previewEl.innerHTML = `<div class="preview-placeholder" style="color: ${color}">${icon}</div>`;
    return null;
  }

  if (result.type === 'image') {
    previewEl.innerHTML = `<img class="preview-image" src="${toFileUrl(asset.file_path)}" alt="${escapeHtml(asset.file_name)}">`;
  } else if (result.type === 'audio') {
    const audioId = 'audio-' + Date.now();
    currentWaveform = null;
    previewEl.innerHTML = `
      <div class="preview-audio">
        <div class="preview-waveform" id="${audioId}-waveform"><canvas id="${audioId}-canvas"></canvas><div class="waveform-playhead" id="${audioId}-playhead"></div></div>
        <audio id="${audioId}" controls src="${result.data}"></audio>
      </div>
    `;
    setTimeout(() => {
      const audioEl = document.getElementById(audioId);
      const canvasEl = document.getElementById(`${audioId}-canvas`);
      const waveformEl = document.getElementById(`${audioId}-waveform`);
      if (!audioEl || !canvasEl) return;

      currentWaveform = {
        canvas: canvasEl,
        audio: audioEl,
        playhead: document.getElementById(`${audioId}-playhead`),
        waveformData: null,
        width: 0
      };

      drawWaveform(result.data, `${audioId}-canvas`, currentWaveform);
      startWaveformTracking(currentWaveform);

      if (waveformEl) {
        waveformEl.addEventListener('click', (e) => {
          if (!currentWaveform || !currentWaveform.audio || !currentWaveform.waveformData) return;
          const rect = waveformEl.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const ratio = x / rect.width;
          currentWaveform.audio.currentTime = ratio * currentWaveform.audio.duration;
        });
      }
    }, 100);
  } else if (result.type === 'video') {
    previewEl.innerHTML = `<video class="preview-video" controls src="${result.data}"></video>`;
  } else if (result.type === 'code') {
    previewEl.innerHTML = `<pre class="preview-code">${escapeHtml(result.data)}</pre>`;
  } else if (result.type === 'text') {
    previewEl.innerHTML = `<pre class="preview-text">${escapeHtml(result.data)}</pre>`;
  }

  return result;
}
