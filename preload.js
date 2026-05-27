const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    fetchDorar: (url) => ipcRenderer.invoke('fetch-dorar', url)
});
