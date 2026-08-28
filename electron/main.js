import { app, BrowserWindow, session, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import loginController from '../backend/features/login/login.controller.js';
import logoutController from '../backend/features/logout/logout.controller.js';
import hardwareFingerprintController from '../backend/features/security/hardware-fingerprint/hardware-fingerprint.controller.js';
import jwtTokenController from '../backend/features/security/jwt-token/jwt-token.controller.js';
import dbPool from '../backend/database/pool.js';
import MandorBackend from '../backend/infrastructure/ipc/mandor-backend.js';
import mandorFrontend from '../backend/infrastructure/ipc/mandor-frontend.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mainWindow = null;
let dashboardWindow = null;
let currentSessionRole = 'user';
let currentSessionUserId = null;
let currentSessionUsername = '';
let currentSessionId = null;
let internalAccessToken = '';
let internalRefreshToken = '';
let tokenExpirationTime = 0;
let expressServerInstance = null;
let isRefreshingTokens = false;

const normalizeRole = (role) => String(role || 'user').trim().toLowerCase().replace(/\s+/g, '');

const syncCurrentUserFromDatabase = async (userId, sessionId = currentSessionId) => {
  const result = await dbPool.query(`SELECT id, username, role FROM login WHERE id = $1 LIMIT 1`, [userId]);
  if (result.rowCount !== 1) return false;
  currentSessionUserId = Number(result.rows[0].id);
  currentSessionUsername = String(result.rows[0].username || '');
  currentSessionRole = normalizeRole(result.rows[0].role);
  currentSessionId = sessionId ? Number(sessionId) : currentSessionId;
  return true;
};

const checkSecurityGate = async () => {
  if (!internalAccessToken || !currentSessionUserId) return false;
  try {
    const check = jwtTokenController.validateActiveToken(internalAccessToken);
    if (check.success) return await syncCurrentUserFromDatabase(check.user.id, check.user.sessionId);

    if (check.expired && internalRefreshToken && !isRefreshingTokens) {
      isRefreshingTokens = true;
      const rotated = await jwtTokenController.rotateSessionToken(internalRefreshToken, { userAgent: 'electron', ipAddress: null });
      if (rotated.success) {
        internalAccessToken = rotated.accessToken;
        internalRefreshToken = rotated.refreshToken;
        tokenExpirationTime = rotated.expiresAt;
        const verified = jwtTokenController.validateActiveToken(internalAccessToken);
        if (verified.success) return await syncCurrentUserFromDatabase(verified.user.id, verified.user.sessionId);
      }
    }
  } catch (error) {
    console.error(`[KERNEL_GATE_ERROR] ${error.message}`);
  } finally {
    isRefreshingTokens = false;
  }
  return false;
};

const clearSensitiveSessionData = async () => {
  try {
    await session.defaultSession.clearStorageData({ storages: ['cookies', 'localstorage', 'websql', 'indexeddb', 'serviceworkers', 'cachestorage'] });
    await session.defaultSession.clearCache();
  } catch (error) {
    console.error(`[KERNEL_CLEAN_FATAL] ${error.message}`);
    process.exit(1);
  }
};

const resetSessionState = () => {
  currentSessionRole = 'user';
  currentSessionUserId = null;
  currentSessionUsername = '';
  currentSessionId = null;
  internalAccessToken = '';
  internalRefreshToken = '';
  tokenExpirationTime = 0;
};

const createDashboardWindow = async () => {
  const rootPath = app.getAppPath();
  dashboardWindow = new BrowserWindow({
    width: 1400, height: 900, fullscreen: false, autoHideMenuBar: true,
    title: 'Enterprise Invest - Dashboard Master',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload: path.join(rootPath, 'electron', 'preloads', 'dashboard.preload.js') }
  });
  dashboardWindow.setMenu(null);
  dashboardWindow.setContentProtection(true);
  dashboardWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  dashboardWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  dashboardWindow.webContents.on('devtools-opened', () => dashboardWindow.webContents.closeDevTools());
  await dashboardWindow.loadFile(path.join(rootPath, 'frontend', 'main.html'));
  dashboardWindow.on('closed', () => { dashboardWindow = null; });
};

