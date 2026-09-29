import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const secret = () => { const value = process.env.SESSION_SECRET; if (!value || value.length < 32) throw new Error('SESSION_SECRET debe tener al menos 32 caracteres'); return value; };
const signature = (value: string) => createHmac('sha256', secret()).update(value).digest('hex');
export function newSession() { const expires = String(Date.now() + 7 * 86400000); return `${expires}.${signature(expires)}`; }
export async function authorized() {
  const token = (await cookies()).get('owens_session')?.value || '';
  const [expires, mac] = token.split('.');
  if (!expires || !mac || Number(expires) < Date.now() || !/^\d+$/.test(expires) || !/^[0-9a-f]{64}$/.test(mac)) return false;
  return timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(signature(expires), 'hex'));
}
export function validPassword(input: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length < 12) throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres');
  const a = createHmac('sha256', secret()).update(input).digest();
  const b = createHmac('sha256', secret()).update(expected).digest();
  return timingSafeEqual(a, b);
}
