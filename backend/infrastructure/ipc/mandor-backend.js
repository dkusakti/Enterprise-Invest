// backend/infrastructure/ipc/mandor-backend.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import { VerifyDeviceController } from '../../features/owner/settings/verify-device/verify-device.controller.js';
import liveMonitoringController from '../../features/owner/live-monitoring/live-monitoring.controller.js';
import resetHardwareController from '../../features/owner/reset-hardware/reset-hardware.controller.js';
import logoutController from '../../features/logout/logout.controller.js';
import loginController from '../../features/login/login.controller.js';
import jwtTokenController from '../../features/security/jwt-token/jwt-token.controller.js';
import accountManagerController from '../../features/owner/settings/account-manager/account-manager.controller.js';

import MandorFrontend from './mandor-frontend.js';

// 🔒 SEKURITI: Daftar putih tabel hak eksklusif yang hanya boleh diakses peran tertinggi (Kunci Server-Controlled)
const PERAN_EKSKLUSIF_MANDOR = {
  'TRUNCATE_HARDWARE_DATA': ['owner', 'adminmaster'],
  'APPROVE_DEVICE': ['owner', 'adminmaster'],
  'CHECK_HEARTBEAT_AND_DEVICES': ['owner', 'adminmaster', 'superuser']
};

/**
 * ENTERPRISE MANDOR BACKEND INTERCEPTOR (AUTOMATION ENGINE)
 * Aturan Mutlak: Pangkas jalur IPC jadi 1 pintu tunggal, otomatisasi fitur baru, jaga main.js tetap langsing!
 */
