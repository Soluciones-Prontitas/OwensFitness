import { cookieValue, endSession, sameOrigin } from '@/lib/auth';
export const runtime = 'nodejs';
export async function POST(request:Request) {
  if(!sameOrigin(request))return Response.json({error:'Origen no permitido'},{status:403});
  await endSession(); const response=Response.json({ok:true});
  response.headers.append('Set-Cookie',cookieValue('owens_session','',0)); return response;
}
