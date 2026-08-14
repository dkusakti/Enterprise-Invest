// backend/features/security/anti-brute-force/anti-brute-force.service.js

// PENGAMANAN SEKURITI: Isolasi memori kaku, hapus total penggunaan objek 'global' Node.js
const loginTracker = new Map();
const otpTracker = new Map();

const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 Menit pembekuan

const evaluateLockout = (state, tracker, key, moduleName, timestamp) => {
  if (state.lockoutUntil && Date.now() < state.lockoutUntil) {
    const remainingTime = Math.ceil((state.lockoutUntil - Date.now()) / 1000 / 60);
    return { isLocked: true, remainingTime };
  }
  
  if (state.lockoutUntil && Date.now() >= state.lockoutUntil) {
    console.log(`[ANTI_BRUTE_INFO] [${timestamp}] Masa hukuman blokir untuk key [${key}] pada modul [${moduleName}] telah kedaluwarsa. State direset.`);
    tracker.delete(key);
  }
  return { isLocked: false, remainingTime: 0 };
};

const antiBruteForceService = {
  // =====================================================================
  // 🔒 INTEGRASI TOTAL: LOGIN TRACKER (Mendukung Multi-User & IP-Tracking VPS)
  // =====================================================================
  checkLockoutStatus: (clientKey = 'local_device') => {
    const timestamp = new Date().toISOString();
    const key = String(clientKey).trim();
    
    // SINKRONISASI PONDASI: Tambahkan updatedAt untuk melacak umur cache data pasif demi mitigasi OOM DoS
    const state = loginTracker.get(key) || { failedAttempts: 0, lockoutUntil: null, updatedAt: Date.now() };
    return evaluateLockout(state, loginTracker, key, 'LOGIN', timestamp);
  },

  registerFailedAttempt: (clientKey = 'local_device') => {
    const timestamp = new Date().toISOString();
    const key = String(clientKey).trim();
    
    const state = loginTracker.get(key) || { failedAttempts: 0, lockoutUntil: null, updatedAt: Date.now() };
    
    state.failedAttempts += 1;
    state.updatedAt = Date.now(); // Perbarui jejak aktivitas
    loginTracker.set(key, state);

    console.warn(`[ANTI_BRUTE_WARN] [${timestamp}] Aktor [${key}] gagal login. Akumulasi salah: ${state.failedAttempts}/${MAX_ATTEMPTS}`);

    if (state.failedAttempts >= MAX_ATTEMPTS) {
      state.lockoutUntil = Date.now() + LOCKOUT_DURATION;
      state.updatedAt = Date.now();
      loginTracker.set(key, state);
      
      console.error(`[ANTI_BRUTE_CRITICAL] [${timestamp}] AKSES DIBEKUKAN! Kunci 15 menit diterapkan untuk aktor: [${key}]`);
      return { 
        isLocked: true, 
        message: 'Terlalu banyak percobaan login salah. Akses masuk dibekukan selama 15 menit.' 
      };
    }

    return { 
      isLocked: false, 
      message: `Sisa percobaan login: ${MAX_ATTEMPTS - state.failedAttempts} kali lagi.` 
    };
  },

  resetTracker: (clientKey = 'local_device') => {
    const timestamp = new Date().toISOString();
    const key = String(clientKey).trim();
    
    if (loginTracker.has(key)) {
      loginTracker.delete(key);
      console.log(`[ANTI_BRUTE_INFO] [${timestamp}] Seluruh state kegagalan login untuk aktor [${key}] dibersihkan.`);
    }
  },

  // =====================================================================
  // 🔒 VERIFIKASI OTP PERANGKAT TRACKER
  // =====================================================================
  checkOtpLockoutStatus: (clientKey = 'local_device') => {
    const timestamp = new Date().toISOString();
    const key = String(clientKey).trim();
    
    const state = otpTracker.get(key) || { failedAttempts: 0, lockoutUntil: null, updatedAt: Date.now() };
    return evaluateLockout(state, otpTracker, key, 'OTP', timestamp);
  },

  registerOtpFailedAttempt: (clientKey = 'local_device') => {
    const timestamp = new Date().toISOString();
    const key = String(clientKey).trim();
    
    const state = otpTracker.get(key) || { failedAttempts: 0, lockoutUntil: null, updatedAt: Date.now() };
    
    state.failedAttempts += 1;
    state.updatedAt = Date.now(); // Perbarui jejak aktivitas
    otpTracker.set(key, state);

    console.warn(`[ANTI_BRUTE_WARN] [${timestamp}] Aktor [${key}] salah memasukkan kode OTP. Akumulasi salah: ${state.failedAttempts}/${MAX_ATTEMPTS}`);

    if (state.failedAttempts >= MAX_ATTEMPTS) {
      state.lockoutUntil = Date.now() + LOCKOUT_DURATION;
      state.updatedAt = Date.now();
      otpTracker.set(key, state);
      
      console.error(`[ANTI_BRUTE_CRITICAL] [${timestamp}] FITUR OTORISASI DIKUNCI! Pembekuan panel OTP 15 menit untuk aktor: [${key}]`);
      return { 
        isLocked: true, 
        message: 'Terlalu banyak tebakan OTP salah. Fitur otorisasi perangkat dibekukan 15 menit.' 
      };
    }

    return { 
      isLocked: false, 
      message: `Kode OTP salah. Sisa percobaan otorisasi: ${MAX_ATTEMPTS - state.failedAttempts} kali lagi.` 
    };
  },

  resetOtpTracker: (clientKey = 'local_device') => {
    const timestamp = new Date().toISOString();
    const key = String(clientKey).trim();
    
    if (otpTracker.has(key)) {
      otpTracker.delete(key);
      console.log(`[ANTI_BRUTE_INFO] [${timestamp}] State kegagalan verifikasi OTP untuk aktor [${key}] dibersihkan.`);
    }
  }
};

// 🧹 MITIGASI DoS RAM: Background Garbage Collector internal otomatis menyapu RAM setiap 30 Menit
setInterval(() => {
  const now = Date.now();
  const timestamp = new Date().toISOString();
  const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 Menit batas usang data pasif
  
  // SINKRONISASI SEKURITI: Menyapu bersih entri blokir yang selesai hukuman DAN entri sampah parsial tanpa lockoutUntil
  for (const [key, state] of loginTracker.entries()) {
    if ((state.lockoutUntil && now >= state.lockoutUntil) || (!state.lockoutUntil && (now - state.updatedAt > IDLE_TIMEOUT))) {
      loginTracker.delete(key);
    }
  }
  for (const [key, state] of otpTracker.entries()) {
    if ((state.lockoutUntil && now >= state.lockoutUntil) || (!state.lockoutUntil && (now - state.updatedAt > IDLE_TIMEOUT))) {
      otpTracker.delete(key);
    }
  }
  console.log(`[ANTI_BRUTE_INFO] [${timestamp}] Garbage Collector internal selesai menyapu memori tracker yang kedaluwarsa.`);
}, 30 * 60 * 1000).unref();

export default antiBruteForceService;