const MandorBackend = {

  eksekusiAksiSpesifik: async (
    action,
    data,
    currentSessionRole
  ) => {

    const timestamp = new Date().toISOString();

    try {

      // 1. Normalisasi peran aktif dari RAM Kernel main.js
      const normalizedRole = String(
        currentSessionRole || 'user'
      )
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '');

      // 2. TAMENG OTORISASI PUSAT:
      // Periksa apakah aksi ini masuk daftar proteksi eksklusif
      if (PERAN_EKSKLUSIF_MANDOR[action]) {

        const daftarRoleSah =
          PERAN_EKSKLUSIF_MANDOR[action];

        if (!daftarRoleSah.includes(normalizedRole)) {

          console.warn(
            `[🚨 BLOKIR IPC] [${timestamp}] Peran "${normalizedRole}" dilarang keras memicu aksi sakral "${action}".`
          );

          return {
            status: 'error',
            message: 'Akses Ditolak! Otoritas Anda tidak mencukupi untuk memicu operasi ini.'
          };
        }
      }

      // =====================================================================
      // 🚪 INTERUPSI AMAN LOGOUT (JALUR KERNEL)
      // =====================================================================
      if (action === 'EXECUTE_LOGOUT') {

        const validasi =
          logoutController.validateLogoutRequest({
            action: action
          });

        if (!validasi.allowed) {
          return {
            status: 'error',
            message: validasi.error
          };
        }

        return {
          status: 'trigger_kernel_logout',
          success: true
        };
      }

      // =====================================================================
      // 🎛️ AUTOMATION ROUTING ENGINE (PENGALIHAN OTOMATIS BERBASIS AKSI)
      // =====================================================================

      // Skenario Fitur 1:
      // Realtime Live Monitoring Perangkat Karyawan
      if (action === 'CHECK_HEARTBEAT_AND_DEVICES') {

        const updateResult =
          await liveMonitoringController.handleTableUpdate();

        if (!updateResult.success) {
          return {
            status: 'error',
            message: updateResult.error
          };
        }

        const remappedDevices =
          updateResult.data.map(device => ({
            user_id: device.userId,
            device_name: device.deviceName,
            is_verified: device.isVerified,
            device_fingerprint: device.truncatedHash
          }));

        return {
          status: 'success',
          devices: remappedDevices
        };
      }

      // Skenario Fitur 2:
      // Otorisasi Persetujuan OTP Perangkat Baru
      if (action === 'APPROVE_DEVICE') {
        return await VerifyDeviceController.handle(data);
      }

      // Skenario Fitur 3:
      // Operasi Pembersihan Total Database
      if (action === 'TRUNCATE_HARDWARE_DATA') {

        return await resetHardwareController.processEmergencyReset({
          role: normalizedRole,
          confirmationPhrase: data?.confirmationPhrase
        });
      }

      // Meredam eror dari pembersihan folder kebijakan lama
      if (action === 'FETCH_UI_POLICY') {

        const safeLogUsername =
          data?.username
            ? String(data.username).replace(/[\x00-\x1F\x7F]/g, '')
            : 'Admin Master';

        return {
          status: 'success',
          success: true,
          policy: normalizedRole,
          username: safeLogUsername,
          userId: parseInt(data?.id || '0', 10)
        };
      }

      return {
        status: 'error',
        message: `Aksi Backend '${action}' tidak dikenali oleh Mandor Backend.`
      };

    } catch (gatewayFatalError) {

      console.error(
        `🚨 [MANDOR BACKEND GATEWAY ERROR] [${timestamp}]: ${gatewayFatalError.message}`
      );

      return {
        status: 'error',
        message: 'Terjadi kegagalan interseptor pada pusat kendali Mandor Backend.'
      };
    }
  },

  /**
   * STRATEGI VPS: Inisialisasi Express Server secara terisolasi dan aman
   */
  inisialisasiExpressServer: () => {

    const timestamp = new Date().toISOString();

    // SINKRONISASI JALUR:
    // Deklarasikan penentu folder absolut di awal fungsi
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const appExpress = express();

    // Lapis parsing JSON Body
    appExpress.use(express.json());

    // Daftarkan folder frontend sebagai root file statis
    appExpress.use(
      express.static(
        path.join(__dirname, '../../..', 'frontend')
      )
    );

    console.log(
      `[EXPRESS INTEGRATION] [${timestamp}] Merakit jalur pipa API untuk migrasi VPS...`
    );

    // =====================================================================
    // 1. ROUTE PUBLIC
    // =====================================================================

    appExpress.post(
      '/api/login',
      loginController.handleExpressLogin
    );

    appExpress.post(
      '/api/logout',
      logoutController.handleExpressLogout
    );

    appExpress.post(
      '/api/token/refresh',
      jwtTokenController.expressRotateSessionToken
    );

    // =====================================================================
    // 🔥 MIDDLEWARE FILTER OTORISASI PERAN EKSKLUSIF API VPS
    // =====================================================================

    const vpsRoleGuard = (actionName) => {

      return (req, res, next) => {

        const guardTimestamp =
          new Date().toISOString();

        // SINKRONISASI SEKURITI:
        // Cegah bypass jika token valid namun gagal
        // menyuntikkan objek req.user
        if (!req.user) {

          console.warn(
            `🚨 [BLOKIR API VPS] [${guardTimestamp}] Request ilegal terdeteksi mencoba memicu aksi "${actionName}" tanpa otentikasi user.`
          );

          return res.status(401).json({
            status: 'error',
            message: 'Akses Ditolak! Sesi Anda tidak valid.'
          });
        }

        const userRole =
          String(req.user?.role || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '');

        const allowedRoles =
          PERAN_EKSKLUSIF_MANDOR[actionName];

        if (
          allowedRoles &&
          !allowedRoles.includes(userRole)
        ) {

          console.warn(
            `🚨 [BLOKIR API VPS] [${guardTimestamp}] Peretas terdeteksi dengan role "${userRole}" mencoba membajak aksi "${actionName}"`
          );

          return res.status(403).json({
            status: 'error',
            message: 'Akses Ditolak! Otoritas token Anda tidak sah untuk endpoint ini.'
          });
        }

        if (typeof next === 'function') {
          next();
        }
      };
    };

    // =====================================================================
    // 2. ROUTE PROTECTED
    // =====================================================================

    appExpress.get(
      '/api/owner/monitoring',
      jwtTokenController.expressAuthenticateToken,
      vpsRoleGuard('CHECK_HEARTBEAT_AND_DEVICES'),
      liveMonitoringController.handleExpressTableUpdate
    );

    appExpress.post(
      '/api/settings/verify-device',
      jwtTokenController.expressAuthenticateToken,
      vpsRoleGuard('APPROVE_DEVICE'),
      VerifyDeviceController.handleExpressVerify
    );

    appExpress.post(
      '/api/owner/reset-hardware',
      jwtTokenController.expressAuthenticateToken,
      vpsRoleGuard('TRUNCATE_HARDWARE_DATA'),
      resetHardwareController.handleExpressEmergencyReset
    );

    // =====================================================================
    // 🔥 ENDPOINT:
    // Manajemen Pendaftaran Pengguna Baru
    // =====================================================================

    appExpress.post(
      '/api/owner/register-user',
      jwtTokenController.expressAuthenticateToken,
      accountManagerController.registerNewUser
    );

    appExpress.post(
      '/api/user/change-password',
      jwtTokenController.expressAuthenticateToken,
      accountManagerController.changePasswordSelf
    );

    // =====================================================================
    // 🛡️ ROUTE MANDOR FRONTEND - DYNAMIC CRUD
    // =====================================================================
    //
    // Frontend VPS:
    //
    // dashboard.preload.js
    //        ↓
    // /api/dynamic/crud
    //        ↓
    // JWT authentication
    //        ↓
    // MandorFrontend.handleExpressDynamicCRUD
    //        ↓
    // MandorFrontend.eksekusiMenuSpesifik
    //
    // Jalur Electron tidak berubah.
    // =====================================================================

    appExpress.post(
      '/api/dynamic/crud',
      jwtTokenController.expressAuthenticateToken,
      MandorFrontend.handleExpressDynamicCRUD
    );

    // =====================================================================
    // 🛡️ SINKRONISASI SEKURITI:
    // Global Async Express Error Handler
    // =====================================================================

    appExpress.use(
      (err, req, res, next) => {

        const errorTimestamp =
          new Date().toISOString();

        console.error(
          `[EXPRESS_GLOBAL_ERROR] [${errorTimestamp}] Terjadi Unhandled Exception pada Express Engine: ${err.message}`
        );

        return res.status(500).json({
          status: 'error',
          message: 'Terjadi kesalahan sistem internal pada VPS saat memproses permintaan API.'
        });
      }
    );

    // =====================================================================
    // 3. JALANKAN GERBANG PORT SERVER VPS
    // =====================================================================

    const vpsPort =
      parseInt(
        process.env.PORT || '3000',
        10
      );

    const serverInstance =
      appExpress.listen(
        vpsPort,
        () => {

          console.log(
            `[EXPRESS SUCCESS] [${new Date().toISOString()}] Server Express sukses mengudara di VPS pada port: ${vpsPort}`
          );

        }
      );

    return serverInstance;
  }
};

export default MandorBackend;