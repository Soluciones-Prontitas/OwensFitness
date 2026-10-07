#!/usr/bin/env python3
"""Load connected, fictional DEMO records without replacing existing data."""
import argparse
from datetime import datetime, timedelta
import getpass
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import secrets
import sqlite3
import time
from urllib.parse import quote
from zoneinfo import ZoneInfo

MARKER = 'owens-demo-v1'


def build_records(owner, today):
    namespace = hashlib.sha256(owner.encode()).hexdigest()[:12]
    def rid(kind, number):
        return f'DEMO-{namespace}-{kind}-{number:02d}'
    records = []
    def add(kind, number, **data):
        records.append((rid(kind, number), kind, dict(data, demoSeed=MARKER)))
    def date(offset):
        return (today + timedelta(days=offset)).isoformat()

    names = ['Ana Fuerza', 'Bruno Movilidad', 'Carla Rendimiento', 'Diego Inicio', 'Elena Resistencia', 'Fabian En Línea']
    goals = ['Fuerza', 'Movilidad', 'Rendimiento', 'Reacondicionamiento', 'Pérdida de grasa', 'Fuerza']
    for i, name in enumerate(names, 1):
        add('athlete', i, name=f'DEMO {name}', email=f'demo.atleta{i}@example.com', phone='', goals=[goals[i-1]],
            medical='DEMO Ficha ficticia para pruebas.', injuries='DEMO Sin lesiones registradas.', mobility='DEMO Evaluación pendiente.',
            package='DEMO Plan mensual', credits=4 if i % 2 else 0, expires=date(30))

    exercises = [
        ('Press de pecho', 'Empuje', 'Mancuernas'), ('Flexiones', 'Empuje', 'Peso corporal'),
        ('Remo', 'Tracción', 'Mancuernas'), ('Jalón al pecho', 'Tracción', 'Polea'),
        ('Peso muerto rumano', 'Dominante de cadera', 'Mancuernas'), ('Puente de glúteos', 'Dominante de cadera', 'Peso corporal'),
        ('Sentadilla', 'Dominante de rodilla', 'Barra'), ('Desplante', 'Dominante de rodilla', 'Mancuernas'),
        ('Plancha', 'Core', 'Colchoneta'), ('Dead bug', 'Core', 'Colchoneta'),
        ('Bicicleta', 'Metabólico', 'Bicicleta fija'), ('Cuerda', 'Metabólico', 'Cuerda'),
    ]
    for i, (name, category, equipment) in enumerate(exercises, 1):
        add('exercise', i, name=f'DEMO {name}', category=category, equipment=equipment, level='Principiante' if i % 2 else 'Intermedio',
            notes='DEMO Contenido ficticio para probar formularios y programación; no constituye una prescripción de ejercicio.')
    for i, (name, format_, exercise_numbers) in enumerate([
        ('Fuerza de cuerpo completo', 'Fuerza RPE', [1, 3, 7]),
        ('Circuito funcional', 'AMRAP', [2, 6, 9]),
        ('Acondicionamiento', 'EMOM', [8, 11, 12]),
        ('Core y movilidad', 'Tabata', [9, 10, 6]),
    ], 1):
        add('structure', i, name=f'DEMO {name}', format=format_, minutes=20, level='Intermedio',
            description='DEMO Estructura de prueba para vincular con sesiones.',
            moves=[dict(exerciseId=rid('exercise', n), reps='10' if n != 9 else '30 s', load='DEMO Ajustable', rpe='6') for n in exercise_numbers])

    modalities = ['1 a 1', 'Grupal', 'Evaluación física', 'En línea']
    for i, offset in enumerate([-2, -1, 0, 0, 1, 2, 3, 5], 1):
        modality = modalities[(i-1) % 4]
        athlete_numbers = [1, 2, 3] if modality == 'Grupal' else [(i-1) % 6 + 1]
        hour = 8 if i != 4 else 17
        add('session', i, title=f'DEMO Sesión {i:02d} · {modality}', date=date(offset), type='Sesión', modality=modality,
            start=f'{hour:02d}:00', end=f'{hour+1:02d}:00', capacity=6 if modality == 'Grupal' else 1,
            cancelHours=4, place='DEMO Estudio' if modality != 'En línea' else 'DEMO Videollamada',
            structureId=rid('structure', (i-1) % 4 + 1), athleteIds=[rid('athlete', n) for n in athlete_numbers])
    add('session', 9, title='DEMO Bloqueo de mantenimiento', date=date(1), type='Bloqueo de tiempo', start='13:00', end='14:00', athleteIds=[])

    for i in range(1, 7):
        add('payment', i, athleteId=rid('athlete', i), concept=f'DEMO Mensualidad atleta {i:02d}', amount=800 + i*100,
            creditAmount=8, method=['Efectivo', 'Transferencia', 'Tarjeta'][(i-1) % 3],
            status='Pagado' if i % 2 else 'Pendiente', date=date(-i if i % 2 else 0), due=date(-1 if i == 2 else 7),
            recurrence='Mensual' if i <= 4 else 'Ninguna')

    products = [
        ('Proteína de prueba', 'Suplementación', 650, [('Chocolate', 8), ('Vainilla', 2)], False),
        ('Bebida de prueba', 'Suplementación', 90, [('Único', 1)], False),
        ('Playera Owen', 'Ropa y Accesorios', 350, [('M', 5), ('L', 4)], False),
        ('Toalla Owen', 'Ropa y Accesorios', 180, [('Negra', 6)], False),
        ('Programa de fuerza', 'Programas Digitales', 490, [('Digital', 0)], True),
        ('Programa de movilidad', 'Programas Digitales', 290, [('Digital', 0)], True),
    ]
    for i, (name, category, price, variants, digital) in enumerate(products, 1):
        add('product', i, name=f'DEMO {name}', category=category, price=price, digital=digital, minStock=3,
            description='DEMO Producto ficticio; no está a la venta.', specifications='DEMO Solo para pruebas.',
            variants=[dict(name=name, stock=stock, priceDelta=0) for name, stock in variants], imageUrl='', fileUrl='')
    for i, status in enumerate(['Pendiente', 'Pagado', 'Preparando', 'Listo', 'Entregado', 'Cancelado'], 1):
        product = products[i-1]
        add('order', i, name=f'DEMO Pedido {i:02d} · {names[i-1]}', athleteId=rid('athlete', i),
            fulfillment='Digital' if product[4] else 'Recoger en estudio', method='Transferencia', status=status, date=date(-1 if i > 1 else 0),
            items=[dict(productId=rid('product', i), name=f'DEMO {product[0]}', qty=1, unitPrice=product[2])], total=product[2])
    for i in range(1, 4):
        add('progress', i, athleteId=rid('athlete', 1 if i == 2 else i), sessionId=rid('session', i),
            notes=f'DEMO Avance de entrenamiento {i:02d}: registro ficticio de repeticiones y sensaciones.', completed=True, date=date(-1))
    return records


