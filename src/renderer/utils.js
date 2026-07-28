export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function getCategoryFromExt(ext) {
  const map = {
    '.fbx': '3d-models', '.obj': '3d-models', '.gltf': '3d-models', '.glb': '3d-models',
    '.blend': '3d-models', '.3ds': '3d-models', '.dae': '3d-models', '.stl': '3d-models', '.ply': '3d-models',
    '.png': 'images', '.jpg': 'images', '.jpeg': 'images', '.tga': 'images', '.tiff': 'images',
    '.tif': 'images', '.bmp': 'images', '.gif': 'images', '.psd': 'images', '.hdr': 'images',
    '.exr': 'images', '.dds': 'images', '.ktx': 'images', '.webp': 'images', '.ico': 'images',
    '.mat': 'materials', '.material': 'materials', '.shader': 'materials',
    '.wav': 'audio', '.mp3': 'audio', '.ogg': 'audio', '.flac': 'audio',
    '.aiff': 'audio', '.m4a': 'audio', '.wma': 'audio',
    '.cs': 'scripts', '.js': 'scripts', '.ts': 'scripts', '.py': 'scripts',
    '.lua': 'scripts', '.cpp': 'scripts', '.h': 'scripts',
    '.mp4': 'videos', '.avi': 'videos', '.mov': 'videos', '.wmv': 'videos', '.mkv': 'videos', '.webm': 'videos',
    '.pdf': 'documents', '.doc': 'documents', '.docx': 'documents', '.txt': 'documents', '.md': 'documents', '.rtf': 'documents'
  };
  return map[ext] || 'other';
}

export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function toFileUrl(filePath) {
  return 'file:///' + filePath.replace(/\\/g, '/');
}
