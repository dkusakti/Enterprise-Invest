import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkDbHealth } from '../../database/pool.js';
import { VerifyDeviceController } from '../../features/owner/settings/verify-device/verify-device.controller.js';
import liveMonitoringController from '../../features/owner/live-monitoring/live-monitoring.controller.js';
import resetHardwareController from '../../features/owner/reset-hardware/reset-hardware.controller.js';
import logoutController from '../../features/logout/logout.controller.js';
import loginController from '../../features/login/login.controller.js';
import jwtTokenController from '../../features/security/jwt-token/jwt-token.controller.js';
import accountManagerController from '../../features/owner/settings/account-manager/account-manager.controller.js';
import MandorFrontend from './mandor-frontend.js';

const PERAN_EKSKLUSIF_MANDOR = {
  TRUNCATE_HARDWARE_DATA: ['owner', 'adminmaster'],
  APPROVE_DEVICE: ['owner', 'adminmaster'],
  CHECK_HEARTBEAT_AND_DEVICES: ['owner', 'adminmaster', 'superuser'],
  REGISTER_USER: ['owner', 'adminmaster']
};
const normalizeRole = (role) => String(role || 'user').trim().toLowerCase().replace(/\s+/g, '');

const MandorBackend = {
  eksekusiAksiSpesifik: async (action, data, currentSessionRole) => {
    const role = normalizeRole(currentSessionRole);
    const allowed = PERAN_EKSKLUSIF_MANDOR[action];
    if (allowed && !allowed.includes(role)) return { status: 'error', message: 'Akses Ditolak! Otoritas tidak mencukupi.' };
    try {
      if (action === 'EXECUTE_LOGOUT') {
        const validation = logoutController.validateLogoutRequest({ action });
        return validation.allowed ? { status: 'trigger_kernel_logout', success: true } : { status: 'error', message: validation.error };
      }
      if (action === 'CHECK_HEARTBEAT_AND_DEVICES') {
        const result = await liveMonitoringController.handleTableUpdate();
        if (!result.success) return { status: 'error', message: result.error };
        return { status: 'success', devices: result.data.map((device) => ({ user_id: device.userId, device_name: device.deviceName, is_verified: device.isVerified, device_fingerprint: device.truncatedHash })) };
      }
      if (action === 'APPROVE_DEVICE') return VerifyDeviceController.handle(data);
      if (action === 'TRUNCATE_HARDWARE_DATA') return resetHardwareController.processEmergencyReset({ role, confirmationPhrase: data?.confirmationPhrase });
      if (action === 'FETCH_UI_POLICY') return { status: 'success', success: true, policy: role, username: String(data?.username || 'Admin Master').replace(/[\x00-\x1F\x7F]/g, ''), userId: parseInt(data?.id || '0', 10) };
      return { status: 'error', message: `Aksi Backend '${action}' tidak dikenali.` };
    } catch (error) {
      console.error(`[MANDOR_BACKEND_ERROR] ${error.message}`);
      return { status: 'error', message: 'Kegagalan internal pusat kendali.' };
    }
  },

  inisialisasiExpressServer: () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const appExpress = express();
    appExpress.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
    appExpress.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '100kb' }));
    appExpress.use(express.static(path.join(__dirname, '../../..', 'frontend')));

    const vpsRoleGuard = (actionName) => (req, res, next) => {
      if (!req.user) return res.status(401).json({ status: 'error', message: 'Sesi tidak valid.' });
      const allowed = PERAN_EKSKLUSIF_MANDOR[actionName];
      if (allowed && !allowed.includes(normalizeRole(req.user.role))) return res.status(403).json({ status: 'error', message: 'Otoritas akun tidak mencukupi.' });
      return next();
    };

    appExpress.get('/health', checkDbHealth);
    appExpress.post('/api/login', loginController.handleExpressLogin);
    appExpress.post('/api/token/refresh', jwtTokenController.expressRotateSessionToken);
    appExpress.post('/api/logout', jwtTokenController.expressAuthenticateToken, logoutController.handleExpressLogout);

    appExpress.get('/api/owner/monitoring', jwtTokenController.expressAuthenticateToken, vpsRoleGuard('CHECK_HEARTBEAT_AND_DEVICES'), liveMonitoringController.handleExpressTableUpdate);
    appExpress.post('/api/settings/verify-device', jwtTokenController.expressAuthenticateToken, vpsRoleGuard('APPROVE_DEVICE'), VerifyDeviceController.handleExpressVerify);
    appExpress.post('/api/owner/reset-hardware', jwtTokenController.expressAuthenticateToken, vpsRoleGuard('TRUNCATE_HARDWARE_DATA'), resetHardwareController.handleExpressEmergencyReset);
    appExpress.post('/api/owner/register-user', jwtTokenController.expressAuthenticateToken, vpsRoleGuard('REGISTER_USER'), accountManagerController.registerNewUser);
    appExpress.post('/api/user/change-password', jwtTokenController.expressAuthenticateToken, accountManagerController.changePasswordSelf);
    appExpress.post('/api/dynamic/crud', jwtTokenController.expressAuthenticateToken, MandorFrontend.handleExpressDynamicCRUD);

    appExpress.use((err, req, res, next) => {
      console.error(`[EXPRESS_GLOBAL_ERROR] ${err.message}`);
      if (res.headersSent) return next(err);
      return res.status(500).json({ status: 'error', message: 'Kesalahan sistem internal.' });
    });

    const vpsPort = parseInt(process.env.PORT || '3000', 10);
    return appExpress.listen(vpsPort, () => console.log(`[EXPRESS_SUCCESS] Server aktif pada port ${vpsPort}`));
  }
};
export default MandorBackend;