def password_hash(password):
    if not 12 <= len(password) <= 256:
        raise ValueError('La contraseña temporal debe tener entre 12 y 256 caracteres.')
    salt = secrets.token_hex(16)
    key = hashlib.scrypt(password.encode(), salt=salt.encode(), n=32768, r=8, p=1, dklen=64, maxmem=64*1024*1024)
    return f'scrypt:{salt}:{key.hex()}'


def load_demo(connection, owner, today, password=None):
    records = build_records(owner, today)
    account_hashes = [password_hash(password) for _ in range(6)] if password is not None else []
    accounts = []
    connection.execute('BEGIN IMMEDIATE')
    try:
        row = connection.execute('SELECT active,roles FROM users WHERE id=?', (owner,)).fetchone()
        if not row or not row[0] or 'instructor' not in json.loads(row[1]):
            raise ValueError('El propietario debe ser un instructor activo.')
        created, skipped = {}, 0
        now = int(time.time()*1000)
        for identifier, kind, data in records:
            existing = connection.execute('SELECT owner_id,kind,data FROM records WHERE id=?', (identifier,)).fetchone()
            if existing:
                if existing[0] != owner or existing[1] != kind or json.loads(existing[2]).get('demoSeed') != MARKER:
                    raise ValueError('Hay un ID ocupado por un registro ajeno a esta demostración; no se modificó nada.')
                skipped += 1
                continue
            connection.execute('INSERT INTO records(id,owner_id,kind,data,created_at) VALUES(?,?,?,?,?)',
                               (identifier, owner, kind, json.dumps(data, ensure_ascii=False), now))
            created[kind] = created.get(kind, 0) + 1
        if account_hashes:
            namespace = hashlib.sha256(owner.encode()).hexdigest()[:12]
            for i, hashed in enumerate(account_hashes, 1):
                identifier = f'DEMO-{namespace}-user-{i:02d}'
                username = f'demo.{namespace}.{i:02d}'
                athlete_id = f'DEMO-{namespace}-athlete-{i:02d}'
                existing = connection.execute('SELECT roles,instructor_id,athlete_id,username FROM users WHERE id=?', (identifier,)).fetchone()
                if existing:
                    if json.loads(existing[0]) != ['student'] or existing[1:] != (owner, athlete_id, username):
                        raise ValueError('Hay una cuenta ajena ocupando un ID DEMO; no se modificó nada.')
                    continue
                name = records[i-1][2]['name']
                connection.execute('INSERT INTO users(id,name,username,password_hash,roles,instructor_id,athlete_id,must_change_password,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
                                   (identifier, name, username, hashed, '["student"]', owner, athlete_id, 1, now))
                accounts.append(username)
        connection.commit()
        return created, skipped, accounts
    except Exception:
        connection.rollback()
        raise


