#!/usr/bin/env python3
"""Configure only OAuth settings; preserve the existing password and database path."""
import getpass
import os
from pathlib import Path
import re
import tempfile

path = Path('/home/sp/apps/OwensFitness/.env')
if not path.is_file():
    raise SystemExit('No existe .env. Completa primero la instalación de Owen’s Fitness.')
client_id = input('Google OAuth Client ID (aplicación web): ').strip()
client_secret = getpass.getpass('Google OAuth Client Secret (oculto): ').strip()
if not client_id.endswith('.apps.googleusercontent.com') or not client_secret:
    raise SystemExit('Credenciales incompletas; no se modificó el archivo.')
values = {'GOOGLE_CLIENT_ID': client_id, 'GOOGLE_CLIENT_SECRET': client_secret, 'APP_ORIGIN': 'https://solucionesprontitas.com'}
for value in values.values():
    if any(c in value for c in "\r\n'\\"):
        raise SystemExit('La credencial contiene caracteres no admitidos; no se guardó.')
original = path.read_text()
lines = [line for line in original.splitlines() if not any(re.match(r'^\s*' + key + r'\s*=', line) for key in values)]
lines.extend(f"{key}='{value}'" for key, value in values.items())
fd, temporary = tempfile.mkstemp(prefix='.env-google-', dir=path.parent)
try:
    with os.fdopen(fd, 'w') as output:
        output.write('\n'.join(lines) + '\n')
        output.flush()
        os.fsync(output.fileno())
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
print('Configuración guardada. No se modificaron la contraseña local ni la ruta de datos.')
print('Registra exactamente esta URI de redirección en Google Cloud:')
print('https://solucionesprontitas.com/OwensFitness/api/auth/google/callback/')
print('Después reinicia: sudo systemctl restart owens-fitness')
