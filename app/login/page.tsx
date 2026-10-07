import { basePath } from '@/lib/auth';
import { googleConfigured } from '@/lib/google';
export const dynamic='force-dynamic';
type LoginProps={searchParams:Promise<{error?:string}>};
const errors:Record<string,string>={invalid:'Usuario o contraseña incorrectos.',locked:'Demasiados intentos. Espera 15 minutos antes de intentar de nuevo.',google_config:'El acceso de Google todavía no está configurado.',google_state:'El intento de acceso venció. Vuelve a pulsar Continuar con Google.',google_cancelled:'Se canceló el acceso de Google.',google_identity:'No se pudo comprobar la cuenta de Google. Inténtalo de nuevo.',google_denied:'Esta cuenta de Google no tiene acceso autorizado.',origin:'No se pudo comprobar el origen del formulario.'};
export default async function Login({searchParams}:LoginProps){const {error}=await searchParams;return <main className="login-page"><div className="login-card">
  <div className="brand"><span className="brand-mark">O</span><span>OWEN’S<br/><b>FITNESS</b></span></div><h1>Bienvenido</h1>
  {error&&<p className="notice error" role="alert">{errors[error]||'No se pudo iniciar sesión. Inténtalo de nuevo.'}</p>}
  <h2>Equipo de Owen’s Fitness</h2><p>Administración, instructores y soporte.</p>
  {googleConfigured()?<a className="primary google-login" href={`${basePath}/api/auth/google/`}>Continuar con Google</a>:<p className="muted">Acceso con Google pendiente de configuración.</p>}
  <hr/><h2>Alumnos</h2><form action={`${basePath}/api/login/`} method="post"><label>Usuario<input name="username" autoComplete="username" required maxLength={50}/></label><label>Contraseña<input name="password" type="password" autoComplete="current-password" required maxLength={256}/></label><button type="submit" className="primary">Entrar</button></form>
  <details className="support-login"><summary>Administración y soporte · acceso local</summary><form action={`${basePath}/api/login/`} method="post"><label>Contraseña de soporte<input name="password" type="password" autoComplete="current-password" required maxLength={256}/></label><button type="submit" className="secondary">Entrar a soporte y administración</button></form></details>
</div></main>;}
