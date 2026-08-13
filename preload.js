const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  browseFolder: () => ipcRenderer.invoke('browse-folder'),
  addLibrary: (dirPath, ignoreRegex) => ipcRenderer.invoke('add-library', dirPath, ignoreRegex),
  getLibraries: () => ipcRenderer.invoke('get-libraries'),
  removeLibrary: (id) => ipcRenderer.invoke('remove-library', id),
  rescanLibrary: (id) => ipcRenderer.invoke('rescan-library', id),
  rescanAll: () => ipcRenderer.invoke('rescan-all'),

  getAssets: (params) => ipcRenderer.invoke('get-assets', params),
  getAssetCount: (params) => ipcRenderer.invoke('get-asset-count', params),
  getAsset: (id) => ipcRenderer.invoke('get-asset', id),
  toggleFavorite: (id) => ipcRenderer.invoke('toggle-favorite', id),
  getFileContent: (path) => ipcRenderer.invoke('get-file-content', path),
  getThumbnail: (path) => ipcRenderer.invoke('get-thumbnail', path),
  getThumbnailsBatch: (paths) => ipcRenderer.invoke('get-thumbnails-batch', paths),

  getTags: () => ipcRenderer.invoke('get-tags'),
  addTag: (name, color) => ipcRenderer.invoke('add-tag', name, color),
  deleteTag: (id) => ipcRenderer.invoke('delete-tag', id),
  renameTag: (id, name, color) => ipcRenderer.invoke('rename-tag', id, name, color),
  addTagToAsset: (assetId, tagId) => ipcRenderer.invoke('add-tag-to-asset', assetId, tagId),
  removeTagFromAsset: (assetId, tagId) => ipcRenderer.invoke('remove-tag-from-asset', assetId, tagId),
  removeTagFromAssets: (assetIds, tagId) => ipcRenderer.invoke('remove-tag-from-assets', assetIds, tagId),
  renameAsset: (assetId, newName) => ipcRenderer.invoke('rename-asset', assetId, newName),
  deleteAssets: (assetIds) => ipcRenderer.invoke('delete-assets', assetIds),

  getCollections: () => ipcRenderer.invoke('get-collections'),
  addCollection: (name, desc) => ipcRenderer.invoke('add-collection', name, desc),
  deleteCollection: (id) => ipcRenderer.invoke('delete-collection', id),
  renameCollection: (id, name, desc) => ipcRenderer.invoke('rename-collection', id, name, desc),
  addAssetToCollection: (assetId, collectionId) => ipcRenderer.invoke('add-asset-to-collection', assetId, collectionId),
  removeAssetFromCollection: (assetId, collectionId) => ipcRenderer.invoke('remove-asset-from-collection', assetId, collectionId),
  removeAssetFromCollections: (assetIds, collectionId) => ipcRenderer.invoke('remove-asset-from-collections', assetIds, collectionId),

  updateAssetMetadata: (assetId, fields) => ipcRenderer.invoke('update-asset-metadata', assetId, fields),
  updateAssetsMetadata: (assetIds, fields) => ipcRenderer.invoke('update-assets-metadata', assetIds, fields),

  exportDatabase: () => ipcRenderer.invoke('export-database'),
  importDatabase: () => ipcRenderer.invoke('import-database'),
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),

  getCategoryCounts: () => ipcRenderer.invoke('get-category-counts'),
  getTotalAssets: () => ipcRenderer.invoke('get-total-assets'),

  openExternal: (path) => ipcRenderer.invoke('open-external', path),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),

  onAssetAdded: (cb) => ipcRenderer.on('asset-added', (e, data) => cb(data)),
  onAssetUpdated: (cb) => ipcRenderer.on('asset-updated', (e, data) => cb(data)),
  onAssetRemoved: (cb) => ipcRenderer.on('asset-removed', (e, data) => cb(data)),
});
