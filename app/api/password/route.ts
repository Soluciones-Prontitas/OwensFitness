import { readBody } from '@/lib/http';
import { currentUser, sameOrigin, attachSession, digest } from '@/lib/auth';
import { hashPassword, userById, verifyPassword } from '@/lib/accounts';
import { db } from '@/lib/database';
import { hasRole } from '@/lib/roles';
export const runtime='nodejs';
export async function POST(request:Request) {
  const user=await currentUser();if(!user)return Response.json({error:'Acceso requerido'},{status:401});
  if(!sameOrigin(request)||!hasRole(user,'student'))return Response.json({error:'Acceso no permitido'},{status:403});
  try {
    const body=await readBody(request),row=userById(user.id)!;
    if(typeof body.currentPassword!=='string'||body.currentPassword.length>256||!(await verifyPassword(body.currentPassword,row.password_hash)))return Response.json({error:'La contraseña actual no es correcta'},{status:400});
    if(body.password===body.currentPassword)return Response.json({error:'Elige una contraseña diferente de la temporal'},{status:400});
    const hash=await hashPassword(body.password);
    db().exec('BEGIN IMMEDIATE');try{db().prepare('UPDATE users SET password_hash=?,must_change_password=0 WHERE id=?').run(hash,user.id);db().prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);db().exec('COMMIT');}catch(e){db().exec('ROLLBACK');throw e;}
    return attachSession(Response.json({ok:true}),user.id);
  } catch(error){return Response.json({error:error instanceof Error?error.message:'No se pudo cambiar la contraseña'},{status:400});}
}
