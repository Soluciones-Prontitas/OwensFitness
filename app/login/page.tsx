'use client';
import { useState, type FormEvent } from 'react';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${basePath}/api/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        cache: 'no-store',
      });
      if (!response.ok) {
        const result: { error?: string } | null = await response.json().catch(() => null);
        throw new Error(typeof result?.error === 'string' ? result.error : 'No se pudo iniciar sesión');
      }
      window.location.assign(`${basePath}/`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión');
      setBusy(false);
    }
  }

  return <main className="login-page">
    <form onSubmit={submit} className="login-card">
      <div className="brand"><span className="brand-mark">O</span><span>OWEN’S<br/><b>FITNESS</b></span></div>
      <h1>Acceso al panel</h1>
      <label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="primary" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
    </form>
  </main>;
}
