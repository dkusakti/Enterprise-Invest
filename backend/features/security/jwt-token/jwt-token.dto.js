export default class JwtTokenDto {
  constructor(rawData = {}) {
    const data = rawData && typeof rawData === 'object' && !Array.isArray(rawData) ? rawData : {};
    const rawId = data.id !== undefined ? data.id : data.user_id;
    const aliases = { admin: 'adminmaster', master_admin: 'adminmaster', super_user: 'superuser' };
    this.id = Number.parseInt(rawId, 10) || 0;
    this.username = String(data.username || '').trim().toLowerCase().slice(0, 50);
    const rawRole = String(data.role || 'user').trim().toLowerCase().replace(/\s+/g, '');
    this.role = aliases[rawRole] || rawRole;
  }

  isValid() {
    return this.id > 0 && this.username.length > 0 && ['owner', 'adminmaster', 'superuser', 'user'].includes(this.role);
  }
}
