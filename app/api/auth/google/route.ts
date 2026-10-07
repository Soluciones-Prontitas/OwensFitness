import { randomBytes } from 'node:crypto';
import { basePath, cookieValue, digest } from '@/lib/auth';
import { db } from '@/lib/database';
import { googleClient } from '@/lib/google';
import { CodeChallengeMethod } from 'google-auth-library';
export const runtime = 'nodejs';
export async function GET() {
  try {
    const client=googleClient(), state=randomBytes(32).toString('base64url'), nonce=randomBytes(32).toString('base64url');
    const {codeVerifier,codeChallenge}=await client.generateCodeVerifierAsync();
    db().prepare('DELETE FROM oauth_states WHERE expires_at<=?').run(Date.now());
    db().prepare('INSERT INTO oauth_states(state_hash,nonce,verifier,expires_at) VALUES(?,?,?,?)').run(digest(state),nonce,codeVerifier,Date.now()+600000);
    const url=client.generateAuthUrl({scope:['openid','email','profile'],state,nonce,prompt:'select_account',code_challenge:codeChallenge,code_challenge_method:CodeChallengeMethod.S256});
    return new Response(null,{status:303,headers:{Location:url,'Set-Cookie':cookieValue('owens_oauth',state,600),'Cache-Control':'no-store'}});
  } catch { return new Response(null,{status:303,headers:{Location:`${basePath}/login/?error=google_config`,'Cache-Control':'no-store'}}); }
}
