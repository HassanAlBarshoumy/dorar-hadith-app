const { app, BrowserWindow, session, ipcMain, net } = require('electron');
const path = require('path');
const fs = require('fs');

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.text();
  } catch (err) {
    throw err;
  }
});

ipcMain.on('log-error', (event, msg) => {
  try {
    const logPath = path.join(app.getPath('userData'), 'error_log.txt');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
  } catch(e) {
    console.error("Failed to write to error log:", e);
  }
});

const { Notification } = require('electron');
ipcMain.on('show-notification', (event, options) => {
  try {
    if (Notification.isSupported()) {
      delete options.icon; // Remove icon to avoid path issues if it doesn't exist
      const notification = new Notification(options);
      notification.on('failed', (err, error) => {
        const logPath = path.join(app.getPath('userData'), 'error_log.txt');
        fs.appendFileSync(logPath, `Notification Failed: ${error}\n`);
      });
      notification.show();
    } else {
      const logPath = path.join(app.getPath('userData'), 'error_log.txt');
      fs.appendFileSync(logPath, `Notification is not supported on this OS.\n`);
    }
  } catch(e) {
    const logPath = path.join(app.getPath('userData'), 'error_log.txt');
    fs.appendFileSync(logPath, `Notification crash: ${e.message}\n`);
  }
});

ipcMain.handle('get-settings', async () => {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'dorar_settings.json');
    if (fs.existsSync(settingsPath)) {
      return fs.readFileSync(settingsPath, 'utf8');
    }
  } catch(e) {
    console.error(e);
  }
  return null;
});

ipcMain.handle('save-settings', async (event, settingsStr) => {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'dorar_settings.json');
    fs.writeFileSync(settingsPath, settingsStr, 'utf8');
    return true;
  } catch(e) {
    console.error(e);
    return false;
  }
});

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId("com.dorar.hadith");
  }
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
