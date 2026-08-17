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
const ALL_EXTENSIONS_SET = new Set(ALL_EXTENSIONS);

const CATEGORY_BY_EXT = {};
for (const [category, extensions] of Object.entries(ASSET_EXTENSIONS)) {
  for (const ext of extensions) {
    CATEGORY_BY_EXT[ext] = category;
  }
}

function getAssetCategory(ext) {
  return CATEGORY_BY_EXT[ext.toLowerCase()] || 'other';
}

module.exports = { ASSET_EXTENSIONS, ALL_EXTENSIONS, ALL_EXTENSIONS_SET, getAssetCategory };
