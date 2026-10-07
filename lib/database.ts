import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
let database: DatabaseSync | undefined;
export function db() {
  if (!database) {
    const file = process.env.SQLITE_PATH || '/var/lib/owens-fitness/owens.sqlite';
    mkdirSync(dirname(file), { recursive: true });
    database = new DatabaseSync(file);
    database.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_records_owner_kind ON records(owner_id, kind);
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE COLLATE NOCASE, google_sub TEXT UNIQUE,
        username TEXT UNIQUE COLLATE NOCASE, password_hash TEXT, roles TEXT NOT NULL, instructor_id TEXT, athlete_id TEXT UNIQUE,
        active INTEGER NOT NULL DEFAULT 1, must_change_password INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS oauth_states (state_hash TEXT PRIMARY KEY, nonce TEXT NOT NULL, verifier TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);`);
    const migrated = database.prepare('SELECT name FROM migrations WHERE name=?').get('google-roles-v1');
    if (!migrated) {
      database.exec('BEGIN IMMEDIATE');
      try {
        if (database.prepare('SELECT name FROM migrations WHERE name=?').get('google-roles-v1')) { database.exec('COMMIT'); return database; }
        const insert = database.prepare('INSERT INTO users(id,name,email,roles,created_at) VALUES(?,?,?,?,?)');
        const now = Date.now();
        insert.run('instructor-pepe', 'Pepe / Owen', 'pepepotro21@gmail.com', '["admin","instructor"]', now);
        insert.run('admin-gabo', 'Gabo', 'chelafin@gmail.com', '["admin","support"]', now);
        insert.run('support-marco', 'Marco', 'marco.torres.diaz@gmail.com', '["support"]', now);
        insert.run('local-support', 'Administración y soporte', null, '["admin","support"]', now);
        database.prepare('UPDATE records SET owner_id=? WHERE owner_id=?').run('instructor-pepe', 'admin');
        database.prepare('INSERT INTO migrations(name,applied_at) VALUES(?,?)').run('google-roles-v1', now);
        database.exec('COMMIT');
      } catch (error) { database.exec('ROLLBACK'); database.close(); database = undefined; throw error; }
    }
  }
  return database;
}
