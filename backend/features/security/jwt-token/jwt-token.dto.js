/**
 * ENTERPRISE JWT TOKEN DTO (backend/features/security/jwt-token/jwt-token.dto.js)
 * Aturan Mutlak: Menjamin struktur klaim token steril, kaku, dan bebas dari infiltrasi peran ilegal.
 */
export default class JwtTokenDto {
  constructor(rawData) {
    const timestamp = new Date().toISOString();

    // FIX SEKURITI: Normalisasi dan pastikan rawData adalah objek murni, cegah error crash runtime di VPS
    const data = (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) ? rawData : {};

    // SINKRONISASI AKTIF: Cerdas membaca properti 'id' bawaan runtime atau 'user_id' hasil urai database PostgreSQL
    const rawId = data.id !== undefined ? data.id : data.user_id;
    
    // PENGAMANAN SEKURITI: Batasi panjang input maksimal untuk mencegah serangan Memory Exhaustion (DoS)
    const MAX_USERNAME_LEN = 50;
    const MAX_ROLE_LEN = 20;

    this.id = parseInt(rawId, 10) || 0;
    
    // Potong teks ekstrim di level memori terdepan sebelum dimasukkan ke string properti objek DTO
    const extractedUsername = String(data.username || '').substring(0, MAX_USERNAME_LEN);
    this.username = extractedUsername.trim().toLowerCase();
    
    const extractedRole = String(data.role || 'user').substring(0, MAX_ROLE_LEN);
    // Normalisasi kaku: buang seluruh spasi kosong (misal: "Admin Master" -> "adminmaster")
    this.role = extractedRole.trim().toLowerCase().replace(/\s+/g, '');

    // Log transformasi data DTO token tanpa membocorkan rahasia kredensial
    console.log(`[JWT_DTO_INFO] [${timestamp}] Penguncian struktur DTO selesai. ID Karyawan: [${this.id}], Kelayakan Validasi: [${this.isValid()}]`);
  }

  /**
   * Memastikan seluruh isi payload mematuhi daftar putih (Whitelisting) kaku sistem Enterprise Anda
   * @returns {Boolean} Status kelayakan data untuk diterbitkan menjadi token JWT
   */
  isValid() {
    // 🔒 SEKURITI: Kunci daftar peran resmi yang diakui oleh arsitektur Mandor Backend Anda
    const daftarRoleResmi = ['owner', 'adminmaster', 'superuser', 'user'];
    const isRoleWhitelisted = daftarRoleResmi.includes(this.role);

    // Data dinyatakan layak jika ID di atas 0, username terisi, dan peran terdaftar di daftar putih resmi
    return this.id > 0 && this.username.length > 0 && isRoleWhitelisted;
  }
}
