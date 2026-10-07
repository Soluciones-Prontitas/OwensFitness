import { OAuth2Client } from 'google-auth-library';
import { appOrigin, basePath } from './auth';
export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const googleCallback = () => `${appOrigin()}${basePath}/api/auth/google/callback/`;
export function googleClient() { if(!googleConfigured())throw new Error('Google no está configurado'); return new OAuth2Client(process.env.GOOGLE_CLIENT_ID,process.env.GOOGLE_CLIENT_SECRET,googleCallback()); }
