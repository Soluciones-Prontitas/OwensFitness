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

El workflow se activa con cada push a `main`. La base SQLite y `.env` están fuera del checkout sincronizado y se preservan entre despliegues. Hacer respaldo de `data/` regularmente. Solo hay una cuenta administradora; pagos reales, archivos y acceso de atletas son fases posteriores.
