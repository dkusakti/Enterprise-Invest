// electron/main.js (PART 1)
import { app, BrowserWindow, session, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

// Impor Komponen Fitur dan Repositori Backend Anda
import loginController from '../backend/features/login/login.controller.js';
import loginRepository from '../backend/features/login/login.repository.js';
import logoutController from '../backend/features/logout/logout.controller.js';
import antiBruteForceController from '../backend/features/security/anti-brute-force/anti-brute-force.controller.js';
import hardwareFingerprintController from '../backend/features/security/hardware-fingerprint/hardware-fingerprint.controller.js';
import jwtTokenController from '../backend/features/security/jwt-token/jwt-token.controller.js';
import dbPool from '../backend/database/pool.js';

// 🔥 IMPOR 2 GAIB KEMANAN UTAMA ANDA
import MandorBackend from '../backend/infrastructure/ipc/mandor-backend.js'; // Pengalih File Fitur Dinamis
import mandorFrontend from '../backend/infrastructure/ipc/mandor-frontend.js'; // Pengatur Query Database Dinamis

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let dashboardWindow = null;
let currentSessionRole = 'user';

let internalAccessToken = '';
let internalRefreshToken = '';
let tokenExpirationTime = 0;

// STRATEGI VPS: Variabel penyimpan instansiasi server Express
let expressServerInstance = null;

// SINKRONISASI SEKURITI: Bendera pengunci penyegaran token untuk mitigasi Race Condition pada rotasi JWT
let isRefreshingTokens = false;

// =====================================================================
// 🛡️ SENSOR VALIDASI TOKEN AKSES RAM (GATEKEEPER KERNEL)
// =====================================================================
const checkSecurityGate = async () => {
  const timestamp = new Date().toISOString();
  if (!internalAccessToken) return false;
  
  try {
    const check = await jwtTokenController.validateActiveToken(internalAccessToken);
    if (check.success) return true;

    if (check.expired && internalRefreshToken && !isRefreshingTokens) {
      isRefreshingTokens = true;
      console.log(`[KERNEL_GATE_INFO] [${timestamp}] Masa berlaku token akses habis. Memicu rotasi token sesi otomatis.`);
      
      const refreshCheck = await jwtTokenController.validateActiveToken(internalRefreshToken);
      if (refreshCheck.success && refreshCheck.data) {
        const newTokens = await jwtTokenController.issueSessionToken(refreshCheck.data, true);
        if (newTokens.success) {
          internalAccessToken = newTokens.accessToken;
          internalRefreshToken = newTokens.refreshToken;
          tokenExpirationTime = newTokens.expiresAt;
          isRefreshingTokens = false;
          return true;
        }
      }    
      isRefreshingTokens = false;
    }
  } catch (gateErr) {
    console.error(`[KERNEL_GATE_ERROR] [${timestamp}] Kegagalan pengecekan pada gerbang otoritas token: ${gateErr.message}`);
    isRefreshingTokens = false;
  }
  return false;
};

// =====================================================================
// 🧼 PEMBERSIH STATE MEMORI & DATA SENSITIF RUNTIME
// =====================================================================
const clearSensitiveSessionData = async () => {
  const timestamp = new Date().toISOString();
  try {
    const defaultSession = session.defaultSession;
    await defaultSession.clearStorageData({
      storages: ['cookies', 'localstorage', 'websql', 'indexeddb', 'serviceworkers', 'cachestorage']
    });
    await defaultSession.clearCache();
    console.log(`[KERNEL_CLEAN_INFO] [${timestamp}] Memori penyimpanan runtime frontend dan cache berhasil disterilkan.`);
  } catch (error) {
    console.error(`[KERNEL_CLEAN_FATAL] [${timestamp}] Gagal membersihkan sisa data sesi sensitif: ${error.message}`);
    process.exit(1);
  }
};

// =====================================================================
// 🖥️ MANAGEMENT WINDOW: BUAT JENDELA DASHBOARD (PASCA LOGIN)
// =====================================================================
const createDashboardWindow = async () => {
  const timestamp = new Date().toISOString();
  const rootPath = app.getAppPath();
  
  dashboardWindow = new BrowserWindow({
    width: 1400, height: 900, fullscreen: false, autoHideMenuBar: true,
    title: "Enterprise Invest - Dashboard Master",
    webPreferences: {
      nodeIntegration: false, 
      contextIsolation: true, 
      sandbox: true,
      preload: path.join(rootPath, 'electron', 'preloads', 'dashboard.preload.js')
    }
  });
  
  dashboardWindow.setMenu(null);
  dashboardWindow.setContentProtection(true);

  dashboardWindow.webContents.on('will-navigate', (event) => {
    const navTimestamp = new Date().toISOString();
    console.warn(`[DASHBOARD_SECURITY_WARN] [${navTimestamp}] Deteksi usaha navigasi ilegal diblokir.`);
    event.preventDefault();
  });
  dashboardWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
  dashboardWindow.webContents.on('devtools-opened', () => {
    dashboardWindow.webContents.closeDevTools();
  });
  
  await dashboardWindow.loadFile(path.join(rootPath, 'frontend', 'main.html'));
  console.log(`[KERNEL_WINDOW_INFO] [${timestamp}] Jendela Dashboard Utama berhasil dimuat secara aman.`);
  
  dashboardWindow.on('closed', () => { dashboardWindow = null; });
};

// =====================================================================
// 🖥️ MANAGEMENT WINDOW: BUAT JENDELA LOGIN UTAMA (SINKRON JALUR ABSOLUT)
// =====================================================================
const createWindow = async () => {
  const timestamp = new Date().toISOString();
  mainWindow = new BrowserWindow({
    width: 1200, 
    height: 800, 
    fullscreen: false, 
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false, 
      contextIsolation: true, 
      sandbox: true,
      preload: path.join(__dirname, 'preloads', 'login.preload.js')
    }
  });

  mainWindow.setMenu(null);
  mainWindow.setContentProtection(true);
  
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';"]
      }
    });
  });
  
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('devtools-opened', () => mainWindow.webContents.closeDevTools());
  
  const jalurLoginHtmlAbsolut = path.join(__dirname, '..', 'frontend', 'pages', 'login', 'login.html');
  await mainWindow.loadFile(jalurLoginHtmlAbsolut);
  console.log(`[KERNEL_WINDOW_INFO] [${timestamp}] Jendela Gerbang Login Utama berhasil dimuat.`);
  
  mainWindow.on('closed', () => { mainWindow = null; });
};

