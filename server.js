// server.js (EXPRESS PRODUCTION GATEWAY FOR VPS DEPLOYMENT)
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Impor Core Interceptor Utama Mandor Anda
import MandorBackend from './backend/infrastructure/ipc/mandor-backend.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. MEMUAT KONFIGURASI ENVIRONTMENT SECARA ABSOLUT
dotenv.config({ path: path.join(__dirname, '.env') });

// Paksa penanda runtime agar sistem tahu aplikasi sedang berjalan murni sebagai web server API di VPS
process.env.APP_MODE = 'SERVER_VPS';

console.log('\x1b[32m🚀 [VPS BOOTSTRAPPER] Memulai inisialisasi server tanpa kepala (Headless Server Mode)...\x1b[0m');

try {
  // 2. PICU OTOMATIS JALUR PIPA API EXPRESS YANG SUDAH KITA RAKIT DI MANDOR BACKEND
  const server = MandorBackend.inisialisasiExpressServer();
  
  // 3. PENANGANAN TERMINASI BERLAPIS (ANTI-BLOAT & CORRUPT HEAP RAM)
  const matikanServerSecaraAman = (sinyalOS) => {
    console.log(`\n\x1b[31m⚠️ Menangkap sinyal ${sinyalOS}. Menutup koneksi Express dan Database Pool secara aman...\x1b[0m`);
    server.close(() => {
      console.log('\x1b[31m🛑 [SERVER CLOSED]: Seluruh lalu lintas jaringan REST API di VPS resmi dihentikan.\x1b[0m');
      process.exit(0);
    });
  };

  // Kaitkan interseptor matikan proses darurat OS Linux VPS
  process.on('SIGTERM', () => matikanServerSecaraAman('SIGTERM'));
  process.on('SIGINT', () => matikanServerSecaraAman('SIGINT'));

} catch (bootstrapFatalError) {
  console.error('🚨 [VPS BOOTSTRAPPER FATAL CRASH]: Gagal meluncurkan server Express utama.', bootstrapFatalError.message);
  process.exit(1);
}
