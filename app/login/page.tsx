const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

type LoginProps = { searchParams: Promise<{ error?: string }> };

export default async function Login({ searchParams }: LoginProps) {
  const { error } = await searchParams;
  const message = error === 'invalid' ? 'Contraseña incorrecta.'
    : error === 'locked' ? 'Demasiados intentos. Espera 15 minutos antes de intentar de nuevo.'
    : error ? 'No se pudo iniciar sesión. Inténtalo de nuevo.' : '';

  return <main className="login-page">
    <form action={`${basePath}/api/login/`} method="post" className="login-card">
      <div className="brand"><span className="brand-mark">O</span><span>OWEN’S<br/><b>FITNESS</b></span></div>
      <h1>Acceso al panel</h1>
      <label>Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
      {message && <p role="alert">{message}</p>}
      <button type="submit" className="primary">Entrar</button>
    </form>
  </main>;
}
