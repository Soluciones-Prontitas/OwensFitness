import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from './database';
import { identity, userById } from './accounts';
import { LOCAL_ID, type Identity } from './roles';
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/OwensFitness';
export const appOrigin = () => new URL(process.env.APP_ORIGIN || 'https://solucionesprontitas.com').origin;
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const secret = () => { const value = process.env.SESSION_SECRET; if (!value || value.length < 32) throw new Error('SESSION_SECRET debe tener al menos 32 caracteres'); return value; };
export function sessionFromToken(token: string): Identity | null {
  if (!/^v2\.[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const session = db().prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?').get(digest(token),Date.now()) as {user_id:string}|undefined;
  const row = session && userById(session.user_id);
  return row?.active ? identity(row) : null;
}
export async function currentUser() { return sessionFromToken((await cookies()).get('owens_session')?.value || ''); }
export async function authorized() { return !!(await currentUser()); }
export function newSession(userId = LOCAL_ID) {
  if (!userById(userId)?.active) throw new Error('Cuenta inactiva');
  const token = `v2.${randomBytes(32).toString('base64url')}`;
  db().prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
  db().prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(digest(token),userId,Date.now()+7*86400000);
  return token;
}
export const cookieValue = (name: string, value: string, maxAge: number) => `${name}=${value}; Path=${basePath}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
export function attachSession(response: Response, userId: string) { response.headers.append('Set-Cookie', cookieValue('owens_session',newSession(userId),604800)); response.headers.set('Cache-Control','no-store'); return response; }
export async function endSession() { const token = (await cookies()).get('owens_session')?.value; if(token) db().prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token)); }
export function validPassword(input: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length < 12) throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres');
  return timingSafeEqual(createHmac('sha256',secret()).update(input).digest(),createHmac('sha256',secret()).update(expected).digest());
}
export function sameOrigin(request: Request) { return request.headers.get('origin') === appOrigin(); }
export function loginKey(request: Request, username = '') { const address = request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || 'unknown'; return createHmac('sha256',secret()).update(`${address}:${username}`).digest('hex'); }
export function locked(key: string) { const row=db().prepare('SELECT count,until_at FROM login_attempts WHERE key=?').get(key) as {count:number;until_at:number}|undefined; return !!row && row.count>=5 && row.until_at>Date.now(); }
export function failedAttempt(key: string) { const now=Date.now(); db().prepare('DELETE FROM login_attempts WHERE until_at<=?').run(now); db().prepare('INSERT INTO login_attempts(key,count,until_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,now+15*60000); }
export function clearAttempts(key: string) { db().prepare('DELETE FROM login_attempts WHERE key=?').run(key); }
