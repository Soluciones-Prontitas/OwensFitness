import { currentUser } from '@/lib/auth';
import { hasRole } from '@/lib/roles';
import { db } from '@/lib/database';
import { googleConfigured } from '@/lib/google';
export const runtime='nodejs';
export async function GET(){const user=await currentUser();if(!user)return Response.json({error:'Acceso requerido'},{status:401});if(!hasRole(user,'support'))return Response.json({error:'Acceso no permitido'},{status:403});try{db().prepare('SELECT 1').get();return Response.json({database:'Disponible',google:googleConfigured()?'Configurado':'Pendiente de configuración',serverTime:new Date().toISOString(),node:process.version},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'La base de datos no responde'},{status:503});}}
