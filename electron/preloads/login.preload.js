const { contextBridge, ipcRenderer } = require('electron');

// STRATEGI VPS: Deteksi otomatis apakah script berjalan di dalam runtime shell Electron asli
const isElectronEnv = typeof ipcRenderer !== 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.electron;

// Ambil domain/IP dinamis dari alamat VPS yang sedang dibuka oleh user di web browser
const VPS_BASE_URL = window.location.origin;

const bridgeLoginInterface = {
  /**
   * Menggiring permintaan autentikasi ke backend secara aman (Async First)
   * @param {Object} credentials - Objek form berisi username dan password mentah dari frontend
   * @returns {Promise<Object>} Respon keputusan terstruktur dari Main Process atau Server Express VPS
   */
  authenticateUser: async (credentials) => {
    // LAPIS 11: Sanitisasi kaku tipe data dasar di pintu jembatan (Anti Prototype Pollution)
    if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) {
      throw new Error('Format struktur payload tidak valid pada lapisan jembatan keamanan.');
    }

    try {
      // SINKRONISASI SEKURITI: Bersihkan spasi kosong dan karakter kontrol liar di ujung string semenjak di pintu depan
      const secureDataPayload = {
        username: String(credentials.username || '').trim(),
        password: String(credentials.password || '')
      };

      if (isElectronEnv) {
        // JALUR LOKAL: Alur Linier kaku tembakkan data murni ter-sanitasi ke kanal tunggal IPC Electron
        const response = await ipcRenderer.invoke('secure-channel', {
          action: 'LOGIN_ATTEMPT',
          data: secureDataPayload
        });
        return response;
      } else {
        // STRATEGI VPS: Aliran HTTP POST JSON murni menuju API REST Server Express di VPS
        const httpRespon = await fetch(`${VPS_BASE_URL}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(secureDataPayload)
        });

        const dataRespon = await httpRespon.json();

        // SINKRONISASI SESI: Jika login sukses murni di VPS, simpan Access Token JWT ke dalam penyimpanan lokal browser
        if (dataRespon && dataRespon.success && dataRespon.accessToken) {
          localStorage.setItem('vps_access_token', dataRespon.accessToken);
          if (dataRespon.refreshToken) {
            localStorage.setItem('vps_refresh_token', dataRespon.refreshToken);
          }
        }
        return dataRespon;
      }
    } catch (error) {
      // Mengisolasi stack trace agar tidak membocorkan nama user OS atau struktur folder stasiun kerja Parrot OS Anda
      console.error('🚨 [LOGIN PRELOAD IPC/HTTP INTERRUPTION]:', error.message);
      
      // FIX LAPIS VISUAL: Kembalikan objek gagal terstruktur agar UI frontend tetap responsif dan tidak hang/freeze
      return { 
        success: false, 
        error: 'Infrastruktur komunikasi data internal gagal memproses otentikasi.' 
      };
    }
  }
};

// Daftarkan objek jembatan secara aman sesuai arsitektur penanganan Chromium runtime Anda
if (typeof contextBridge !== 'undefined' && contextBridge.exposeInMainWorld) {
  contextBridge.exposeInMainWorld('SecurityContext', bridgeLoginInterface);
} else {
  // Fallback pengamanan objek global window jika dijalankan murni via web browser internet VPS
  window.SecurityContext = bridgeLoginInterface;
}
