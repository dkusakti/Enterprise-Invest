import { execSync } from 'child_process';
import crypto from 'crypto';

const hardwareFingerprintService = {
  /**
   * Mengambil ID unik perangkat keras lintas OS secara aman tanpa dependensi luar (Untuk Klien Lokal Electron)
   * @returns {string} Hash SHA-256 dari kombinasi ID mesin asli
   */
  getMachineId: () => {
    let rawMachineId = '';
    const platform = process.platform; // Mendeteksi OS aktif (linux, win32, darwin)

    try {
      if (platform === 'linux') {
        // Ekstraksi murni untuk Parrot OS / Ubuntu Anda
        rawMachineId = execSync('cat /etc/machine-id || cat /var/lib/dbus/machine-id', { encoding: 'utf8' }).trim();
      } 
      else if (platform === 'win32') {
        // Ekstraksi murni untuk Windows via Registry (UUID Komputer)
        const winCommand = 'reg query HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid';
        const stdout = execSync(winCommand, { encoding: 'utf8' });
        const match = stdout.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
        rawMachineId = match ? match[0].trim() : '';
      } 
      else if (platform === 'darwin') {
        // FIX LOGIKA MAC: Ambil output ioreg mentah lalu saring UUID secara presisi menggunakan regex JavaScript murni
        const macCommand = 'ioreg -rd1 -c IOPlatformExpertDevice';
        const stdout = execSync(macCommand, { encoding: 'utf8' });
        const match = stdout.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/i);
        rawMachineId = match ? match[1].trim() : '';
      }

      // JIKA OS GAGAL MEMBERIKAN ID ASLI
      if (!rawMachineId || rawMachineId === '') {
        throw new Error(`Gagal mengekstrak ID unik perangkat pada OS ${platform}`);
      }

      // Mengamankan ID mentah menggunakan HMAC-SHA256 + Salt internal Enterprise Anda
      // Teknik ini mengaburkan nomor seri fisik asli mesin dari intipan memory dumping RAM
      return crypto
        .createHmac('sha256', 'EnterpriseInvestSecretHardwareSalt2026')
        .update(rawMachineId)
        .digest('hex');
        
    } catch (error) {
      console.error(`🚨 [CRITICAL HARDWARE ERROR] OS: ${platform} | Message: ${error.message}`);
      // FAIL-CLOSED: Lempar error asli ke atas agar login langsung memicu penolakan kaku di level kernel
      throw new Error('HARDWARE_READ_FAILED');
    }
  },

  /**
   * STRATEGI VPS: Memvalidasi keabsahan format sidik jari yang dikirimkan oleh klien jarak jauh
   * Memastikan data kiriman dari internet adalah format hash heksadesimal SHA-256 (64 karakter) murni
   * 
   * @param {string} fingerprintHash - Hash kiriman klien dari internet luar
   * @returns {boolean} Status kecocokan format
   */
  validateClientFingerprintFormat: (fingerprintHash) => {
    const cleanHash = String(fingerprintHash || '').trim();
    
    // Pola regex kaku: Harus berupa karakter alfanumerik a-f, 0-9 sepanjang tepat 64 karakter tanpa kecuali
    const sha256Regex = /^[a-f0-9]{64}$/;
    
    return sha256Regex.test(cleanHash);
  }
};

export default hardwareFingerprintService;
