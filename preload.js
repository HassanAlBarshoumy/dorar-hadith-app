const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    fetchDorar: (url) => ipcRenderer.invoke('fetch-dorar', url),
    searchLocalDb: (query) => ipcRenderer.invoke('search-local-db', query),
    logError: (msg) => ipcRenderer.send('log-error', msg),
    showNotification: (options) => ipcRenderer.send('show-notification', options),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settingsStr) => ipcRenderer.invoke('save-settings', settingsStr)
});