// =====================================================================
// 🚀 RUNTIME INIT: SIKLUS HIDUP UTAMA APLIKASI KERNEL
// =====================================================================
const initApp = async () => {
  const timestamp = new Date().toISOString();
  try {
    await app.whenReady();
    await clearSensitiveSessionData();

    try {
      expressServerInstance = MandorBackend.inisialisasiExpressServer();
    } catch (expressBootError) {
      console.error(`🚨 [KERNEL STANDALONE EXPRESS ERROR] [${timestamp}] Gagal menyalakan mesin API VPS. Detail: ${expressBootError.message}`);
    }

    if (process.env.APP_MODE !== 'SERVER_VPS' && !process.argv.includes('--headless')) {
      await createWindow();
    } else {
      console.log(`🚀 [KERNEL HEADLESS VPS] [${timestamp}] Berhasil booting dalam mode Server Headless. Jendela fisik ditiadakan.`);
    }
  } catch (fatalInitError) {
    console.error(`🚨 [KERNEL_INIT_FATAL] [${timestamp}] Kegagalan fatal daur hidup inisialisasi awal kernel: ${fatalInitError.message}`);
  }
// electron/main.js (PART 2)
  // =====================================================================
  // 🛡️ JALUR A (RAHASIA): KHUSUS UNTUK MANDOR BACKEND 
  // Ditujukan untuk otentikasi awal pintu gerbang login & rute sakral
  // =====================================================================
  const tanganiAksiMandorBackend = async (event, payload, namaChannel) => {
    const timestamp = new Date().toISOString();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      console.warn(`[KERNEL_IPC_WARN] [${timestamp}] Penolakan IPC: Struktur data malformed dari saluran [${namaChannel}].`);
      throw new Error('Manipulasi Struktur IPC Terdeteksi!');
    }

    const { action, data } = payload;

    if (action === 'LOGIN_ATTEMPT') {
      try {
        const fpResult = hardwareFingerprintController.getSecureFingerprint();
        
        if (!fpResult || !fpResult.success) {
          console.error(`[KERNEL_IPC_ERROR] [${timestamp}] Autentikasi dibatalkan. Gagal menarik sidik jari perangkat keras.`);
          return { 
            success: false, 
            error: 'Keamanan Perangkat: Gagal memverifikasi identitas perangkat keras komputer Anda.' 
          };
        }

        const machineFingerprint = fpResult.data.fingerprint;
        const loginPayload = { ...data, fingerprint: machineFingerprint };
        const response = await loginController.handleLoginRequest(loginPayload);
        
        if (response && response.success && response.user) {
          const rawRole = String(response.user.role || 'user');
          currentSessionRole = rawRole.trim().toLowerCase().replace(/\s+/g, '');
          
          const jwtIssue = await jwtTokenController.issueSessionToken(response.user);
          if (jwtIssue.success) {
            internalAccessToken = jwtIssue.accessToken;
            internalRefreshToken = jwtIssue.refreshToken;
            tokenExpirationTime = jwtIssue.expiresAt;
          }
          
          setTimeout(async () => {
            try {
              await createDashboardWindow();
              if (mainWindow && !mainWindow.isDestroyed()) { 
                mainWindow.close(); 
                mainWindow = null; 
              }
            } catch (winErr) {
              console.error(`[KERNEL_WINDOW_ERROR] [${new Date().toISOString()}] Gagal memindahkan sesi layar ke dashboard: ${winErr.message}`);
            }
          }, 2000);
        }
        return response;
      } catch (controllerError) {
        console.error(`[KERNEL_IPC_FATAL] [${timestamp}] Eror komputasi internal pada rute login: ${controllerError.message}`);
        return { success: false, error: 'Kegagalan komputasi internal login backend.' };
      }
    }

    const isSessionValid = await checkSecurityGate();
    if (!isSessionValid) {
      console.warn(`[KERNEL_IPC_WARN] [${timestamp}] Request ditolak. Token akses kadaluwarsa atau ilegal.`);
      return { success: false, code: 'SESSION_EXPIRED', error: 'Sesi habis.' };
    }

    const result = await MandorBackend.eksekusiAksiSpesifik(action, data, currentSessionRole);
    
    if (result && result.status === 'trigger_kernel_logout') {
      console.log(`[🚪 KERNEL LOGOUT] [${timestamp}] Menghancurkan total memori token JWT via Mandor Backend...`);
      
      await clearSensitiveSessionData(); 
      currentSessionRole = 'user'; 
      internalAccessToken = ''; 
      internalRefreshToken = ''; 
      tokenExpirationTime = 0;
      
      if (process.env.APP_MODE !== 'SERVER_VPS' && !process.argv.includes('--headless')) {
        await createWindow(); 
      }
      
      if (dashboardWindow && !dashboardWindow.isDestroyed()) { 
        dashboardWindow.destroy(); 
        dashboardWindow = null; 
      }
      return { success: true };
    }

    return result;
  };

  ipcMain.handle('secure-channel', (e, p) => tanganiAksiMandorBackend(e, p, 'secure-channel'));

  // =====================================================================
  // 🛡️ JALUR B (UMUM): SATU-SATUNYA MANDOR OTOMATIS (`saluran-mandor`)
  // All-in-one dynamic gateway untuk front-end CRUD
  // =====================================================================
  ipcMain.handle('saluran-mandor', async (event, suratPerintah) => {
    const timestamp = new Date().toISOString();
    
    if (!suratPerintah || typeof suratPerintah !== 'object' || Array.isArray(suratPerintah)) {
      console.warn(`[KERNEL_IPC_WARN] [${timestamp}] Penolakan Otomasi: Surat perintah bukan berupa Object valid.`);
      return { status: 'ERROR', pesan: 'Format dokumen instruksi database tidak sah.' };
    }

    const isSessionValid = await checkSecurityGate();
    if (!isSessionValid) {
        return { status: 'ERROR', pesan: 'Akses Ditolak! Sesi Anda ilegal atau telah habis.' };
    }

    console.log(`[🌍 MANDOR AUTOMATION] [${timestamp}] Memproses tabel: "${suratPerintah?.target_tabel}" oleh Peran: "${currentSessionRole}"`);
    const hasilDb = await mandorFrontend.eksekusiMenuSpesifik(suratPerintah, currentSessionRole);
    return hasilDb;
  });

  // =====================================================================
  // 🚪 GATES LOGOUT: PENGHANCURAN TOTAL STATE MEMORI RAM (SINKRON SAKRAL)
  // =====================================================================
  ipcMain.handle('secure-logout-channel', async (event, payload) => {
    const timestamp = new Date().toISOString();
    try {
      let normalizedPayload = payload;
      
      if (payload && typeof payload === 'object' && !payload.action && payload.payload) {
          normalizedPayload = payload.payload;
      }

      const validasi = logoutController.validateLogoutRequest(normalizedPayload);
      
      if (!validasi.allowed) {
        console.warn(`[🚨 REJECT LOGOUT] [${timestamp}] Penolakan klaim logout. Alasan: ${validasi.error}`);
        return { success: false, error: validasi.error };
      }

      console.log(`[🚪 KERNEL LOGOUT] [${timestamp}] Menghancurkan total memori token JWT...`);
      await clearSensitiveSessionData(); 
      
      currentSessionRole = 'user'; 
      internalAccessToken = ''; 
      internalRefreshToken = ''; 
      tokenExpirationTime = 0;
      
      if (process.env.APP_MODE !== 'SERVER_VPS' && !process.argv.includes('--headless')) {
        await createWindow(); 
      }
      
      if (dashboardWindow && !dashboardWindow.isDestroyed()) { 
        dashboardWindow.destroy(); 
        dashboardWindow = null; 
      }
      
      return { success: true };
    } catch (logoutError) { 
      console.error(`[KERNEL_LOGOUT_FATAL] [${timestamp}] Gangguan fatal pada siklus pembersihan logout manual: ${logoutError.message}`);
      process.exit(1); 
    }
  });
  
  // =====================================================================
  // 🚨 EMERGENCY KICK LOGIC: DISINKRONKAN DENGAN EVENT EMITTER POOL DATABASE
  // =====================================================================
  const executeEmergencyKickProcedures = async () => {
    const timestamp = new Date().toISOString();
    console.error(`[🚨 EMERGENCY KICK] [${timestamp}] Jaringan terganggu! Menendang user ke layar login...`);
    
    internalAccessToken = ''; 
    internalRefreshToken = ''; 
    tokenExpirationTime = 0;
    currentSessionRole = 'user'; 

    await clearSensitiveSessionData(); 

    try {
      if (process.env.APP_MODE !== 'SERVER_VPS' && !process.argv.includes('--headless')) {
        await createWindow(); 
      }
    } catch (windowLoadError) {
      console.error(`[KERNEL_EMERGENCY_ERROR] [${timestamp}] Gagal memuat ulang infrastruktur jendela login fisik: ${windowLoadError.message}`);
    }

    if (dashboardWindow) { 
      try {
        if (!dashboardWindow.isDestroyed()) dashboardWindow.destroy(); 
      } catch (destroyError) {
        // Meredam interupsi jika jendela sudah telanjur ditutup sistem
      }
      dashboardWindow = null; 
    }
  };

  dbPool.on('emergency_logout', () => {
    executeEmergencyKickProcedures();
  });

  if (process.env.APP_MODE === 'SERVER_VPS' || process.argv.includes('--headless')) {
    console.log(`[KERNEL READY] [${new Date().toISOString()}] REST API Server Express aktif sepenuhnya melayani koneksi VPS.`);
  }
};

// =====================================================================
// --- TERMINASI CLEANUP LIFE-CYCLE ELECTRON ---
// =====================================================================
app.on('window-all-closed', () => { 
  if (process.platform !== 'darwin') app.quit(); 
});

// Jalankan inisialisasi boot-up kernel utama secara aman dengan penangkap eror visual
initApp().catch((fatalInitError) => {
  console.error(`🚨 KERNEL CRITICAL BOOT FAILURE: ${fatalInitError.message}`);
  try {
    if (process.env.APP_MODE !== 'SERVER_VPS' && !process.argv.includes('--headless')) {
      const { dialog } = require('electron');
      dialog.showErrorBox(
        'Kegagalan Sistem Utama',
        'Aplikasi gagal melakukan inisialisasi modul internal atau terjadi kerusakan alokasi memori runtime.'
      );
    }
  } catch (e) {}
  process.exit(1);
});
