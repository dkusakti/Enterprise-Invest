// backend/features/login/login.repository.js
import dbPool from '../../database/pool.js';
import crypto from 'crypto'; 

const approvalAttemptTracker = new Map();
const MAX_APPROVAL_ATTEMPTS = 3;

const loginRepository = {
	/**
	 * Mencari data pengguna berdasarkan username secara presisi
	 */
	findUserByUsername: async (username) => {
		const timestamp = new Date().toISOString();
		const queryText = `SELECT id, username, role, password_hash FROM login WHERE username = $1 LIMIT 1`;

		try {
			console.log(`[DB_REPO_INFO] [${timestamp}] Menjalankan query mencari username: "${username}"`);
			const result = await dbPool.query(queryText, [username]);
			
			if (!result || !result.rows || result.rows.length === 0) {
				console.log(`[DB_REPO_INFO] [${timestamp}] Username "${username}" tidak ditemukan di database.`);
				return null;
			}
			
			// FIX SINKRONISASI LOGIKA: Mengembalikan objek tunggal baris pertama (Sesuai Pondasi Utama Anda)
			return result.rows[0]; 
		} catch (error) { 
			console.error(`[DB_REPO_ERROR] [${timestamp}] Gagal mengeksekusi findUserByUsername. Detail: ${error.message}`);
			throw new Error('Database query execution failed.'); 
		}
	},

	/**
	 * SINKRONISASI MUTLAK: Manajemen Gembok Hardware & Kuota Perangkat (ACID Transaction)
	 */
	checkDeviceBinding: async (userId, hardwareFingerprint) => {
		const timestamp = new Date().toISOString();
		const MAX_ALLOWED_DEVICES = 5;
		const client = await dbPool.connect(); 
		
		try {
			const safeUserId = parseInt(userId, 10) || 0;
			const safeFingerprint = String(hardwareFingerprint || '').trim().toLowerCase();

			console.log(`[DB_REPO_INFO] [${timestamp}] Memulai transaksi DB untuk cek Device Binding. User ID: ${safeUserId}`);
			
			// Mulai transaksi kaku untuk mencegah bypass kuota via serangan bersamaan (Race Condition)
			await client.query('BEGIN');

			// 1. Cek apakah device sudah terdaftar & terverifikasi
			const matchQuery = `SELECT id, is_verified FROM users_devices WHERE user_id = $1 AND device_fingerprint = $2 LIMIT 1`;
			const matchResult = await client.query(matchQuery, [safeUserId, safeFingerprint]);

			if (matchResult && matchResult.rows && matchResult.rows.length > 0) {
				console.log(`[DB_REPO_INFO] [${timestamp}] Device terdaftar dan cocok untuk User ID: ${safeUserId}`);
				await client.query('COMMIT');
				return { isAllowed: true, status: 'DEVICE_MATCHED' };
			}

			// 2. Tarik data role untuk identitas nama stasiun kerja otomatis (Locking Row Mode)
			const roleQuery = `SELECT role FROM login WHERE id = $1 LIMIT 1 FOR SHARE`;
			const roleResult = await client.query(roleQuery, [safeUserId]);
			let userRole = 'UNKNOWN';
			if (roleResult && roleResult.rows && roleResult.rows.length > 0) {
				userRole = String(roleResult.rows[0].role || 'UNKNOWN').toUpperCase().trim();
			}

			// 3. Hitung jumlah kuota perangkat terdaftar saat ini
			const countQuery = `SELECT COUNT(*)::integer as total FROM users_devices WHERE user_id = $1`;
			const countResult = await client.query(countQuery, [safeUserId]);
			
			// SINKRONISASI PENGAMANAN: Paksa konversi ke integer untuk mengantisipasi driver pg return string count
			const totalRegisteredDevices = parseInt(countResult.rows[0]?.total || '0', 10);

			// 4. Evaluasi pembatasan perangkat keras
			if (totalRegisteredDevices === 0) {
				console.log(`[DB_REPO_INFO] [${timestamp}] Perangkat pertama terdeteksi. Melakukan auto-approve untuk User ID: ${safeUserId}`);
				const dynamicDeviceName = `Stasiun Kerja (${userRole})`;
				const insertQuery = `INSERT INTO users_devices (user_id, device_fingerprint, device_name, is_verified) VALUES ($1, $2, $3, TRUE)`;
				await client.query(insertQuery, [safeUserId, safeFingerprint, dynamicDeviceName]);
				await client.query('COMMIT');
				return { isAllowed: true, status: 'FIRST_DEVICE_AUTO_APPROVED' };
			}

			if (totalRegisteredDevices >= MAX_ALLOWED_DEVICES) {
				console.warn(`[DB_REPO_WARN] [${timestamp}] Penolakan login. Kuota maksimal 5 perangkat terpenuhi untuk User ID: ${safeUserId}`);
				await client.query('ROLLBACK');
				return { isAllowed: false, error: 'Kuota maksimal 5 perangkat terpenuhi.' };
			}

			// 5. UPSERT-LIKE LOGIC: Update/Insert Kode OTP Aktivasi Perangkat Baru (Pending Mode)
			const checkPendingQuery = `SELECT id, activation_code FROM users_devices WHERE user_id = $1 AND device_fingerprint = $2 AND is_verified = FALSE LIMIT 1`;
			const pendingResult = await client.query(checkPendingQuery, [safeUserId, safeFingerprint]);

			const generatedCode = String(crypto.randomInt(100000, 999999));
			if (pendingResult.rows && pendingResult.rows.length > 0) {
				console.log(`[DB_REPO_INFO] [${timestamp}] Perangkat pending ditemukan. Memperbarui kode OTP baru untuk User ID: ${safeUserId}`);
				const updateOtpQuery = `UPDATE users_devices SET activation_code = $1, created_at = NOW() WHERE user_id = $2 AND device_fingerprint = $3`;
				await client.query(updateOtpQuery, [generatedCode, safeUserId, safeFingerprint]);
			} else {
				console.log(`[DB_REPO_INFO] [${timestamp}] Mendaftarkan entri perangkat baru status PENDING untuk User ID: ${safeUserId}`);
				const insertNewQuery = `INSERT INTO users_devices (user_id, device_fingerprint, activation_code, is_verified, device_name, created_at) VALUES ($1, $2, $3, FALSE, 'Perangkat Baru (Pending)', NOW())`;
				await client.query(insertNewQuery, [safeUserId, safeFingerprint, generatedCode]);
			}
			
			await client.query('COMMIT');
			return { 
				isAllowed: false, 
				error: `Perangkat baru terdaftar. Berikan kode ke Admin Master Anda: ${generatedCode.slice(0,3)}-${generatedCode.slice(3,6)}` 
			};

		} catch (error) {
			await client.query('ROLLBACK');
			console.error(`[DB_REPO_FATAL] [${timestamp}] Kegagalan fatal saat pemrosesan transaksi binding perangkat: ${error.message}`);
			throw new Error('Database transaction processing failed.');
		} finally {
			client.release(); 
		}
	},

	/**
	 * Menyetujui perangkat baru lewat OTP dengan proteksi Brute Force per user
	 */
	approveDevice: async (activationCode) => {
		const timestamp = new Date().toISOString();
		const cleanCode = String(activationCode || '').replace(/-/g, '').trim();

		// Proteksi Validitas Waktu: Kode OTP kedaluwarsa otomatis dalam 15 menit
		const findUserQuery = `
			SELECT user_id FROM users_devices 
			WHERE activation_code = $1 
			AND is_verified = FALSE 
			AND (created_at >= NOW() - INTERVAL '15 minutes' OR created_at IS NULL)
			LIMIT 1
		`;
		
		try {
			const findUserResult = await dbPool.query(findUserQuery, [cleanCode]);

			if (!findUserResult || findUserResult.rows.length === 0) {
				console.warn(`[DB_REPO_WARN] [${timestamp}] Percobaan aktivasi gagal. Kode salah atau melewati batas 15 menit.`);
				return { success: false, error: 'Kode Aktivasi tidak valid, salah, atau sudah kadaluwarsa (Maks. 15 Menit).' };
			}

			const userId = findUserResult.rows[0].user_id;
			let currentAttempts = approvalAttemptTracker.get(userId) || 0;

			if (currentAttempts >= MAX_APPROVAL_ATTEMPTS) {
				console.warn(`[DB_REPO_WARN] [${timestamp}] Otorisasi ditolak. Tracker brute-force untuk User ID [${userId}] terkunci.`);
				return { success: false, error: 'AKSES DIBEKUKAN: Akun ini telah salah memasukkan kode sebanyak 3 kali! Fitur otorisasi dikunci.' };
			}

			const queryText = `
				UPDATE users_devices 
				SET is_verified = TRUE, 
					device_name = 'Stasiun Kerja (Disetujui Admin Master)', 
					activation_code = NULL 
				WHERE activation_code = $1 AND user_id = $2 AND is_verified = FALSE
				RETURNING id
			`;

			const result = await dbPool.query(queryText, [cleanCode, userId]);
			
			if (!result || result.rows.length === 0) {
				currentAttempts++; 
				approvalAttemptTracker.set(userId, currentAttempts);
				const remainingAttempts = MAX_APPROVAL_ATTEMPTS - currentAttempts;
				console.warn(`[DB_REPO_WARN] [${timestamp}] Kode aktivasi salah untuk User ID: [${userId}]. Percobaan ke-${currentAttempts}`);

				if (currentAttempts >= MAX_APPROVAL_ATTEMPTS) {
					return { success: false, error: 'AKSES DIBEKUKAN: Batas percobaan habis! Otorisasi dikunci.' };
				}
				return { success: false, error: `Kode Aktivasi salah! Sisa percobaan: ${remainingAttempts} kali lagi.` };
			}

			console.log(`[DB_REPO_SUCCESS] [${timestamp}] Perangkat sukses diverifikasi untuk User ID: [${userId}]`);
			approvalAttemptTracker.delete(userId);
			return { success: true };

		} catch (error) {
			console.error(`[DB_REPO_FATAL] [${timestamp}] Eror internal pada modul approveDevice: ${error.message}`);
			throw new Error('Database transaction processing failed.');
		}
	}
};

export default loginRepository;
