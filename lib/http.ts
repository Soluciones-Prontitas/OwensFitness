import { AccessError } from './record-access';
export async function readBody(request:Request):Promise<Record<string,any>> {const body:unknown=await request.json();if(!body||typeof body!=='object'||Array.isArray(body))throw new AccessError('Solicitud inválida',400);return body as Record<string,any>;}