def database_path(env_file):
    if os.environ.get('SQLITE_PATH'):
        return Path(os.environ['SQLITE_PATH'])
    for line in Path(env_file).read_text().splitlines():
        match = re.match(r'^\s*(?:export\s+)?SQLITE_PATH\s*=\s*(.*)$', line)
        if match:
            values = shlex.split(match.group(1), comments=True)
            if len(values) != 1:
                raise ValueError('SQLITE_PATH no contiene una ruta válida.')
            return Path(values[0])
    return Path('/var/lib/owens-fitness/owens.sqlite')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', type=Path, help='Base SQLite existente; opcional si SQLITE_PATH está en .env.')
    parser.add_argument('--env-file', default='/home/sp/apps/OwensFitness/.env')
    parser.add_argument('--owner', default='instructor-pepe', help='ID del instructor propietario. Por defecto, Pepe.')
    parser.add_argument('--with-users', action='store_true', help='Crear además seis cuentas de alumnos DEMO; pide una contraseña temporal localmente.')
    args = parser.parse_args()
    path = (args.database or database_path(args.env_file)).resolve()
    if not path.is_file():
        raise SystemExit('No se encontró la base existente. No se creó ninguna base nueva.')
    connection = sqlite3.connect(f'file:{quote(str(path))}?mode=rw', uri=True, timeout=30)
    try:
        today = datetime.now(ZoneInfo('America/Mexico_City')).date()
        password = getpass.getpass('Contraseña temporal para los alumnos DEMO (mínimo 12 caracteres; oculta): ') if args.with_users else None
        created, skipped, accounts = load_demo(connection, args.owner, today, password)
        labels = dict(athlete='Atletas', exercise='Ejercicios', structure='Estructuras', session='Agenda', payment='Finanzas', product='Productos', order='Pedidos', progress='Avances')
        print('Datos DEMO cargados; los registros existentes se conservaron.')
        for kind, count in created.items():
            print(f'{labels[kind]}: {count} nuevos')
        print(f'Total: {sum(created.values())} nuevos; {skipped} DEMO ya existentes, sin cambios.')
        if accounts:
            print('Usuarios DEMO creados (usa la contraseña temporal indicada; cambiarla al primer acceso):')
            for username in accounts:
                print(username)
        print('Recarga Owen’s Fitness y selecciona al instructor correspondiente.')
    finally:
        connection.close()


if __name__ == '__main__':
    main()
