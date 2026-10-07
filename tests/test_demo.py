import importlib.util
from datetime import date
import json
from pathlib import Path
import sqlite3
import unittest

spec = importlib.util.spec_from_file_location('seed_demo', Path(__file__).parents[1] / 'deployment' / 'seed-demo.py')
demo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(demo)

class DemoTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.executescript('''CREATE TABLE records(id TEXT PRIMARY KEY,owner_id TEXT,kind TEXT,data TEXT,created_at INTEGER);
        CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,username TEXT UNIQUE,password_hash TEXT,roles TEXT,instructor_id TEXT,athlete_id TEXT UNIQUE,must_change_password INTEGER,active INTEGER DEFAULT 1,created_at INTEGER);''')
        self.db.execute('INSERT INTO users(id,name,roles) VALUES(?,?,?)', ('instructor-pepe','Pepe','["admin","instructor"]'))
        self.db.execute('INSERT INTO users(id,name,roles) VALUES(?,?,?)', ('coach-other','Other','["instructor"]'))
        self.db.execute('INSERT INTO records VALUES(?,?,?,?,?)', ('real','instructor-pepe','athlete','{"name":"Real athlete"}',1))
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_all_sections_prefixes_links_and_accounts(self):
        created, skipped, accounts = demo.load_demo(self.db,'instructor-pepe',date(2026,10,7),'temporary-demo-password')
        self.assertEqual(created, dict(athlete=6,exercise=12,structure=4,session=9,payment=6,product=6,order=6,progress=3))
        self.assertEqual(skipped,0)
        self.assertEqual(len(accounts),6)
        rows = {r[0]: (r[1],json.loads(r[2])) for r in self.db.execute('SELECT id,kind,data FROM records WHERE id<>?',('real',))}
        for identifier,(kind,data) in rows.items():
            title=data.get('name') or data.get('title') or data.get('concept') or data.get('notes')
            self.assertTrue(title.startswith('DEMO '), identifier)
            for field,expected in [('athleteId','athlete'),('structureId','structure'),('sessionId','session')]:
                if data.get(field):self.assertEqual(rows[data[field]][0],expected)
            for athlete_id in data.get('athleteIds',[]):self.assertEqual(rows[athlete_id][0],'athlete')
            for move in data.get('moves',[]):self.assertEqual(rows[move['exerciseId']][0],'exercise')
            if kind=='progress':self.assertIn(data['athleteId'],rows[data['sessionId']][1]['athleteIds'])
            if kind=='order':
                self.assertEqual(data['total'],sum(i['qty']*i['unitPrice'] for i in data['items']))
                for item in data['items']:self.assertEqual(rows[item['productId']][0],'product')
        for row in self.db.execute('SELECT name,password_hash,roles,instructor_id,must_change_password FROM users WHERE username IS NOT NULL'):
            self.assertTrue(row[0].startswith('DEMO '));self.assertTrue(row[1].startswith('scrypt:'));self.assertNotIn('temporary-demo-password',row[1]);self.assertEqual(json.loads(row[2]),['student']);self.assertEqual(row[3],'instructor-pepe');self.assertEqual(row[4],1)
        self.assertEqual(self.db.execute('SELECT data FROM records WHERE id="real"').fetchone()[0],'{"name":"Real athlete"}')

    def test_rerun_preserves_edited_demos_and_passwords(self):
        demo.load_demo(self.db,'instructor-pepe',date(2026,10,7),'temporary-demo-password')
        identifier=self.db.execute("SELECT id FROM records WHERE kind='product' LIMIT 1").fetchone()[0]
        data=json.loads(self.db.execute('SELECT data FROM records WHERE id=?',(identifier,)).fetchone()[0]);data['price']=999
        self.db.execute('UPDATE records SET data=? WHERE id=?',(json.dumps(data),identifier));self.db.commit()
        passwords=self.db.execute('SELECT password_hash FROM users WHERE username IS NOT NULL ORDER BY id').fetchall()
        created, skipped, accounts=demo.load_demo(self.db,'instructor-pepe',date(2026,10,8),'different-demo-password')
        self.assertEqual(created,{});self.assertEqual(skipped,52);self.assertEqual(accounts,[])
        self.assertEqual(json.loads(self.db.execute('SELECT data FROM records WHERE id=?',(identifier,)).fetchone()[0])['price'],999)
        self.assertEqual(passwords,self.db.execute('SELECT password_hash FROM users WHERE username IS NOT NULL ORDER BY id').fetchall())

    def test_other_instructor_has_separate_namespace_and_invalid_owner_writes_nothing(self):
        demo.load_demo(self.db,'instructor-pepe',date(2026,10,7))
        created, skipped, accounts=demo.load_demo(self.db,'coach-other',date(2026,10,7))
        self.assertEqual(sum(created.values()),52);self.assertEqual(skipped,0)
        before=self.db.execute('SELECT COUNT(*) FROM records').fetchone()[0]
        with self.assertRaises(ValueError):demo.load_demo(self.db,'missing',date(2026,10,7))
        self.assertEqual(before,self.db.execute('SELECT COUNT(*) FROM records').fetchone()[0])

    def test_id_collision_rolls_back_whole_batch(self):
        records=demo.build_records('instructor-pepe',date(2026,10,7))
        self.db.execute('INSERT INTO records VALUES(?,?,?,?,?)',(records[-1][0],'instructor-pepe','athlete','{}',1));self.db.commit()
        before=self.db.execute('SELECT COUNT(*) FROM records').fetchone()[0]
        with self.assertRaises(ValueError):demo.load_demo(self.db,'instructor-pepe',date(2026,10,7))
        self.assertEqual(before,self.db.execute('SELECT COUNT(*) FROM records').fetchone()[0])

if __name__=='__main__':unittest.main()
