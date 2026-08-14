// backend/database/pool.js
import pg from 'pg'; 
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paksa dotenv membaca file .env asli di root folder Enterprise Invest
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const { Pool } = pg;

// 1. VALIDASI KETAT VARIABEL LINGKUNGAN (FAIL-FAST)
const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
for (const envVar of requiredEnv) {
    if (!process.env[envVar] || process.env[envVar].trim() === '') {
        console.error(`[DB_CONFIG_ERROR] [${new Date().toISOString()}] Variabel lingkungan ${envVar} wajib diisi!`);
        throw new Error(`❌ [DATABASE CONFIG]: Variabel lingkungan ${envVar} wajib diisi.`);
    }
}

const dbPort = parseInt(process.env.DB_PORT || '5432', 10);
if (isNaN(dbPort) || dbPort < 1 || dbPort > 65535) {
    console.error(`[DB_CONFIG_ERROR] [${new Date().toISOString()}] Port database '${process.env.DB_PORT}' tidak valid.`);
    throw new Error('❌ [DATABASE CONFIG]: Port database tidak valid.');
}

// Event Emitter internal untuk menangani kondisi darurat tanpa globalThis
export const dbEventEmitter = new EventEmitter();

const poolConfig = {
    host: process.env.DB_HOST, 
    user: process.env.DB_USER, 
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, 
    port: dbPort,
    max: 20, // Membatasi maksimal 20 koneksi simultan untuk mencegah DOS pada DB
    idleTimeoutMillis: 30000, 
    connectionTimeoutMillis: 5000, // Toleransi jaringan seluler/remote
};

// 2. PENGAMANAN SSL YANG LEBIH AKURAT & AMAN (Mitigasi MITM)
const isLocalhost = process.env.DB_HOST === 'localhost' || process.env.DB_HOST === '127.0.0.1';
if (!isLocalhost || process.env.DB_SSL_FORCE === 'true') {
    poolConfig.ssl = { rejectUnauthorized: true };
    console.log(`[DB_INFO] [${new Date().toISOString()}] Koneksi non-local terdeteksi. Mengaktifkan enkripsi SSL kaku.`);
    
    if (process.env.DB_SSL_CA_PATH) {
        try {
            const caCertPath = path.resolve(process.env.DB_SSL_CA_PATH);
            poolConfig.ssl.ca = fs.readFileSync(caCertPath, 'utf8');
            console.log(`[DB_INFO] [${new Date().toISOString()}] Sertifikat CA SSL berhasil dimuat dari: ${caCertPath}`);
        } catch (fsErr) {
            console.error(`[DB_SSL_ERROR] [${new Date().toISOString()}] Gagal membaca file CA SSL di ${process.env.DB_SSL_CA_PATH}: ${fsErr.message}`);
            throw new Error(`❌ [DATABASE SSL]: Gagal membaca file CA SSL.`);
        }
    }
}

const dbPool = new Pool(poolConfig);

// 3. PENANGANAN EROR BERLAPIS MENDADAK
dbPool.on('error', (err) => {
    console.error(`[DB_CRITICAL_ERROR] [${new Date().toISOString()}] Koneksi database terputus mendadak! Pesan: ${err.message}`);
    dbEventEmitter.emit('emergency_logout');
});

/**
 * STRATEGI VPS: Middleware Health Check untuk Express Express
 */
export const checkDbHealth = async (req, res) => {
    let client;
    try {
        client = await dbPool.connect();
        await client.query('SELECT 1');
        return res.status(200).json({ status: 'UP' }); 
    } catch (err) {
        console.error(`[DB_HEALTH_FAILED] [${new Date().toISOString()}] Alur health check gagal. Deteksi kendala: ${err.message}`);
        return res.status(500).json({ status: 'DOWN' });
    } finally {
        if (client) {
            client.release(); // Memastikan client SELALU dilepas kembali ke pool
        }
    }
};

export default dbPool;