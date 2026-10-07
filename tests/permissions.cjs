const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { mkdirSync } = require('node:fs');
const { dirname } = require('node:path');
// Start with the schema/data of the currently deployed single-account app.
mkdirSync(dirname(process.env.SQLITE_PATH),{recursive:true});
const old = new DatabaseSync(process.env.SQLITE_PATH);
old.exec('CREATE TABLE records(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,kind TEXT NOT NULL,data TEXT NOT NULL,created_at INTEGER NOT NULL)');
old.prepare('INSERT INTO records VALUES(?,?,?,?,?)').run('old-athlete','admin','athlete','{"name":"Existing athlete"}',1);old.close();
const {db} = require('../lib/database');
const {identity,userById,hashPassword,verifyPassword} = require('../lib/accounts');
const {rowsFor,publicRecord,trainingOwner,validateReferences,studentProgress,cleanData}=require('../lib/record-access');
const {newSession,sessionFromToken,digest}=require('../lib/auth');
const store=db();
const user=id=>identity(userById(id));
const add=(id,owner,kind,data)=>store.prepare('INSERT INTO records VALUES(?,?,?,?,?)').run(id,owner,kind,JSON.stringify(data),Date.now());
store.prepare('INSERT INTO users(id,name,email,roles,created_at) VALUES(?,?,?,?,?)').run('other-instructor','Another coach','coach@example.test','["instructor"]',Date.now());
add('pepe-exercise','instructor-pepe','exercise',{name:'Squat'});
add('pepe-structure','instructor-pepe','structure',{name:'Leg day',moves:[{exerciseId:'pepe-exercise',reps:'10'}]});
add('pepe-session','instructor-pepe','session',{title:'Group',athleteIds:['old-athlete','other-athlete'],structureId:'pepe-structure',notes:'Private coach note'});
add('other-athlete','instructor-pepe','athlete',{name:'Different student'});
add('own-payment','instructor-pepe','payment',{athleteId:'old-athlete',amount:100,notes:'Private financial note'});
add('other-payment','instructor-pepe','payment',{athleteId:'other-athlete',amount:200});
add('pepe-product','instructor-pepe','product',{name:'Product'});
add('other-product','other-instructor','product',{name:'Other product'});
add('other-finances','other-instructor','payment',{amount:500});
add('other-orders','other-instructor','order',{total:100});
store.prepare('INSERT INTO users(id,name,username,roles,instructor_id,athlete_id,created_at) VALUES(?,?,?,?,?,?,?)').run('student-one','Student','student.one','["student"]','instructor-pepe','old-athlete',Date.now());

test('Migration preserves records and assigns them to Pepe; exact initial roles',()=>{
 assert.equal(store.prepare('SELECT owner_id FROM records WHERE id=?').get('old-athlete').owner_id,'instructor-pepe');
 assert.deepEqual(user('instructor-pepe').roles,['admin','instructor']);assert.deepEqual(user('admin-gabo').roles,['admin','support']);assert.deepEqual(user('support-marco').roles,['support']);assert.deepEqual(user('local-support').roles,['admin','support']);
 assert.equal(store.prepare('SELECT COUNT(*) AS n FROM migrations').get().n,1);
});
test('Administrator sees all instructors; instructor sees only own finance/product/order records',()=>{
 assert.equal(rowsFor(user('admin-gabo')).length,11);
 const rows=rowsFor(user('other-instructor'));assert.deepEqual(new Set(rows.map(r=>r.kind)),new Set(['product','payment','order']));assert.ok(rows.every(r=>r.owner_id==='other-instructor'));
 assert.throws(()=>rowsFor(user('other-instructor'),'instructor-pepe'));
 assert.throws(()=>trainingOwner(user('other-instructor'),'instructor-pepe'));
});
test('Support has neither record access nor training owner; references cannot cross instructors',()=>{
 assert.throws(()=>rowsFor(user('support-marco')));assert.throws(()=>trainingOwner(user('support-marco')));
 assert.throws(()=>validateReferences('structure',{moves:[{exerciseId:'pepe-exercise'}]},'other-instructor'));
 assert.throws(()=>validateReferences('payment',{athleteId:'old-athlete'},'other-instructor'));
 assert.throws(()=>validateReferences('order',{items:[{productId:'other-product'}]},'instructor-pepe'));
});
test('Student sees own athlete, assigned routine/exercises, own payments; no other athlete or instructor data',()=>{
 const student=user('student-one'), rows=rowsFor(student), ids=rows.map(r=>r.id);
 for(const id of ['old-athlete','pepe-session','pepe-structure','pepe-exercise','own-payment'])assert.ok(ids.includes(id));
 for(const id of ['other-athlete','other-payment','other-product','other-finances','pepe-product'])assert.ok(!ids.includes(id));
 const session=publicRecord(rows.find(r=>r.id==='pepe-session'),student);assert.deepEqual(session.athleteIds,['old-athlete']);assert.equal(session.notes,undefined);
 assert.equal(publicRecord(rows.find(r=>r.id==='own-payment'),student).notes,undefined);
});
test('Progress is bound to the signed-in student, not client-supplied athlete/owner; temporary password gates data',()=>{
 const student=user('student-one');const progress=studentProgress(student,{sessionId:'pepe-session',athleteId:'other-athlete',ownerId:'other-instructor',notes:'10 reps',completed:true});
 assert.equal(progress.athleteId,'old-athlete');assert.equal(progress.ownerId,undefined);assert.throws(()=>studentProgress(student,{sessionId:'other-orders',notes:''}));
 assert.throws(()=>rowsFor({...student,mustChangePassword:true}));assert.deepEqual(cleanData({id:'fake',ownerId:'other',kind:'payment',name:'Safe'}),{name:'Safe'});
});
test('Sessions expire and revoke on deactivation/reset; hashes instead of plaintext session tokens',()=>{
 const token=newSession('student-one');assert.equal(sessionFromToken(token).id,'student-one');assert.equal(sessionFromToken('bad'),null);
 assert.equal(store.prepare('SELECT token_hash FROM sessions WHERE user_id=?').get('student-one').token_hash,digest(token));
 store.prepare('UPDATE users SET active=0 WHERE id=?').run('student-one');assert.equal(sessionFromToken(token),null);store.prepare('UPDATE users SET active=1 WHERE id=?').run('student-one');
 store.prepare('DELETE FROM sessions WHERE user_id=?').run('student-one');assert.equal(sessionFromToken(token),null);
 const expired=newSession('student-one');store.prepare('UPDATE sessions SET expires_at=0 WHERE token_hash=?').run(digest(expired));assert.equal(sessionFromToken(expired),null);
});
test('Student password hashes are salted and verify; reject short passwords',async()=>{
 const a=await hashPassword('a-long-test-password'),b=await hashPassword('a-long-test-password');assert.notEqual(a,b);assert.ok(await verifyPassword('a-long-test-password',a));assert.equal(await verifyPassword('incorrect',a),false);assert.equal(await verifyPassword('anything',null),false);await assert.rejects(()=>hashPassword('short'));
});
