# Owen's Fitness

Panel privado de Agenda, Atletas, Rutinas, Finanzas, Productos y Pedidos. Next.js 16, SQLite local. No se migraron los datos de prueba de Base44 ni de Sites.

## Primera instalación en Raspberry Pi

Requiere Node 24, pnpm 11.25, runner GitHub Actions self-hosted ARM64 con usuario `sp`, nginx y systemd.

1. Crear `/home/sp/apps/OwensFitness/.env` (solo en Raspberry, permisos `0600`):

   ```env
   ADMIN_PASSWORD=una-contraseña-larga-y-única
   SESSION_SECRET=un-valor-aleatorio-de-al-menos-32-caracteres
   SQLITE_PATH=/home/sp/apps/OwensFitness/data/owens.sqlite
   ```

   Generar el secreto con `openssl rand -hex 32`. Crear `data/` con propietario `sp`.
2. Copiar `deployment/owens-fitness.service` a `/etc/systemd/system/`; comprobar la ubicación de `node` con `command -v node` y ajustar `ExecStart` si hace falta. `sudo systemctl daemon-reload && sudo systemctl enable owens-fitness`.
3. Insertar `deployment/nginx-location.conf` dentro del bloque `server` actual, `sudo nginx -t && sudo systemctl reload nginx`. Cloudflare Tunnel seguirá usando el nginx existente.
4. Autorizar al usuario del runner para `systemctl start/stop owens-fitness` mediante sudoers limitado. La primera ejecución de Actions publicará el código y arrancará el servicio.
5. Comprobar `https://solucionesprontitas.com/OwensFitness/` y registrar los nuevos datos.

El workflow se activa con cada push a `main`. La base SQLite y `.env` están fuera del checkout sincronizado y se preservan entre despliegues. Hacer respaldo de `data/` regularmente. Los pagos se registran manualmente; no se procesan tarjetas ni se cobran importes automáticamente.


## Accesos y permisos

| Cuenta | Roles iniciales | Alcance |
| --- | --- | --- |
| pepepotro21@gmail.com | Administrador + Instructor | Administración completa y entrenamiento |
| chelafin@gmail.com | Administrador + Soporte | Administración completa y diagnóstico |
| marco.torres.diaz@gmail.com | Soporte | Estado técnico; sin fichas, rutinas, finanzas, productos ni pedidos |
| Acceso local existente | Administrador + Soporte | Conserva `ADMIN_PASSWORD` como acceso de recuperación |
| Cuenta creada para un alumno | Alumno | Su ficha, sesiones asignadas, rutinas, avances y pagos |

Un instructor sin administración solo accede a sus atletas, agenda, ejercicios, estructuras, finanzas, productos y pedidos. La administración puede seleccionar un instructor o consultar todos. Para crear registros debe seleccionar un instructor. Los permisos se comprueban en el servidor para lectura, escritura y referencias entre registros, además de limitar la interfaz.

La migración SQLite es automática, transaccional y se ejecuta una sola vez. Conserva los registros existentes y cambia su propietario de `admin` a `instructor-pepe`. Crea las tres cuentas de Google autorizadas y el acceso local. Las contraseñas existentes no cambian. Las sesiones antiguas necesitan iniciar sesión nuevamente; las nuevas sesiones se guardan con un hash de token y se revocan al cerrar sesión, restablecer contraseña, cambiar permisos o desactivar la cuenta.

### Configurar Google en Raspberry

1. En Google Cloud, crear un cliente OAuth de tipo **Aplicación web** para Owen’s Fitness. Registrar exactamente esta URI autorizada (incluida la barra final):

   `https://solucionesprontitas.com/OwensFitness/api/auth/google/callback/`

2. Si la pantalla de consentimiento está en pruebas, agregar los tres correos como usuarios de prueba. La aplicación solicita únicamente `openid email profile`.
3. Después de publicar esta versión, ejecutar en la Raspberry:

   ```bash
   python3 /home/sp/apps/OwensFitness/deployment/setup-google-auth.py
   sudo systemctl restart owens-fitness
   ```

   El script pide `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` de forma local, oculta el secreto y conserva las demás variables de `.env`. No pegar secretos en GitHub o el chat. `APP_ORIGIN` se establece a `https://solucionesprontitas.com`.
4. Verificar las tres cuentas: Pepe entra al panel, Gabo al panel con Soporte y Marco únicamente al diagnóstico. Otra cuenta de Google debe mostrar «no tiene acceso autorizado».

Sin credenciales de Google, el login muestra que está pendiente de configuración y el acceso local sigue operativo. El inicio de sesión usa estado de un solo uso, PKCE, nonce y validación del ID token con la biblioteca oficial de Google. Los correos se normalizan a minúsculas; tras el primer acceso la cuenta queda vinculada al identificador de Google.

### Crear alumnos y asignar entrenamientos

1. Crear la ficha en **Atletas** dentro del instructor correspondiente.
2. En **Usuarios**, crear la cuenta usando esa ficha, un usuario único y una contraseña temporal de al menos 12 caracteres. Las contraseñas se almacenan con scrypt y sal aleatoria; no se pueden consultar después.
3. Compartir las credenciales personalmente con el alumno. Al entrar debe cambiar la contraseña temporal antes de consultar sus datos.
4. En **Agenda**, editar o crear una sesión, seleccionar los alumnos asignados y vincular una estructura. Los alumnos verán únicamente esas sesiones y sus ejercicios; no se muestran los demás alumnos de una sesión grupal.
5. Los alumnos registran sus avances desde **Mi entrenamiento**; el instructor los ve en la ficha del atleta. La sección **Usuarios** permite restablecer contraseñas y activar/desactivar cuentas; solo administración puede autorizar nuevas cuentas Google o asignar roles. Solo administración con soporte puede gestionar permisos de soporte.

## Validación

```bash
pnpm test:permissions
pnpm exec tsc --noEmit
pnpm build
pnpm test:http
```

Las pruebas usan una base temporal y verifican la migración, aislamiento entre instructores, bloqueo del soporte, acceso por alumno, referencias entre propietarios, contraseñas y revocación de sesiones. La comprobación real de Google requiere las credenciales y completar el consentimiento con cada cuenta; no se simula como un acceso de producción exitoso.
