import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { db } from './database';
import { type Identity, type Role } from './roles';
export type UserRow = {id: string; name: string; email: string | null; google_sub: string | null; username: string | null; password_hash: string | null; roles: string; instructor_id: string | null; athlete_id: string | null; active: number; must_change_password: number; created_at: number};
export function identity(row: UserRow): Identity { return {id: row.id, name: row.name, email: row.email, roles: JSON.parse(row.roles) as Role[], instructorId: row.instructor_id, athleteId: row.athlete_id, mustChangePassword: !!row.must_change_password}; }
export function userById(id: string) { return db().prepare('SELECT * FROM users WHERE id=?').get(id) as UserRow | undefined; }
export function instructor(id: string) { const row = userById(id); return row?.active && JSON.parse(row.roles).includes('instructor') ? row : undefined; }
export function normalizeUsername(value: unknown) { const name = String(value || '').trim().toLowerCase(); if (!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(name)) throw new Error('El usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.'); return name; }
export function checkPassword(value: unknown): string { if (typeof value !== 'string' || value.length < 12 || value.length > 256) throw new Error('La contraseña debe tener entre 12 y 256 caracteres.'); return value; }
function derive(password: string, salt: string): Promise<Buffer> { return new Promise((resolve, reject) => scrypt(password, salt, 64, {N:32768,r:8,p:1,maxmem:64*1024*1024}, (error, key) => error ? reject(error) : resolve(key))); }
export async function hashPassword(value: unknown) { const password = checkPassword(value), salt = randomBytes(16).toString('hex'); return `scrypt:${salt}:${(await derive(password,salt)).toString('hex')}`; }
export async function verifyPassword(password: string, stored: string | null) { const [, salt, hex] = (stored || '').split(':'); const valid = /^[0-9a-f]{32}$/.test(salt || '') && /^[0-9a-f]{128}$/.test(hex || ''); const key = await derive(password.slice(0,257), valid ? salt : '00000000000000000000000000000000'); return valid && timingSafeEqual(key, Buffer.from(hex, 'hex')); }
