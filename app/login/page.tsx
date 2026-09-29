'use client';
import { useState } from 'react';
export default function Login() {
  const [password,setPassword] = useState(''); const [error,setError] = useState(''); const [busy,setBusy] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { const r=await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})}); if(!r.ok) throw new Error('Contraseña incorrecta'); window.location.href=process.env.NEXT_PUBLIC_BASE_PATH || '/'; } catch(e) { setError(e instanceof Error?e.message:'No se pudo iniciar sesión'); setBusy(false); } }
  return <main className="login-page"><form onSubmit={submit} className="login-card"><div className="brand"><span className="brand-mark">O</span><span>OWEN’S<br/><b>FITNESS</b></span></div><h1>Acceso al panel</h1><label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>{error&&<p role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?'Entrando…':'Entrar'}</button></form></main>;
}
