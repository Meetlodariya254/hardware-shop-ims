const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const http = require('http');

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow;

  // Handle second instance — focus existing window
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // ─── Create the main window ──────────────────────────────────────────────────
  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 860,
      show: false,
      title: 'Hardware Shop IMS',
      backgroundColor: '#0f172a',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    mainWindow.setMenuBarVisibility(false);

    // Show loading screen immediately
    mainWindow.loadURL(
      'data:text/html,<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Loading...</title>' +
      '<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0f172a;display:flex;' +
      'flex-direction:column;align-items:center;justify-content:center;height:100vh;' +
      'font-family:system-ui,sans-serif;color:#f1f5f9}.logo{font-size:3rem;margin-bottom:1rem}' +
      '.title{font-size:1.5rem;font-weight:700;margin-bottom:.5rem}' +
      '.subtitle{font-size:.9rem;color:#94a3b8;margin-bottom:2rem}' +
      '.dots{display:flex;gap:.5rem}.dot{width:.75rem;height:.75rem;border-radius:50%;' +
      'background:#3b82f6;animation:pulse 1.4s ease-in-out infinite}' +
      '.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}' +
      '@keyframes pulse{0%,80%,100%{opacity:.3;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}' +
      '</style></head><body><div class="logo">🔧</div><div class="title">Hardware Shop IMS</div>' +
      '<div class="subtitle">Starting application, please wait...</div>' +
      '<div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>' +
      '</body></html>'
    );

    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  // ─── Poll backend until ready, then load the app ────────────────────────────
  function waitForBackendAndLoad(url, retries = 60) {
    http.get(url, () => {
      if (mainWindow) {
        mainWindow.loadURL(url).catch((err) => console.error('Failed to load app:', err));
      }
    }).on('error', () => {
      if (retries <= 0) {
        console.error('Backend did not start in time.');
        if (mainWindow) {
          mainWindow.loadURL(
            'data:text/html,<!DOCTYPE html><html><body style="background:#0f172a;color:#f87171;' +
            'display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui">' +
            '<div style="text-align:center"><h1>⚠️ Startup Error</h1>' +
            '<p>The backend server failed to start. Please restart the app.</p></div></body></html>'
          );
        }
        return;
      }
      setTimeout(() => waitForBackendAndLoad(url, retries - 1), 500);
    });
  }

  // ─── App lifecycle ────────────────────────────────────────────────────────────
  app.whenReady().then(async () => {
    // Clear cache so the latest frontend build is always loaded
    try {
      await require('electron').session.defaultSession.clearCache();
    } catch (e) {
      console.warn('Cache clear failed (non-fatal):', e.message);
    }

    // Create window first so user sees something immediately
    createWindow();

    // Start the embedded backend
    try {
      process.env.EMBEDDED_IN_ELECTRON = '1';
      const { startServer } = require('./backend/src/index.js');
      await startServer();
      console.log('✅ Backend started successfully');
    } catch (err) {
      console.error('❌ Backend failed to start:', err.message);
      dialog.showErrorBox(
        'Startup Error',
        `The application backend failed to start:\n\n${err.message}\n\nPlease restart the app.`
      );
      return;
    }

    // Backend is ready — load the real app
    waitForBackendAndLoad('http://localhost:5000');

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
        waitForBackendAndLoad('http://localhost:5000');
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
