import { cookies } from 'next/headers';
import { timingSafeEqual } from 'node:crypto';
import { attachSession, basePath, cookieValue, digest } from '@/lib/auth';
import { db } from '@/lib/database';
import { googleCallback, googleClient } from '@/lib/google';
import { type UserRow } from '@/lib/accounts';
export const runtime = 'nodejs';
export async function GET(request:Request) {
  const finish=(location:string)=>new Response(null,{status:303,headers:{Location:location,'Set-Cookie':cookieValue('owens_oauth','',0),'Cache-Control':'no-store'}});
  const fail=(code:string)=>finish(`${basePath}/login/?error=${code}`);
  const url=new URL(request.url),state=url.searchParams.get('state')||'',saved=(await cookies()).get('owens_oauth')?.value||'';
  if(!/^[A-Za-z0-9_-]{43}$/.test(state)||state.length!==saved.length||!timingSafeEqual(Buffer.from(state),Buffer.from(saved)))return fail('google_state');
  const flow=db().prepare('DELETE FROM oauth_states WHERE state_hash=? RETURNING *').get(digest(state)) as {nonce:string;verifier:string;expires_at:number}|undefined;
  if(!flow||flow.expires_at<Date.now())return fail('google_state');
  if(url.searchParams.has('error'))return fail('google_cancelled');
  const code=url.searchParams.get('code'); if(!code)return fail('google_state');
  try {
    const client=googleClient(); const {tokens}=await client.getToken({code,codeVerifier:flow.verifier,redirect_uri:googleCallback()});
    if(!tokens.id_token)return fail('google_identity');
    const ticket=await client.verifyIdToken({idToken:tokens.id_token,audience:process.env.GOOGLE_CLIENT_ID});
    const payload=ticket.getPayload();
    if(!payload||!payload.sub||!payload.email_verified||!payload.email||(payload as typeof payload & {nonce?:string}).nonce!==flow.nonce)return fail('google_identity');
    const email=payload.email.toLowerCase();
    const row=db().prepare('SELECT * FROM users WHERE google_sub=? OR (email=? AND google_sub IS NULL)').get(payload.sub,email) as UserRow|undefined;
    if(!row?.active||JSON.parse(row.roles).includes('student'))return fail('google_denied');
    if(row.google_sub&&row.email?.toLowerCase()!==email)return fail('google_denied');
    if(!row.google_sub)db().prepare('UPDATE users SET google_sub=? WHERE id=? AND google_sub IS NULL').run(payload.sub,row.id);
    return attachSession(finish(`${basePath}/`),row.id);
  } catch { return fail('google_identity'); }
}
