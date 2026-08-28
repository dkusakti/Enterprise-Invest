import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, 'migrations');

const run = async () => {
  const verifyOnly = process.argv.includes('--verify');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [81726351]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
    const applied = await client.query('SELECT version FROM schema_migrations ORDER BY version');
    const appliedSet = new Set(applied.rows.map((r) => r.version));
    for (const file of files) {
      if (appliedSet.has(file)) continue;
      if (verifyOnly) continue;
      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [file]);
      console.log(`[MIGRATION] applied ${file}`);
    }
    if (verifyOnly) console.log(`[MIGRATION] ${files.length} migration file(s) discovered; ${appliedSet.size} already recorded.`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[MIGRATION_FATAL] ${error.message}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.end();
  }
};

run();
