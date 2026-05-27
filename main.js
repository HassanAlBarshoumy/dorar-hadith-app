const { app, BrowserWindow, session, ipcMain, net } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    title: 'الموسوعة الحديثية',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'icon.ico') // Optional icon
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile('index.html');
}

// Secure IPC Fetch Handler to bypass CORS on behalf of the renderer
ipcMain.handle('fetch-dorar', async (event, url) => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.text();
  } catch (err) {
    throw err;
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
