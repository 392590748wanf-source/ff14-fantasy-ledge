const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs/promises');
const path = require('node:path');

const APP_ICON = path.join(__dirname, '..', 'build', 'icon.ico');
const BACKUP_FORMAT = 'ff14-fantasy-backup';
const BACKUP_VERSION = 1;
const BACKUP_KEYS = new Set([
  'ff14-770',
  'ff14-material-state',
  'ff14-material-purchases',
  'ff14-fantasy-prices',
  'ff14-submarine-ticket-settings',
  'ff14-other-material-ids',
  'ff14-submarine-stocks',
  'ff14-submarine-sales',
  'ff14-submarine-suite-sales',
  'ff14-submarine-operations',
  'ff14-submarine-npc-materials',
  'ff14-submarine-suites',
  'ff14-market-refreshed-at'
]);

let mainWindow;

const sendUpdateStatus = status => {
  BrowserWindow.getAllWindows().forEach(window => window.webContents.send('updater:status', status));
};

const normalizeBackup = backup => {
  if (!backup || backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION || !backup.storage || Array.isArray(backup.storage)) {
    throw new Error('备份文件格式不正确，或版本不受支持。');
  }
  const storage = {};
  Object.entries(backup.storage).forEach(([key, value]) => {
    if (!BACKUP_KEYS.has(key) || typeof value !== 'string') throw new Error('备份文件包含无效数据。');
    storage[key] = value;
  });
  if (!Object.keys(storage).length) throw new Error('备份文件中没有可恢复的账本数据。');
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: backup.exportedAt || '', storage };
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    title: '金蝶幻想',
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:')) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });
};

const configureAutoUpdater = () => {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => sendUpdateStatus({ state: 'checking', message: '正在检查客户端更新…' }));
  autoUpdater.on('update-available', info => sendUpdateStatus({ state: 'available', version: info.version, message: `发现新版本 ${info.version}，正在下载…` }));
  autoUpdater.on('update-not-available', () => sendUpdateStatus({ state: 'latest', message: '当前已是最新版本。' }));
  autoUpdater.on('download-progress', progress => sendUpdateStatus({ state: 'downloading', percent: Math.round(progress.percent || 0), message: `正在下载更新：${Math.round(progress.percent || 0)}%` }));
  autoUpdater.on('update-downloaded', info => sendUpdateStatus({ state: 'downloaded', version: info.version, message: `新版本 ${info.version} 已下载，可重启安装。` }));
  autoUpdater.on('error', error => sendUpdateStatus({ state: 'error', message: `更新检查失败：${error.message}` }));
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 2500);
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 60 * 60 * 1000);
};

ipcMain.handle('backup:export', async (_event, rawBackup) => {
  const backup = normalizeBackup(rawBackup);
  const date = new Date().toISOString().slice(0, 10);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出金蝶幻想账本备份',
    defaultPath: `ff14-fantasy-backup-${date}.json`,
    filters: [{ name: '金蝶幻想备份', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await fs.writeFile(result.filePath, JSON.stringify(backup, null, 2), 'utf8');
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle('backup:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入金蝶幻想账本备份',
    properties: ['openFile'],
    filters: [{ name: '金蝶幻想备份', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  try {
    return { canceled: false, backup: normalizeBackup(JSON.parse(await fs.readFile(result.filePaths[0], 'utf8'))) };
  } catch (error) {
    return { canceled: false, error: error.message || '无法读取备份文件。' };
  }
});

ipcMain.handle('updater:check', async () => {
  if (!app.isPackaged) return { available: false, message: '开发模式下不检查更新。' };
  try {
    await autoUpdater.checkForUpdates();
    return { available: true };
  } catch (error) {
    return { available: false, message: error.message || '更新检查失败。' };
  }
});

ipcMain.handle('updater:restart', () => {
  if (app.isPackaged) autoUpdater.quitAndInstall();
});

app.whenReady().then(() => {
  createWindow();
  configureAutoUpdater();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
