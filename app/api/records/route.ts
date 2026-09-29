import { authorized } from '@/lib/auth';
import { db } from '@/lib/database';
export const runtime = 'nodejs';
const kinds = new Set(['athlete','exercise','structure','session','payment','product','order']);
const deny = () => Response.json({error:'Acceso requerido'},{status:401});
const fail = (error: unknown) => { console.error('records',error); return Response.json({error:'No se pudieron guardar o cargar los datos.'},{status:503}); };
type Row = {id:string; kind:string; data:string; created_at:number};
export async function GET() {
  if (!(await authorized())) return deny();
  try { const rows=db().prepare('SELECT id,kind,data,created_at FROM records WHERE owner_id=? ORDER BY created_at DESC').all('admin') as Row[]; return Response.json({records:rows.map(r=>({...JSON.parse(r.data),id:r.id,kind:r.kind,createdAt:r.created_at}))}); } catch(e) { return fail(e); }
}
export async function POST(request:Request) {
  if (!(await authorized())) return deny();
  try { const body:any=await request.json(); if(!kinds.has(body.kind)||!body.data||typeof body.data!=='object'||Array.isArray(body.data)) return Response.json({error:'Registro inválido'},{status:400}); const {id:_id,kind:_kind,createdAt:_at,...clean}=body.data; const data=JSON.stringify(clean); if(data.length>50000)return Response.json({error:'Registro demasiado grande'},{status:400}); const id=crypto.randomUUID(),createdAt=Date.now(); db().prepare('INSERT INTO records(id,owner_id,kind,data,created_at) VALUES(?,?,?,?,?)').run(id,'admin',body.kind,data,createdAt); return Response.json({record:{...clean,id,kind:body.kind,createdAt}},{status:201}); } catch(e) { return fail(e); }
}
export async function PATCH(request:Request) {
  if (!(await authorized())) return deny();
  try { const body:any=await request.json(); if(!body.id||!body.data||typeof body.data!=='object'||Array.isArray(body.data))return Response.json({error:'Registro inválido'},{status:400}); const row=db().prepare('SELECT data FROM records WHERE id=? AND owner_id=?').get(body.id,'admin') as {data:string}|undefined; if(!row)return Response.json({error:'Registro no encontrado'},{status:404}); const {id:_id,kind:_kind,createdAt:_at,...clean}=body.data; const merged={...JSON.parse(row.data),...clean},data=JSON.stringify(merged); if(data.length>50000)return Response.json({error:'Registro demasiado grande'},{status:400}); db().prepare('UPDATE records SET data=? WHERE id=? AND owner_id=?').run(data,body.id,'admin'); return Response.json({id:body.id,...merged}); } catch(e) { return fail(e); }
}
export async function DELETE(request:Request) {
  if (!(await authorized())) return deny(); const id=new URL(request.url).searchParams.get('id'); if(!id)return Response.json({error:'Falta el ID'},{status:400}); try {db().prepare('DELETE FROM records WHERE id=? AND owner_id=?').run(id,'admin');return Response.json({ok:true});}catch(e){return fail(e);}
}
