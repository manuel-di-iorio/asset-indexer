const ASSET_EXTENSIONS = {
  '3d-models': ['.fbx', '.obj', '.gltf', '.glb', '.blend', '.3ds', '.dae', '.stl', '.ply'],
  'images': ['.png', '.jpg', '.jpeg', '.tga', '.tiff', '.tif', '.bmp', '.gif', '.psd', '.hdr', '.exr', '.dds', '.ktx', '.webp', '.ico'],
  'materials': ['.mat', '.material', '.shader', '.mtl'],
  'audio': ['.wav', '.mp3', '.ogg', '.flac', '.aiff', '.m4a', '.wma'],
  'scripts': ['.cs', '.js', '.ts', '.py', '.lua', '.cpp', '.h'],
  'videos': ['.mp4', '.avi', '.mov', '.wmv', '.mkv', '.webm'],
  'documents': ['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf']
};

const ALL_EXTENSIONS = Object.values(ASSET_EXTENSIONS).flat();

function getAssetCategory(ext) {
  const lower = ext.toLowerCase();
  for (const [category, extensions] of Object.entries(ASSET_EXTENSIONS)) {
    if (extensions.includes(lower)) return category;
  }
  return 'other';
}

module.exports = { ASSET_EXTENSIONS, ALL_EXTENSIONS, getAssetCategory };
