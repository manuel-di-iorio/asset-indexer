function drawWaveformBars(ctx, data, width, height, progress) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#7c3aed');
  gradient.addColorStop(1, '#6366f1');

  ctx.clearRect(0, 0, width, height);

  const step = width / data.length;
  const progressX = progress * width;

  for (let i = 0; i < data.length; i++) {
    const barHeight = Math.max(data[i] * height * 2.5, 2);
    const x = i * step;
    ctx.fillStyle = (x + step / 2) < progressX ? '#facc15' : gradient;
    ctx.fillRect(x, (height - barHeight) / 2, Math.max(step - 0.5, 1), barHeight);
  }

  if (progress > 0 && progress < 1) {
    ctx.fillStyle = '#facc15';
    ctx.fillRect(progressX - 1, 0, 2, height);
  }
}

function updateWaveformPlayhead(waveformState) {
  if (!waveformState || !waveformState.audio || !waveformState.waveformData) return;
  const audio = waveformState.audio;
  if (audio.paused) return;
  if (audio.duration && audio.duration > 0) {
    const progress = audio.currentTime / audio.duration;
    drawWaveformBars(
      waveformState.ctx,
      waveformState.waveformData,
      waveformState.width,
      waveformState.height,
      progress
    );
  }
  if (!audio.paused) requestAnimationFrame(() => updateWaveformPlayhead(waveformState));
}

export function startWaveformTracking(waveformState) {
  if (!waveformState || !waveformState.audio) return;
  const audio = waveformState.audio;
  audio.addEventListener('play', () => requestAnimationFrame(() => updateWaveformPlayhead(waveformState)));
  audio.addEventListener('pause', () => {
    if (waveformState && waveformState.audio && waveformState.waveformData) {
      const progress = waveformState.audio.duration ? waveformState.audio.currentTime / waveformState.audio.duration : 0;
      drawWaveformBars(waveformState.ctx, waveformState.waveformData, waveformState.width, waveformState.height, progress);
    }
  });
  audio.addEventListener('seeked', () => updateWaveformPlayhead(waveformState));
}

export async function drawWaveform(audioDataUrl, canvasId, waveformState) {
  try {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const parentEl = canvas.parentElement;
    if (!parentEl) return;

    const width = parentEl.clientWidth || 300;
    const height = 60;
    canvas.width = width * 2;
    canvas.height = height * 2;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    let arrayBuffer;
    if (audioDataUrl.startsWith('data:')) {
      const base64 = audioDataUrl.split(',')[1];
      const binaryStr = atob(base64);
      arrayBuffer = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        arrayBuffer[i] = binaryStr.charCodeAt(i);
      }
      arrayBuffer = arrayBuffer.buffer;
    } else {
      const response = await fetch(audioDataUrl);
      arrayBuffer = await response.arrayBuffer();
    }

    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const rawData = audioBuffer.getChannelData(0);
    const samples = Math.min(width, 200);
    const blockSize = Math.floor(rawData.length / samples);
    const filteredData = [];
    for (let i = 0; i < samples; i++) {
      let sum = 0;
      const start = i * blockSize;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[start + j] || 0);
      }
      filteredData.push(sum / (blockSize || 1));
    }

    if (waveformState) {
      waveformState.waveformData = filteredData;
      waveformState.width = width;
      waveformState.height = height;
      waveformState.ctx = ctx;
    }

    drawWaveformBars(ctx, filteredData, width, height, 0);

    audioCtx.close();
  } catch (e) {
    console.log('Waveform error:', e);
  }
}
