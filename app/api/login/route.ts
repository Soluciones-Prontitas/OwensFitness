import { attachSession, basePath, clearAttempts, failedAttempt, locked, loginKey, sameOrigin, validPassword } from '@/lib/auth';
import { readBody } from '@/lib/http';
import { db } from '@/lib/database';
import { verifyPassword, type UserRow } from '@/lib/accounts';
import { LOCAL_ID } from '@/lib/roles';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const isForm = (request.headers.get('content-type') || '').includes('application/x-www-form-urlencoded');
  const failure = (message:string,status:number,code:string) => isForm ? new Response(null,{status:303,headers:{Location:`${basePath}/login/?error=${code}`,'Cache-Control':'no-store'}}) : Response.json({error:message},{status});
  if(!sameOrigin(request)) return failure('Origen no permitido',403,'origin');
  try {
    const body:Record<string,any> = isForm ? Object.fromEntries(await request.formData()) : await readBody(request);
    const username = String(body.username || '').trim().toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const key=loginKey(request,username), ipKey=loginKey(request,'*');
    if(locked(key)||locked(ipKey))return failure('Espera 15 minutos antes de intentar de nuevo',429,'locked');
    if(password.length>256)return failure('Usuario o contraseña incorrectos',401,'invalid');
    // The existing password-only form remains the local administration/support access.
    let userId:string|null=null;
    if(!username) { if(validPassword(password))userId=LOCAL_ID; }
    else {
      const row=db().prepare('SELECT * FROM users WHERE username=?').get(username) as UserRow|undefined;
      const matches=await verifyPassword(password,row?.password_hash || null);
      if(matches&&row?.active&&JSON.parse(row.roles).includes('student'))userId=row.id;
    }
    if(!userId){failedAttempt(key);failedAttempt(ipKey);return failure('Usuario o contraseña incorrectos',401,'invalid');}
    clearAttempts(key); clearAttempts(ipKey);
    const response=isForm?new Response(null,{status:303,headers:{Location:`${basePath}/`}}):Response.json({ok:true});
    return attachSession(response,userId);
  } catch { return failure('No se pudo iniciar sesión',500,'server'); }
}
