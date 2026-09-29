export const runtime = 'nodejs';
export async function POST() { const response=Response.json({ok:true}); response.headers.append('Set-Cookie',`owens_session=; Path=${process.env.NEXT_PUBLIC_BASE_PATH || '/'}; HttpOnly; Secure; SameSite=Lax; Max-Age=0`); return response; }
