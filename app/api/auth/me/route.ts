import { currentUser } from '@/lib/auth';
export const runtime='nodejs';
export async function GET(){const user=await currentUser();return Response.json(user?{user}:{error:'Acceso requerido'},{status:user?200:401,headers:{'Cache-Control':'no-store'}});}
