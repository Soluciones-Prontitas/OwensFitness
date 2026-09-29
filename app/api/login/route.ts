import { newSession, validPassword } from '@/lib/auth';

export const runtime = 'nodejs';
const attempts = new Map<string, { count: number; until: number }>();
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export async function POST(request: Request) {
  const isForm = (request.headers.get('content-type') || '').includes('application/x-www-form-urlencoded');
  const failure = (message: string, status: number, code: string) => isForm
    ? new Response(null, { status: 303, headers: { Location: `${basePath}/login/?error=${code}` } })
    : Response.json({ error: message }, { status });

  const address = request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || 'unknown';
  const now = Date.now();
  const entry = attempts.get(address);
  if (entry && entry.until > now && entry.count >= 5) {
    return failure('Espera 15 minutos antes de intentar de nuevo', 429, 'locked');
  }

  try {
    let input: string;
    if (isForm) {
      const form = await request.formData();
      input = String(form.get('password') || '');
    } else {
      const body: unknown = await request.json();
      input = body && typeof body === 'object' && 'password' in body ? String(body.password || '') : '';
    }
    if (!validPassword(input)) {
      const count = (entry && entry.until > now ? entry.count : 0) + 1;
      attempts.set(address, { count, until: now + 15 * 60 * 1000 });
      return failure('Contraseña incorrecta', 401, 'invalid');
    }

    attempts.delete(address);
    const response = isForm
      ? new Response(null, { status: 303, headers: { Location: `${basePath}/` } })
      : Response.json({ ok: true });
    response.headers.append('Set-Cookie', `owens_session=${newSession()}; Path=${basePath || '/'}; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    console.error(error);
    return failure('No se pudo iniciar sesión', 500, 'server');
  }
}
