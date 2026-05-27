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
ipcMain.handle('fetch-dorar', async (event, targetUrl) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout

    let response;
    try {
      response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error('Direct fetch failed with status: ' + response.status);
      return await response.text();
    } catch (directErr) {
      clearTimeout(timeoutId);
      // Fallback to proxy
      const proxyUrl = "https://api.allorigins.win/get?url=" + encodeURIComponent(targetUrl);
      const proxyController = new AbortController();
      const proxyTimeoutId = setTimeout(() => proxyController.abort(), 10000);
      
      const proxyResponse = await fetch(proxyUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: proxyController.signal
      });
      clearTimeout(proxyTimeoutId);
      if (!proxyResponse.ok) throw new Error('Proxy fetch failed');
      const proxyData = await proxyResponse.json();
      if (proxyData && proxyData.contents) {
        return proxyData.contents;
      }
      throw new Error('Proxy returned empty contents');
    }
  } catch (err) {
    const logPath = path.join(app.getPath('userData'), 'error_log.txt');
    fs.appendFileSync(logPath, `Fetch Error: ${err.message}\n`);
    throw err;
  }
});

let db = null;
ipcMain.handle('search-local-db', async (event, query) => {
  try {
    if (!db) {
      const Database = require('better-sqlite3');
      // In production, the DB should be inside the resources folder
      const dbPath = app.isPackaged 
        ? path.join(process.resourcesPath, 'local_hadith.db')
        : path.join(__dirname, 'local_hadith.db');
        
      if (fs.existsSync(dbPath)) {
        db = new Database(dbPath, { readonly: true });
      } else {
        throw new Error('Database file not found: ' + dbPath);
      }
    }

    const stmt = db.prepare(`
      SELECT book, text_ar, authenticity FROM ahadith 
      WHERE text_ar LIKE ? 
      LIMIT 50
    `);
    const rows = stmt.all('%' + query + '%');
    
    return JSON.stringify(rows.map(row => ({
      book: row.book,
      text: row.text_ar,
      authenticity: row.authenticity
    })));
  } catch (err) {
    const logPath = path.join(app.getPath('userData'), 'error_log.txt');
    fs.appendFileSync(logPath, `DB Search Error: ${err.message}\n`);
    return JSON.stringify([]);
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
