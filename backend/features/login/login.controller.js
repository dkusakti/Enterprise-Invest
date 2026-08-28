import loginValidator from './login.validator.js';
import loginDTO from './login.dto.js';
import loginService from './login.service.js';
import antiBruteForceService from '../security/anti-brute-force/anti-brute-force.service.js';
import dbPool from '../../database/pool.js';
import jwtTokenController from '../security/jwt-token/jwt-token.controller.js';

const loginController = {
  catatAuditAuth: async (username, aksi, status) => {
    try {
      const userRes = await dbPool.query(`SELECT id FROM login WHERE username = $1 LIMIT 1`, [username]);
      await dbPool.query(`INSERT INTO activity_log (user_id, username, action_name, target_table, status) VALUES ($1,$2,$3,'login',$4)`, [userRes.rows[0]?.id || null, username || 'unknown_user', aksi, status]);
    } catch (error) { console.error(`[AUTH_LOG_FAILURE] ${error.message}`); }
  },

  handleLoginRequest: async (rawPayload, clientKey = 'local_device') => {
    const inputUsername = String(rawPayload?.username || '').trim();
    const trackingKey = inputUsername !== '' ? `${clientKey}:${inputUsername}` : `${clientKey}:anonymous`;
    try {
      const lockStatus = antiBruteForceService.checkLockoutStatus(trackingKey);
      if (lockStatus.isLocked) {
        await loginController.catatAuditAuth(inputUsername, 'LOGIN_ATTEMPT', 'BLOCKED_BRUTEFORCE');
        return { success: false, error: `Akses Dibekukan. Terlalu banyak percobaan salah! Sisa waktu: ${lockStatus.remainingTime} menit.` };
      }
      const validation = await loginValidator.validateInput(rawPayload);
      if (!validation.isValid) return { success: false, error: validation.error };
      const sanitizedDto = loginDTO.transformInput(rawPayload);
      const result = await loginService.executeLogin(sanitizedDto);
      if (result?.success) {
        antiBruteForceService.resetTracker(trackingKey);
        await loginController.catatAuditAuth(sanitizedDto.username, 'LOGIN_SUCCESS', 'SUCCESS');
        return result;
      }
      const failure = antiBruteForceService.registerFailedAttempt(trackingKey);
      await loginController.catatAuditAuth(sanitizedDto.username, 'LOGIN_FAILED', 'INVALID_CREDENTIALS');
      return { success: false, error: `${result?.error || 'Kredensial yang Anda masukkan salah.'} ${failure.message}` };
    } catch (error) {
      console.error(`[LOGIN_CONTROLLER_FATAL] ${error.message}`);
      return { success: false, error: 'Kegagalan sistem internal pada proses login.' };
    }
  },

  handleExpressLogin: async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown_vps_client';
      const result = await loginController.handleLoginRequest(req.body, clientIp);
      if (!result.success) return res.status(result.error?.includes('Dibekukan') ? 429 : 401).json(result);
      const tokens = await jwtTokenController.issueSessionToken(result.user, {
        deviceFingerprint: req.body?.fingerprint || null,
        userAgent: req.get('user-agent') || null,
        ipAddress: clientIp
      });
      if (!tokens.success) return res.status(500).json({ success: false, error: 'Login berhasil tetapi sesi gagal dibuat.' });
      return res.status(200).json({ success: true, user: result.user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt });
    } catch (error) {
      console.error(`[EXPRESS_LOGIN_FATAL] ${error.message}`);
      return res.status(500).json({ success: false, error: 'Terjadi kesalahan internal pada server login.' });
    }
  }
};

export default loginController;
