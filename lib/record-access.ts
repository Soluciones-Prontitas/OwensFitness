import { db } from './database';
import { instructor } from './accounts';
import { hasRole, managesTraining, PEPE_ID, type Identity } from './roles';
export const kinds=new Set(['athlete','exercise','structure','session','payment','product','order','progress']);
export type RecordRow={id:string;owner_id:string;kind:string;data:string;created_at:number};
export type RecordData=Record<string,unknown>;
export class AccessError extends Error { constructor(message:string,public status=403){super(message);} }
export function trainingOwner(user:Identity,requested?:unknown):string {
  if(!managesTraining(user))throw new AccessError('Este perfil no puede gestionar entrenamiento');
  if(requested&&typeof requested!=='string')throw new AccessError('Instructor inválido',400);
  const owner=String(requested||(hasRole(user,'instructor')?user.id:PEPE_ID));
  if(!hasRole(user,'admin')&&owner!==user.id)throw new AccessError('Solo puedes acceder a tus propios registros');
  if(!instructor(owner))throw new AccessError('Instructor no disponible',400);
  return owner;
}
export function rowsFor(user:Identity,owner?:string):RecordRow[] {
  if(user.mustChangePassword)throw new AccessError('Cambia tu contraseña temporal antes de continuar');
  if(hasRole(user,'admin')) { if(owner)trainingOwner(user,owner); return db().prepare(`SELECT * FROM records ${owner?'WHERE owner_id=?':''} ORDER BY created_at DESC`).all(...(owner?[owner]:[])) as RecordRow[]; }
  if(hasRole(user,'instructor')) { if(owner&&owner!==user.id)throw new AccessError('Solo puedes acceder a tus propios registros'); return db().prepare('SELECT * FROM records WHERE owner_id=? ORDER BY created_at DESC').all(user.id) as RecordRow[]; }
  if(!hasRole(user,'student')||!user.athleteId||!user.instructorId)throw new AccessError('Este perfil solo tiene acceso al panel de soporte');
  const rows=db().prepare('SELECT * FROM records WHERE owner_id=? ORDER BY created_at DESC').all(user.instructorId) as RecordRow[];
  const linkedSessions=rows.filter(r=>r.kind==='session'&&assigned(JSON.parse(r.data),user.athleteId!));
  const structureIds=new Set(linkedSessions.map(r=>JSON.parse(r.data).structureId));
  const linkedStructures=rows.filter(r=>r.kind==='structure'&&structureIds.has(r.id));
  const exerciseIds=new Set(linkedStructures.flatMap(r=>(JSON.parse(r.data).moves||[]).map((m:{exerciseId?:string})=>m.exerciseId)));
  return rows.filter(r=>r.kind==='athlete'?r.id===user.athleteId:r.kind==='session'?linkedSessions.some(s=>s.id===r.id):r.kind==='structure'?structureIds.has(r.id):r.kind==='exercise'?exerciseIds.has(r.id):['payment','order','progress'].includes(r.kind)?JSON.parse(r.data).athleteId===user.athleteId:false);
}
export function assigned(data:RecordData,athleteId:string){return Array.isArray(data.athleteIds)&&data.athleteIds.includes(athleteId);}
export function publicRecord(row:RecordRow,user:Identity){
  let data=JSON.parse(row.data);
  if(hasRole(user,'student')) {
    if(row.kind==='session')data={title:data.title,date:data.date,start:data.start,end:data.end,place:data.place,modality:data.modality,structureId:data.structureId,athleteIds:[user.athleteId]};
    if(row.kind==='payment')data={athleteId:user.athleteId,concept:data.concept,amount:data.amount,date:data.date,due:data.due,status:data.status,creditAmount:data.creditAmount};
  }
  return {...data,id:row.id,kind:row.kind,ownerId:row.owner_id,createdAt:row.created_at};
}
export function cleanData(input:unknown):RecordData {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new AccessError('Registro inválido',400);
  const {id:_id,kind:_kind,createdAt:_at,ownerId:_owner,owner_id:_ownerSnake,__proto__:_proto,...data}=input as RecordData;
  if(JSON.stringify(data).length>50000)throw new AccessError('Registro demasiado grande',400);
  return data;
}
export function validateReferences(kind:string,data:RecordData,owner:string) {
  const reference=(id:unknown,expected:string)=>{if(typeof id!=='string'||!db().prepare('SELECT id FROM records WHERE id=? AND owner_id=? AND kind=?').get(id,owner,expected))throw new AccessError('El registro vinculado debe pertenecer al mismo instructor',400);};
  if(data.athleteId)reference(data.athleteId,'athlete');
  if(kind==='payment'&&!data.athleteId)throw new AccessError('Selecciona un atleta',400);
  if(kind==='session') {
    if(data.structureId)reference(data.structureId,'structure');
    if(data.athleteIds!==undefined&&!Array.isArray(data.athleteIds))throw new AccessError('Selecciona atletas válidos',400);
    for(const id of (data.athleteIds||[]) as unknown[])reference(id,'athlete');
  }
  if(kind==='structure') {
    if(data.moves!==undefined&&!Array.isArray(data.moves))throw new AccessError('Movimientos inválidos',400);
    for(const move of (data.moves||[]) as {exerciseId?:string}[]) { if(!move||typeof move!=='object')throw new AccessError('Movimiento inválido',400); if(move.exerciseId)reference(move.exerciseId,'exercise'); }
  }
  if(kind==='order') {
    if(!Array.isArray(data.items)||!data.items.length)throw new AccessError('El pedido debe contener productos',400);
    for(const item of data.items as {productId?:string}[]){if(!item||typeof item!=='object')throw new AccessError('Producto inválido',400);reference(item.productId,'product');}
  }
  if(kind==='progress'){reference(data.athleteId,'athlete');reference(data.sessionId,'session');}
}
export function studentProgress(user:Identity,input:unknown):RecordData {
  if(!hasRole(user,'student')||!user.athleteId||!user.instructorId)throw new AccessError('Solo los alumnos pueden registrar su avance');
  const data=cleanData(input);
  const session=rowsFor(user).find(r=>r.id===data.sessionId&&r.kind==='session');
  if(!session)throw new AccessError('Esta sesión no está asignada a tu cuenta');
  if(typeof data.notes!=='string'||data.notes.length>3000)throw new AccessError('El avance debe tener como máximo 3000 caracteres',400);
  return {athleteId:user.athleteId,sessionId:session.id,notes:data.notes,completed:data.completed===true,date:new Date().toISOString().slice(0,10)};
}
