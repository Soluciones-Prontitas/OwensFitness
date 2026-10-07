import { readBody } from '@/lib/http';
import { currentUser, sameOrigin } from '@/lib/auth';
import { db } from '@/lib/database';
import { hasRole, managesTraining } from '@/lib/roles';
import { AccessError,cleanData,kinds,publicRecord,rowsFor,studentProgress,trainingOwner,validateReferences,type RecordRow } from '@/lib/record-access';
export const runtime='nodejs';
const deny=()=>Response.json({error:'Acceso requerido'},{status:401});
const fail=(error:unknown)=>error instanceof AccessError?Response.json({error:error.message},{status:error.status}):Response.json({error:'No se pudieron guardar o cargar los datos.'},{status:503});
export async function GET(request:Request){const user=await currentUser();if(!user)return deny();try{return Response.json({records:rowsFor(user,new URL(request.url).searchParams.get('ownerId')||undefined).map(row=>publicRecord(row,user))},{headers:{'Cache-Control':'no-store'}});}catch(e){return fail(e);}}
export async function POST(request:Request){
  const user=await currentUser();if(!user)return deny();if(!sameOrigin(request))return Response.json({error:'Origen no permitido'},{status:403});
  try {
    if(user.mustChangePassword)throw new AccessError('Cambia tu contraseña temporal');
    const body=await readBody(request);if(!kinds.has(body.kind))throw new AccessError('Registro inválido',400);
    const student=hasRole(user,'student');
    if(student&&body.kind!=='progress')throw new AccessError('Solo puedes registrar tus avances');
    if(!student&&!managesTraining(user))throw new AccessError('Este perfil no puede guardar datos del gimnasio');
    const owner=student?user.instructorId!:trainingOwner(user,body.ownerId),data=student?studentProgress(user,body.data):cleanData(body.data);
    validateReferences(body.kind,data,owner);
    const row:RecordRow={id:crypto.randomUUID(),owner_id:owner,kind:body.kind,data:JSON.stringify(data),created_at:Date.now()};
    db().prepare('INSERT INTO records(id,owner_id,kind,data,created_at) VALUES(?,?,?,?,?)').run(row.id,owner,row.kind,row.data,row.created_at);
    return Response.json({record:publicRecord(row,user)},{status:201});
  }catch(e){return fail(e);}
}
export async function PATCH(request:Request){
  const user=await currentUser();if(!user)return deny();if(!sameOrigin(request))return Response.json({error:'Origen no permitido'},{status:403});
  try {
    const body=await readBody(request);if(typeof body.id!=='string')throw new AccessError('Registro inválido',400);
    const row=rowsFor(user).find(r=>r.id===body.id);if(!row)throw new AccessError('Registro no encontrado',404);
    const student=hasRole(user,'student');if(student&&row.kind!=='progress')throw new AccessError('Solo puedes modificar tus avances');
    const data=student?studentProgress(user,{...JSON.parse(row.data),...cleanData(body.data)}):{...JSON.parse(row.data),...cleanData(body.data)};
    if(JSON.stringify(data).length>50000)throw new AccessError('Registro demasiado grande',400);
    validateReferences(row.kind,data,row.owner_id);db().prepare('UPDATE records SET data=? WHERE id=? AND owner_id=?').run(JSON.stringify(data),row.id,row.owner_id);
    return Response.json(publicRecord({...row,data:JSON.stringify(data)},user));
  }catch(e){return fail(e);}
}
export async function DELETE(request:Request){
  const user=await currentUser();if(!user)return deny();if(!sameOrigin(request))return Response.json({error:'Origen no permitido'},{status:403});
  try {
    const id=new URL(request.url).searchParams.get('id');const row=rowsFor(user).find(r=>r.id===id);if(!row)throw new AccessError('Registro no encontrado',404);
    if(hasRole(user,'student')&&row.kind!=='progress')throw new AccessError('Solo puedes eliminar tus avances');
    if(row.kind==='athlete'&&db().prepare('SELECT id FROM users WHERE athlete_id=?').get(row.id))throw new AccessError('Este atleta tiene una cuenta vinculada. Conserva su ficha y desactiva el acceso en Usuarios',409);
    db().prepare('DELETE FROM records WHERE id=? AND owner_id=?').run(row.id,row.owner_id);return Response.json({ok:true});
  }catch(e){return fail(e);}
}