const createWindow = async () => {
  const rootPath = app.getAppPath();
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, fullscreen: false, autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preloads', 'login.preload.js') }
  });
  mainWindow.setMenu(null);
  mainWindow.setContentProtection(true);
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self';"] } });
  });
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('devtools-opened', () => mainWindow.webContents.closeDevTools());
  await mainWindow.loadFile(path.join(rootPath, 'frontend', 'pages', 'login', 'login.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
};

const initApp = async () => {
  await app.whenReady();
  await clearSensitiveSessionData();
  try { expressServerInstance = MandorBackend.inisialisasiExpressServer(); } catch (error) { console.error(`[KERNEL_EXPRESS_BOOT_ERROR] ${error.message}`); }
  if (process.env.APP_MODE !== 'SERVER_VPS' && !process.argv.includes('--headless')) await createWindow();

  const handleBackend = async (event, payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Struktur IPC tidak valid.');
    const { action, data } = payload;

    if (action === 'LOGIN_ATTEMPT') {
      try {
        const fp = hardwareFingerprintController.getSecureFingerprint();
        if (!fp?.success) return { success: false, error: 'Perangkat gagal diverifikasi.' };
        const response = await loginController.handleLoginRequest({ ...data, fingerprint: fp.data.fingerprint });
        if (!response?.success || !response.user) return response;
        const jwtIssue = await jwtTokenController.issueSessionToken(response.user, { deviceFingerprint: fp.data.fingerprint });
        if (!jwtIssue.success) return { success: false, error: 'Login berhasil tetapi sesi gagal dibuat.' };
        internalAccessToken = jwtIssue.accessToken;
        internalRefreshToken = jwtIssue.refreshToken;
        tokenExpirationTime = jwtIssue.expiresAt;
        const decoded = jwtTokenController.validateActiveToken(internalAccessToken);
        if (!decoded.success || !await syncCurrentUserFromDatabase(response.user.id, decoded.user.sessionId)) { resetSessionState(); return { success: false, error: 'Sesi user tidak ditemukan.' }; }
        setTimeout(async () => {
          try {
            await createDashboardWindow();
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
            mainWindow = null;
          } catch (error) { console.error(`[KERNEL_WINDOW_ERROR] ${error.message}`); }
        }, 2000);
        return response;
      } catch (error) {
        console.error(`[KERNEL_LOGIN_ERROR] ${error.message}`);
        return { success: false, error: 'Kegagalan internal login backend.' };
      }
    }

    if (!await checkSecurityGate()) return { success: false, code: 'SESSION_EXPIRED', error: 'Sesi habis atau sudah dicabut.' };
    const result = await MandorBackend.eksekusiAksiSpesifik(action, data, currentSessionRole);
    if (result?.status === 'trigger_kernel_logout') {
      if (currentSessionId) await jwtTokenController.revokeSessionById(currentSessionId);
      await clearSensitiveSessionData();
      resetSessionState();
      if (process.env.APP_MODE !== 'SERVER_VPS' && !process.argv.includes('--headless')) await createWindow();
      if (dashboardWindow && !dashboardWindow.isDestroyed()) dashboardWindow.destroy();
      dashboardWindow = null;
      return { success: true };
    }
    return result;
  };

  ipcMain.handle('secure-channel', handleBackend);

  ipcMain.handle('saluran-mandor', async (event, command) => {
    if (!command || typeof command !== 'object' || Array.isArray(command)) return { status: 'ERROR', pesan: 'Format instruksi database tidak sah.' };
    if (!await checkSecurityGate()) return { status: 'ERROR', pesan: 'Akses Ditolak! Sesi ilegal atau telah habis.' };
    return mandorFrontend.eksekusiMenuSpesifik(command, currentSessionRole, { id: currentSessionUserId, username: currentSessionUsername });
  });

  ipcMain.handle('secure-logout-channel', async (event, payload) => {
    try {
      const validation = logoutController.validateLogoutRequest(payload || {});
      if (!validation.allowed) return { success: false, error: validation.error };
      if (currentSessionId) await jwtTokenController.revokeSessionById(currentSessionId);
      await clearSensitiveSessionData();
      resetSessionState();
      if (process.env.APP_MODE !== 'SERVER_VPS' && !process.argv.includes('--headless')) await createWindow();
      if (dashboardWindow && !dashboardWindow.isDestroyed()) dashboardWindow.destroy();
      dashboardWindow = null;
      return { success: true };
    } catch (error) {
      console.error(`[KERNEL_LOGOUT_ERROR] ${error.message}`);
      return { success: false, error: 'Gagal melakukan logout.' };
    }
  });

  dbPool.on('emergency_logout', async () => {
    if (currentSessionId) { try { await jwtTokenController.revokeSessionById(currentSessionId); } catch {} }
    resetSessionState();
    await clearSensitiveSessionData();
    if (process.env.APP_MODE !== 'SERVER_VPS' && !process.argv.includes('--headless')) await createWindow();
    if (dashboardWindow && !dashboardWindow.isDestroyed()) dashboardWindow.destroy();
    dashboardWindow = null;
  });

  if (process.env.APP_MODE === 'SERVER_VPS' || process.argv.includes('--headless')) console.log('[KERNEL_READY] REST API aktif.');
};

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
initApp().catch((error) => { console.error(`[KERNEL_CRITICAL_BOOT_FAILURE] ${error.message}`); process.exit(1); });
