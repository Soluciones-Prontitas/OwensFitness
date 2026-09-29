import { newSession, validPassword } from '@/lib/auth';
export const runtime = 'nodejs';
const attempts=new Map<string,{count:number;until:number}>();
export async function POST(request: Request) {
  const address=request.headers.get('x-real-ip') || 'unknown';
  const now=Date.now(), entry=attempts.get(address);
  if(entry && entry.until>now && entry.count>=5)return Response.json({error:'Espera 15 minutos antes de intentar de nuevo'},{status:429});
  try { const body:any=await request.json(); if (!validPassword(String(body.password || ''))) { const count=(entry && entry.until>now ? entry.count : 0)+1; attempts.set(address,{count,until:now+15*60*1000}); return Response.json({error:'Contraseña incorrecta'},{status:401}); }
    attempts.delete(address);
    const response=Response.json({ok:true}); response.headers.append('Set-Cookie',`owens_session=${newSession()}; Path=${process.env.NEXT_PUBLIC_BASE_PATH || '/'}; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`); return response;
  } catch(e) { console.error(e); return Response.json({error:'No se pudo iniciar sesión'},{status:500}); }
}
