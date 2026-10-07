const {test,before} = require('node:test');
const assert=require('node:assert/strict');
const {writeFileSync}=require('node:fs');
const {db}=require(`${process.env.TASK_MODULES}/lib/database`);
const {newSession}=require(`${process.env.TASK_MODULES}/lib/auth`);
const {hashPassword}=require(`${process.env.TASK_MODULES}/lib/accounts`);
const store=db(),base=`${process.env.APP_ORIGIN}/OwensFitness`;
const tokens={};
const add=(id,owner,kind,data)=>store.prepare('INSERT INTO records VALUES(?,?,?,?,?)').run(id,owner,kind,JSON.stringify(data),Date.now());
before(async()=>{
 store.prepare('INSERT INTO users(id,name,email,roles,created_at) VALUES(?,?,?,?,?)').run('coach-two','Coach Two','coach2@example.test','["instructor"]',Date.now());
 for(const [id,name] of [['a-one','Student One'],['a-two','Student Two']])add(id,'instructor-pepe','athlete',{name});
 add('a-other','coach-two','athlete',{name:'Other coach student'});
 add('exercise-one','instructor-pepe','exercise',{name:'Squat'});
 add('routine-one','instructor-pepe','structure',{name:'Leg day',moves:[{exerciseId:'exercise-one',reps:'10'}]});
 add('session-one','instructor-pepe','session',{date:'2026-10-07',start:'08:00',end:'09:00',title:'Assigned training',athleteIds:['a-one','a-two'],structureId:'routine-one',notes:'Internal note'});
 add('session-private','instructor-pepe','session',{athleteIds:['a-two']});
 add('pay-one','instructor-pepe','payment',{athleteId:'a-one',amount:100,notes:'Private finance note'});
 add('pay-two','instructor-pepe','payment',{athleteId:'a-two',amount:200});
 add('product-two','coach-two','product',{name:'Other coach product',price:100});
 add('payment-two','coach-two','payment',{athleteId:'a-other',amount:300});
 add('order-two','coach-two','order',{name:'Customer',items:[{productId:'product-two',qty:1}],total:100});
 const password=await hashPassword('temporary-student-password');
 store.prepare('INSERT INTO users(id,name,username,password_hash,roles,instructor_id,athlete_id,must_change_password,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run('student-one','Student One','student.one',password,'["student"]','instructor-pepe','a-one',0,Date.now());
 for(const id of ['instructor-pepe','admin-gabo','support-marco','coach-two','student-one'])tokens[id]=newSession(id);
 if(process.env.TASK_BROWSER_FIXTURE)writeFileSync(process.env.TASK_BROWSER_FIXTURE,JSON.stringify(tokens),{mode:0o600});
});
async function call(path,user,method='GET',data,origin=process.env.APP_ORIGIN){const headers={Origin:origin};if(user)headers.Cookie=`owens_session=${tokens[user]}`;if(data!==undefined)headers['Content-Type']='application/json';const r=await fetch(`${base}${path}`,{method,headers,body:data===undefined?undefined:JSON.stringify(data),redirect:'manual'});const j=await r.json().catch(()=>null);return {r,j};}
test('Real API requires login; denies cross-origin changes; preserves native local login',async()=>{
 assert.equal((await call('/api/records/')).r.status,401);
 assert.equal((await call('/api/records/','admin-gabo','POST',{kind:'athlete',data:{name:'Blocked'}},'https://attacker.test')).r.status,403);
 const r=await fetch(`${base}/api/login/`,{method:'POST',headers:{Origin:process.env.APP_ORIGIN,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password:process.env.ADMIN_PASSWORD}),redirect:'manual'});
 assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/OwensFitness/');assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
});
test('Support can see health but is denied GET/POST/PATCH/DELETE records and account management',async()=>{
 assert.equal((await call('/api/support/','support-marco')).r.status,200);
 for(const [method,path,data] of [['GET','/api/records/',undefined],['POST','/api/records/',{kind:'product',data:{name:'No'}}],['PATCH','/api/records/',{id:'pay-one',data:{amount:1}}],['DELETE','/api/records/?id=pay-one',undefined],['GET','/api/users/',undefined],['POST','/api/users/',{name:'No'}]])assert.equal((await call(path,'support-marco',method,data)).r.status,403);
});
test('Instructor can manage own finance/products/orders, but not other instructor records or Google permissions',async()=>{
 const {r,j}=await call('/api/records/','coach-two');assert.equal(r.status,200);assert.ok(j.records.every(x=>x.ownerId==='coach-two'));for(const kind of ['payment','product','order'])assert.ok(j.records.some(x=>x.kind===kind));
 assert.equal((await call('/api/records/','coach-two','POST',{kind:'product',ownerId:'instructor-pepe',data:{name:'No'}})).r.status,403);
 assert.equal((await call('/api/records/','coach-two','PATCH',{id:'pay-one',data:{amount:0}})).r.status,404);
 assert.equal((await call('/api/records/?id=pay-one','coach-two','DELETE')).r.status,404);
 assert.equal((await call('/api/users/','coach-two','POST',{type:'google',name:'No',email:'no@example.test',roles:['admin']})).r.status,403);
 const product=await call('/api/records/','coach-two','POST',{kind:'product',data:{name:'Own product'}});assert.equal(product.r.status,201);assert.equal(product.j.record.ownerId,'coach-two');
 assert.equal((await call('/api/records/','coach-two','POST',{kind:'payment',data:{athleteId:'a-one',amount:1}})).r.status,400);
});
test('Student reads assigned routine, not other athletes/payments; spoofed progress belongs to self; business writes denied',async()=>{
 const {j}=await call('/api/records/','student-one');const ids=j.records.map(x=>x.id);for(const id of ['a-one','session-one','routine-one','exercise-one','pay-one'])assert.ok(ids.includes(id));for(const id of ['a-two','session-private','pay-two','a-other'])assert.ok(!ids.includes(id));assert.deepEqual(j.records.find(x=>x.id==='session-one').athleteIds,['a-one']);
 for(const [method,path,data] of [['POST','/api/records/',{kind:'payment',data:{amount:0}}],['PATCH','/api/records/',{id:'pay-one',data:{amount:0}}],['DELETE','/api/records/?id=pay-one',undefined]])assert.equal((await call(path,'student-one',method,data)).r.status,403);
 const progress=await call('/api/records/','student-one','POST',{kind:'progress',ownerId:'coach-two',data:{athleteId:'a-two',sessionId:'session-one',notes:'10 reps',completed:true}});assert.equal(progress.r.status,201);assert.equal(progress.j.record.athleteId,'a-one');assert.equal(progress.j.record.ownerId,'instructor-pepe');
 assert.equal((await call('/api/records/','student-one','POST',{kind:'progress',data:{sessionId:'session-private',notes:'No'}})).r.status,403);
});
test('Administration creates student accounts; first login is gated; password change and reset revoke sessions',async()=>{
 const created=await call('/api/users/','admin-gabo','POST',{name:'Student Two',athleteId:'a-two',username:'student.two',password:'first-temporary-password'});assert.equal(created.r.status,201);assert.equal(created.j.user.password_hash,undefined);
 const login=await call('/api/login/',undefined,'POST',{username:'student.two',password:'first-temporary-password'});assert.equal(login.r.status,200);tokens['student-two']=login.r.headers.get('set-cookie').match(/owens_session=([^;]+)/)[1];
 assert.equal((await call('/api/records/','student-two')).r.status,403);
 const changed=await call('/api/password/','student-two','POST',{currentPassword:'first-temporary-password',password:'new-personal-password'});assert.equal(changed.r.status,200);assert.equal((await call('/api/auth/me/','student-two')).r.status,401);tokens['student-two']=changed.r.headers.get('set-cookie').match(/owens_session=([^;]+)/)[1];assert.equal((await call('/api/records/','student-two')).r.status,200);
 assert.equal((await call('/api/users/','admin-gabo','PATCH',{id:created.j.user.id,password:'another-temporary-password'})).r.status,200);assert.equal((await call('/api/auth/me/','student-two')).r.status,401);
});
test('Google start with no configuration and invalid callback return relative login errors; deactivation revokes sessions',async()=>{
 let r=await fetch(`${base}/api/auth/google/`,{redirect:'manual'});assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/OwensFitness/login/?error=google_config');
 r=await fetch(`${base}/api/auth/google/callback/?state=fake&code=fake`,{redirect:'manual'});assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/OwensFitness/login/?error=google_state');
 assert.equal((await call('/api/users/','admin-gabo','PATCH',{id:'coach-two',active:false})).r.status,200);assert.equal((await call('/api/auth/me/','coach-two')).r.status,401);
});

test('Rendered pages expose the correct role views and preserve the login assets/base path',async()=>{
 for(const [id,expected,forbidden] of [['admin-gabo','Usuarios',null],['support-marco','Soporte técnico','>Finanzas<'],['student-one','Mi entrenamiento','>Finanzas<']]) {
  const response=await fetch(`${base}/`,{headers:{Cookie:`owens_session=${tokens[id]}`}});assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes(expected));if(forbidden)assert.ok(!html.includes(forbidden));assert.ok(html.includes('/OwensFitness/_next/'));
 }
 const response=await fetch(`${base}/login/`),html=await response.text();assert.ok(html.includes('name="username"'));assert.ok(html.includes('/OwensFitness/api/login/'));assert.ok(html.includes('acceso local'));
});
