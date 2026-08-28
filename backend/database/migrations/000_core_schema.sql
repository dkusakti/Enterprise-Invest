CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS login (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS users_devices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES login(id) ON DELETE CASCADE,
  device_fingerprint VARCHAR(255) NOT NULL,
  device_name VARCHAR(100),
  activation_code VARCHAR(10),
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_devices_user_id ON users_devices(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_devices_user_fingerprint ON users_devices(user_id, device_fingerprint);

CREATE TABLE IF NOT EXISTS activity_log (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NULL REFERENCES login(id) ON DELETE SET NULL,
  username VARCHAR(50),
  action_name VARCHAR(100) NOT NULL,
  target_table VARCHAR(100),
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);

CREATE TABLE IF NOT EXISTS app_menus (
  id SERIAL PRIMARY KEY,
  menu_name VARCHAR(100) NOT NULL,
  folder_name VARCHAR(100) NOT NULL UNIQUE,
  roles_allowed VARCHAR(255) NOT NULL DEFAULT 'owner,adminmaster',
  icon_visual VARCHAR(100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  menu_section VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS idx_app_menus_sort_order ON app_menus(sort_order);
