// backend/features/security/jwt-token/jwt-token.service.js
import crypto from 'crypto';

class JwtTokenService {
  constructor() {
    const timestamp = new Date().toISOString();

    // SINKRONISASI KUNCI: Menarik tanda tangan rahasia ganda dari berkas .env stasiun kerja Anda
    // PENGAMANAN SEKURITI: Hapus total fallback hardcoded string teks biasa demi mitigasi Token Forgery Attack
    if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
      console.error(`[JWT_KERNEL_ERROR] [${timestamp}] Kunci JWT_ACCESS_SECRET atau JWT_REFRESH_SECRET tidak ditemukan di file .env! Aplikasi dihentikan.`);
      throw new Error('❌ [JWT CONFIG]: Kunci rahasia kriptografi token wajib diisi.');
    }

    this.accessSecret = process.env.JWT_ACCESS_SECRET;
    this.refreshSecret = process.env.JWT_REFRESH_SECRET;
    
    console.log(`[JWT KERNEL] [${timestamp}] APP_ENV = production. Mengunci Sesi Kriptografi Terisolasi.`);
    
    // Batas kedaluwarsa Token Akses: 15 Menit terkunci kaku dalam satuan milidetik
    this.accessTokenExpiryMs = 15 * 60 * 1000;
    
    // Batas kedaluwarsa Refresh Token: 7 Hari terkunci kaku dalam satuan milidetik
    this.refreshTokenExpiryMs = 7 * 24 * 60 * 60 * 1000; 
  }

  base64UrlEncode(str) {
    return Buffer.from(str)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return Buffer.from(str, 'base64').toString();
  }

  createSignature(header, payload, secretKey) {
    const dataToSign = `${header}.${payload}`;
    return crypto
      .createHmac('sha512', secretKey) // Menggunakan SHA-512 untuk kekuatan enkripsi militer
      .update(dataToSign)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  generateToken(payloadData, expiryMs, secretKey) {
    const header = this.base64UrlEncode(JSON.stringify({ alg: 'HS512', typ: 'JWT' }));
    const payload = this.base64UrlEncode(JSON.stringify({
      ...payloadData,
      exp: Date.now() + expiryMs
    }));
    const signature = this.createSignature(header, payload, secretKey);
    return `${header}.${payload}.${signature}`;
  }

  /**
   * Menerbitkan sepasang token baru dengan dukungan pertahanan nilai memori RAM saat rotasi otomatis
   */
  async issueTokens(sanitizedDto, isRotation = false, rawRefreshToken = '') {
    if (!sanitizedDto || typeof sanitizedDto.isValid !== 'function' || !sanitizedDto.isValid()) {
      return { success: false, error: 'Data DTO tidak valid untuk pembuatan token.' };
    }

    const payloadData = {
      user_id: sanitizedDto.id, // Disimpan sebagai user_id agar klop dengan kebutuhan scan DTO validasi hardware
      username: sanitizedDto.username,
      role: sanitizedDto.role
    };

    // Access Token selalu dicetak baru menggunakan Kunci Akses khusus
    const accessToken = this.generateToken(payloadData, this.accessTokenExpiryMs, this.accessSecret);
    
    // FIX LOGIKA SINKRONISASI RAM: Jika ini adalah fase rotasi otomatis, pertahankan nilai asli token refresh lama
    const refreshToken = isRotation && rawRefreshToken !== ''
      ? rawRefreshToken 
      : this.generateToken(payloadData, this.refreshTokenExpiryMs, this.refreshSecret);

    return {
      success: true,
      accessToken,
      refreshToken,
      expiresAt: Date.now() + this.accessTokenExpiryMs 
    };
  }

  async verifyToken(token) {
    const timestamp = new Date().toISOString();
    try {
      const parts = String(token).split('.');
      if (parts.length !== 3) return { success: false, error: 'Format token cacat.' };

      const [header, payload, signature] = parts;
      
      // PROTEKSI EKSTREM: Kurung proses penguraian JSON di dalam try-catch lokal agar kebal dari manipulasi string malformed peretas
      let decodedPayload;
      try {
        decodedPayload = JSON.parse(this.base64UrlDecode(payload));
      } catch (jsonParseError) {
        return { success: false, error: 'Struktur data enkripsi internal token tidak valid atau dimanipulasi!' };
      }
      
      // Validasi waktu kedaluwarsa murni angka (Anti-Bypass Temporal)
      if (!decodedPayload || !decodedPayload.exp || Date.now() > decodedPayload.exp) {
        return { success: false, expired: true, error: 'Masa aktif token kedaluwarsa.' };
      }

      // ⚙️ VERIFIKASI DUA KUNCI RAHASIA DENGAN PROTEKSI TIMING ATTACT KAKU
      // Menggunakan crypto.timingSafeEqual untuk menjamin durasi eksekusi selalu konstan di memori RAM
      let expectedSignature = this.createSignature(header, payload, this.accessSecret);
      
      let signatureBuffer = Buffer.from(signature);
      let expectedBuffer = Buffer.from(expectedSignature);
      
      let isSignatureValid = false;
      if (signatureBuffer.length === expectedBuffer.length) {
        isSignatureValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
      }
      
      if (!isSignatureValid) {
        // Coba verifikasi ulang menggunakan Kunci Rahasia Refresh Token (Sangat vital saat fase Silent Refresh)
        expectedSignature = this.createSignature(header, payload, this.refreshSecret);
        expectedBuffer = Buffer.from(expectedSignature);
        
        if (signatureBuffer.length === expectedBuffer.length) {
          isSignatureValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
        }
        
        if (!isSignatureValid) {
          console.warn(`[JWT_SERVICE_WARN] [${timestamp}] Deteksi tanda tangan kriptografi ilegal ditolak murni dari level RAM.`);
          return { success: false, error: 'Tanda tangan kriptografi tidak cocok atau kunci rahasia ilegal!' };
        }
      }

      // FIX SINKRONISASI MUTLAK: Mengembalikan objek 'user' agar klop dengan destrukturisasi objek di JwtTokenController!
      return { 
        success: true, 
        user: {
          id: decodedPayload.user_id,
          username: decodedPayload.username,
          role: decodedPayload.role
        }
      };
    } catch (err) {
      console.error(`🚨 [JWT SERVICE VERIFY FATAL] [${timestamp}]: ${err.message}`);
      return { success: false, error: 'Gagal memproses verifikasi token.' };
    }
  }
}

export default new JwtTokenService();
