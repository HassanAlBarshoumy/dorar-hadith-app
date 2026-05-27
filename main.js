const { app, BrowserWindow, session } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    title: 'الموسوعة الحديثية',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false // تخطي حماية CORS للاتصال بموقع الدرر السنية
    },
    icon: path.join(__dirname, 'icon.ico') // Optional icon
  });

  // تعيين User-Agent ليبدو كمتصفح طبيعي تماماً
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile('index.html');
}

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
