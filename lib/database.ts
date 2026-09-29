import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
let database: DatabaseSync | undefined;
export function db() {
  if (!database) {
    const file = process.env.SQLITE_PATH || '/var/lib/owens-fitness/owens.sqlite';
    mkdirSync(dirname(file), { recursive: true });
    database = new DatabaseSync(file);
    database.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS idx_records_owner_kind ON records(owner_id, kind);');
  }
  return database;
}
