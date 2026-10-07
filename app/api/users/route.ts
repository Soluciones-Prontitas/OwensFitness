import { readBody } from '@/lib/http';
import { currentUser,sameOrigin } from '@/lib/auth';
import { hashPassword,identity,normalizeUsername,userById,type UserRow } from '@/lib/accounts';
import { db } from '@/lib/database';
import { hasRole,managesTraining,LOCAL_ID } from '@/lib/roles';
import { AccessError,rowsFor } from '@/lib/record-access';
export const runtime='nodejs';
const safe=(r:UserRow)=>({...identity(r),username:r.username,active:!!r.active});
const fail=(e:unknown)=>Response.json({error:e instanceof AccessError?e.message:e instanceof Error&&e.message.includes('UNIQUE')?'Ese correo, usuario o atleta ya tiene una cuenta.':e instanceof Error&&/contraseña|usuario debe/.test(e.message)?e.message:'No se pudo actualizar la cuenta'},{status:e instanceof AccessError?e.status:400});
export async function GET(){const user=await currentUser();if(!user)return Response.json({error:'Acceso requerido'},{status:401});if(!managesTraining(user))return Response.json({error:'Acceso no permitido'},{status:403});
  const rows=db().prepare(hasRole(user,'admin')?'SELECT * FROM users':'SELECT * FROM users WHERE instructor_id=?').all(...(hasRole(user,'admin')?[]:[user.id])) as UserRow[];
  const all=db().prepare('SELECT * FROM users WHERE active=1').all() as UserRow[];
  return Response.json({users:rows.filter(r=>r.id!==LOCAL_ID).map(safe),instructors:all.filter(r=>JSON.parse(r.roles).includes('instructor')&&(hasRole(user,'admin')||r.id===user.id)).map(safe),athletes:rowsFor(user).filter(r=>r.kind==='athlete').map(r=>({id:r.id,ownerId:r.owner_id,name:JSON.parse(r.data).name}))},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){const user=await currentUser();if(!user)return Response.json({error:'Acceso requerido'},{status:401});if(!sameOrigin(request)||!managesTraining(user))return Response.json({error:'Acceso no permitido'},{status:403});
  try {
    const body=await readBody(request),id=crypto.randomUUID(),name=String(body.name||'').trim().slice(0,150);if(!name)throw new AccessError('Indica el nombre',400);
    if(body.type==='google'){
      if(!hasRole(user,'admin'))throw new AccessError('Solo administración puede autorizar cuentas de Google');
      const email=String(body.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new AccessError('Correo inválido',400);
      const roles=validRoles(body.roles,hasRole(user,'support'));
      db().prepare('INSERT INTO users(id,name,email,roles,created_at) VALUES(?,?,?,?,?)').run(id,name,email,JSON.stringify(roles),Date.now());
    } else {
      const athlete=rowsFor(user).find(r=>r.id===body.athleteId&&r.kind==='athlete');if(!athlete)throw new AccessError('Selecciona una ficha de atleta de tu instructor',400);
      const username=normalizeUsername(body.username),hash=await hashPassword(body.password);
      db().prepare('INSERT INTO users(id,name,username,password_hash,roles,instructor_id,athlete_id,must_change_password,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,name,username,hash,'["student"]',athlete.owner_id,athlete.id,1,Date.now());
    }
    return Response.json({user:safe(userById(id)!)},{status:201});
  }catch(e){return fail(e);}
}
function validRoles(value:unknown,canSupport:boolean){if(!Array.isArray(value)||!value.length||value.some(r=>!['admin','instructor','support'].includes(r)))throw new AccessError('Selecciona roles válidos',400);if(value.includes('support')&&!canSupport)throw new AccessError('Solo administración con soporte puede asignar soporte');return [...new Set(value)];}
export async function PATCH(request:Request){const user=await currentUser();if(!user)return Response.json({error:'Acceso requerido'},{status:401});if(!sameOrigin(request)||!managesTraining(user))return Response.json({error:'Acceso no permitido'},{status:403});
  try {
    const body=await readBody(request),row=userById(body.id);if(!row||row.id===LOCAL_ID)throw new AccessError('Cuenta no encontrada',404);
    const student=JSON.parse(row.roles).includes('student');
    if(!hasRole(user,'admin')&&(!student||row.instructor_id!==user.id))throw new AccessError('Solo puedes gestionar las cuentas de tus alumnos');
    if(row.id===user.id)throw new AccessError('No puedes cambiar los permisos de tu propia cuenta');
    if(JSON.parse(row.roles).includes('support')&&!hasRole(user,'support'))throw new AccessError('Solo administración con soporte puede gestionar esta cuenta');
    let hash=row.password_hash,roles=row.roles,active=row.active,mustChange=row.must_change_password;
    if(body.password!==undefined){if(!student)throw new AccessError('Las cuentas de Google no usan contraseña local');hash=await hashPassword(body.password);mustChange=1;}
    if(body.roles!==undefined){if(!hasRole(user,'admin')||student)throw new AccessError('No puedes cambiar estos roles');const changed=validRoles(body.roles,hasRole(user,'support'));if(JSON.parse(row.roles).includes('instructor')&&!changed.includes('instructor')){
      if(db().prepare('SELECT id FROM records WHERE owner_id=? LIMIT 1').get(row.id)||db().prepare('SELECT id FROM users WHERE instructor_id=? LIMIT 1').get(row.id))throw new AccessError('Este instructor tiene registros o alumnos asignados',409);
    } roles=JSON.stringify(changed);}
    if(body.active!==undefined){if(typeof body.active!=='boolean')throw new AccessError('Estado inválido',400);active=body.active?1:0;}
    db().exec('BEGIN IMMEDIATE');try{db().prepare('UPDATE users SET password_hash=?,roles=?,active=?,must_change_password=? WHERE id=?').run(hash,roles,active,mustChange,row.id);db().prepare('DELETE FROM sessions WHERE user_id=?').run(row.id);db().exec('COMMIT');}catch(e){db().exec('ROLLBACK');throw e;}
    return Response.json({user:safe(userById(row.id)!)});
  }catch(e){return fail(e);}
}
