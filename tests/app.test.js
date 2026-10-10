import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

const dir=mkdtempSync(path.join(os.tmpdir(),'medcircle-test-'));
let child,base,port;
async function start(){
 child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:dir,DEMO_MODE:'true',ADMIN_EMAIL:'admin@medcircle.dev',ADMIN_PASSWORD:'Admin@12345',COOKIE_SECURE:'false'},stdio:['ignore','pipe','pipe']});
 let errors='';child.stderr.on('data',chunk=>errors+=chunk);
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Server did not start: '+errors)),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('exit',code=>{clearTimeout(timer);reject(new Error('Server exited '+code+': '+errors));});});
}
async function stop(){if(!child||child.exitCode!==null)return;await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
before(async()=>{port=await new Promise(resolve=>{const socket=net.createServer();socket.listen(0,'127.0.0.1',()=>{const p=socket.address().port;socket.close(()=>resolve(p));});});base='http://127.0.0.1:'+port;await start();});
after(async()=>{await stop();rmSync(dir,{recursive:true,force:true});});
async function request(url,method='GET',body,cookie='',extra={}){
 const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers};
}
async function upload(bytes,cookie,proof=false){return fetch(base+'/api/upload'+(proof?'?kind=proof':''),{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/octet-stream'},body:bytes});}

test('Medical academy: paid course access, private Zoom links and administration',async t=>{
 let admin,student,studentId,other,course,lecture,order,proof,reel,privateNotice;
 const zoom='https://us02web.zoom.us/j/12345678901?pwd=private-demo-meeting';
 const courseBody={title:'Anatomy test course',description:'A course used by the test suite.',category:'Anatomy',level:'Foundation',color:'blue',icon:'AN',price:'2500.50',currency:'PKR',published:true};
 const lectureBody={title:'Anatomy orientation',description:'Lecture overview',speaker:'Test instructor',starts_at:new Date(Date.now()+3600000).toISOString(),duration:60,timezone:'Asia/Karachi',zoom_url:zoom,status:'scheduled'};
 await t.test('public medical catalogue and files',async()=>{
  const c=await request('/api/courses');assert.equal(c.status,200);assert.equal(c.data.length,3);assert.ok(c.data.every(x=>x.price>0));assert.equal(c.data[0].lectureCount,1);
  for(const url of ['/','/app.js','/styles.css','/favicon.svg'])assert.equal((await fetch(base+url)).status,200);
  assert.equal((await fetch(base+'/server.js')).status,404);assert.equal((await request('/api/admin/orders')).status,401);
 });
 await t.test('admin login, student sign-up and role boundaries',async()=>{
  let r=await request('/api/login','POST',{email:'admin@medcircle.dev',password:'Admin@12345'});assert.equal(r.status,200);admin=r.cookie;assert.match(r.headers.get('set-cookie'),/HttpOnly/);
  r=await request('/api/register','POST',{name:'Medical Student',email:'student@example.com',password:'Student@12345',role:'admin'});assert.equal(r.status,201);student=r.cookie;studentId=r.data.user.id;assert.equal(r.data.user.role,'student');assert.ok(!('password' in r.data.user));
  r=await request('/api/register','POST',{name:'Other Student',email:'other@example.com',password:'Other@12345'});other=r.cookie;
  assert.equal((await request('/api/admin/users','GET',undefined,student)).status,403);
  assert.equal((await request('/api/courses','POST',courseBody,student)).status,403);
 });
 await t.test('course fees validate and admin can create course and lecture',async()=>{
  assert.equal((await request('/api/courses','POST',{...courseBody,price:'-50'},admin)).status,400);
  assert.equal((await request('/api/courses','POST',{...courseBody,price:'0'},admin)).status,400);
  assert.equal((await request('/api/courses','POST',{...courseBody,price:'2.555'},admin)).status,400);
  let r=await request('/api/courses','POST',courseBody,admin);assert.equal(r.status,200);course=r.data.id;lectureBody.course_id=course;
  assert.equal((await request('/api/courses/'+course)).data.price,250050);
  assert.equal((await request('/api/lectures','POST',{...lectureBody,zoom_url:'https://zoom.us.evil.example/j/1'},admin)).status,400);
  assert.equal((await request('/api/lectures','POST',{...lectureBody,zoom_url:'javascript:alert(1)'},admin)).status,400);
  r=await request('/api/lectures','POST',lectureBody,admin);assert.equal(r.status,200);lecture=r.data.id;
 });
 await t.test('Zoom URLs remain hidden from visitors and unpaid students',async()=>{
  for(const cookie of ['',student,other]){
   for(const endpoint of ['/api/courses/'+course,'/api/lectures']){
    const r=await request(endpoint,'GET',undefined,cookie);assert.equal(r.status,200);assert.ok(!JSON.stringify(r.data).includes(zoom));assert.ok(!JSON.stringify(r.data).includes('private-demo-meeting'));
   }
  }
  assert.equal((await request('/api/lectures/'+lecture+'/join')).status,401);
  assert.equal((await request('/api/lectures/'+lecture+'/join','GET',undefined,student)).status,403);
 });
 await t.test('payment requests stay closed until configured; students cannot configure payments',async()=>{
  assert.equal((await request('/api/courses/'+course+'/request-access','POST',{reference:'ref'},student)).status,409);
  assert.equal((await request('/api/admin/payment-settings','PUT',{enabled:true,instructions:'Fake account',contact:'fake'},student)).status,403);
  assert.equal((await request('/api/admin/payment-settings','PUT',{enabled:true,instructions:''},admin)).status,400);
  assert.equal((await request('/api/admin/payment-settings','PUT',{enabled:true,instructions:'TEST ONLY: no real transfer. Admin verifies external payments.',contact:'academy@example.com'},admin)).status,200);
 });
 await t.test('payment screenshots are private and only their owner can attach them',async()=>{
  const bytes=Buffer.from('89504e470d0a1a0a00000000','hex');let r=await upload(bytes,student,true);assert.equal(r.status,201);proof=(await r.json()).url;
  assert.equal((await fetch(base+proof)).status,401);
  assert.equal((await fetch(base+proof,{headers:{Cookie:other}})).status,403);
  assert.equal((await fetch(base+proof,{headers:{Cookie:student}})).status,200);
  assert.equal((await fetch(base+proof,{headers:{Cookie:admin}})).status,200);
  assert.equal((await request('/api/courses/'+course+'/request-access','POST',{reference:'ref',proof,expectedAmount:250050,expectedCurrency:'PKR'},other)).status,400);
  assert.equal((await upload(bytes,student)).status,403);
  assert.equal((await upload(Buffer.from('<script>alert(1)</script>'),student,true)).status,400);
 });
 await t.test('payment submission uses server course fee and cannot self-approve',async()=>{
  assert.equal((await request('/api/courses/'+course+'/request-access','POST',{reference:'ref',expectedAmount:1,expectedCurrency:'PKR'},student)).status,409);
  let r=await request('/api/courses/'+course+'/request-access','POST',{reference:'DEMO-REF-100',proof,expectedAmount:250050,expectedCurrency:'PKR',status:'approved'},student);assert.equal(r.status,201);order=r.data.id;assert.equal(r.data.status,'pending');
  assert.equal((await request('/api/courses/'+course+'/request-access','POST',{reference:'again',expectedAmount:250050,expectedCurrency:'PKR'},student)).status,409);
  assert.equal((await request('/api/admin/orders/'+order,'PATCH',{status:'approved'},student)).status,403);
  assert.equal((await request('/api/lectures/'+lecture+'/join','GET',undefined,student)).status,403);
 });
 await t.test('approval unlocks only the purchased course; submitted price stays locked',async()=>{
  await request('/api/courses/'+course,'PUT',{...courseBody,price:'3000'},admin);
  const saved=(await request('/api/admin/orders','GET',undefined,admin)).data.find(x=>x.id===order);assert.equal(saved.amount,250050);
  assert.equal((await request('/api/admin/orders/'+order,'PATCH',{status:'approved',admin_note:'Test payment verified'},admin)).status,200);
  assert.equal((await request('/api/lectures/'+lecture+'/join','GET',undefined,student)).data.url,zoom);
  assert.equal((await request('/api/lectures/'+lecture+'/join','GET',undefined,other)).status,403);
  const another=(await request('/api/lectures')).data.find(l=>l.id!==lecture);assert.equal((await request('/api/lectures/'+another.id+'/join','GET',undefined,student)).status,403);
  assert.equal((await request('/api/courses/'+course,'GET',undefined,student)).data.access,true);
 });
 await t.test('course notices stay private; global notices and edits work',async()=>{
  let r=await request('/api/notices','POST',{title:'Members only',body:'Private course update',course_id:course,pinned:true,published:true},admin);assert.equal(r.status,200);privateNotice=r.data.id;
  for(const cookie of ['',other])assert.ok(!(await request('/api/notices','GET',undefined,cookie)).data.some(n=>n.id===privateNotice));
  assert.ok((await request('/api/notices','GET',undefined,student)).data.some(n=>n.id===privateNotice));
  await request('/api/notices/'+privateNotice,'PUT',{title:'Updated members notice',body:'Changed details',course_id:course,pinned:true,published:true},admin);
  assert.equal((await request('/api/notices','GET',undefined,student)).data.find(n=>n.id===privateNotice).body,'Changed details');
  await request('/api/courses/'+course,'PUT',{...courseBody,published:false},admin);
  assert.equal((await request('/api/courses/'+course,'GET',undefined,student)).status,404);
  assert.equal((await request('/api/notices','GET',undefined,student)).status,200);
  assert.ok(!(await request('/api/notices','GET',undefined,student)).data.some(n=>n.id===privateNotice));
  await request('/api/courses/'+course,'PUT',courseBody,admin);
 });
 await t.test('cancelled and completed lectures do not expose a join link',async()=>{
  await request('/api/lectures/'+lecture,'PUT',{...lectureBody,status:'cancelled'},admin);
  assert.equal((await request('/api/lectures/'+lecture+'/join','GET',undefined,student)).status,409);
  await request('/api/lectures/'+lecture,'PUT',{...lectureBody,starts_at:new Date(Date.now()-7200000).toISOString()},admin);
  assert.equal((await request('/api/lectures/'+lecture+'/join','GET',undefined,student)).status,409);
  await request('/api/lectures/'+lecture,'PUT',lectureBody,admin);
 });
 await t.test('reels upload, video ranges, edit, like and unlike',async()=>{
  const bytes=Buffer.from('000000186674797069736f6d0000020069736f6d69736f32','hex');let response=await upload(bytes,admin);assert.equal(response.status,201);const video=(await response.json()).url;
  response=await fetch(base+video,{headers:{Range:'bytes=0-7'}});assert.equal(response.status,206);assert.equal((await response.arrayBuffer()).byteLength,8);
  assert.equal((await upload(bytes,student,true)).status,400);
  let r=await request('/api/reels','POST',{title:'Medical study preview',category:'Academy',video,caption:'A short update',published:true},admin);reel=r.data.id;
  assert.equal((await request('/api/reels/'+reel,'PUT',{title:'Updated preview',category:'Academy',video,caption:'Updated',published:true},admin)).status,200);
  await request('/api/reels/'+reel+'/like','POST',{liked:true},student);
  assert.equal((await request('/api/reels','GET',undefined,student)).data.find(r=>r.id===reel).likes,1);
  await request('/api/reels/'+reel+'/like','POST',{liked:false},student);
  assert.equal((await request('/api/reels','GET',undefined,student)).data.find(r=>r.id===reel).likes,0);
 });
 await t.test('revocation removes access; rejection requires a reason; resubmission works',async()=>{
  assert.equal((await request('/api/admin/orders/'+order,'PATCH',{status:'revoked'},admin)).status,400);
  assert.equal((await request('/api/admin/orders/'+order,'PATCH',{status:'revoked',admin_note:'Test revocation'},admin)).status,200);
  assert.equal((await request('/api/lectures/'+lecture+'/join','GET',undefined,student)).status,403);
  assert.ok(!(await request('/api/notices','GET',undefined,student)).data.some(n=>n.id===privateNotice));
  let r=await request('/api/courses/'+course+'/request-access','POST',{reference:'REVISED-REF',expectedAmount:250050,expectedCurrency:'PKR'},student);assert.equal(r.status,201);assert.equal(r.data.id,order);
  assert.equal((await request('/api/admin/orders/'+order,'PATCH',{status:'rejected'},admin)).status,400);
  await request('/api/admin/orders/'+order,'PATCH',{status:'rejected',admin_note:'Please provide the correct reference'},admin);
  await request('/api/courses/'+course+'/request-access','POST',{reference:'FINAL-REF',expectedAmount:250050,expectedCurrency:'PKR'},student);
  assert.equal((await request('/api/admin/orders/'+order,'PATCH',{status:'approved'},admin)).status,200);
 });
 await t.test('sessions, course access and notice records survive a restart',async()=>{
  await stop();await start();assert.equal((await request('/api/me','GET',undefined,student)).data.user.id,studentId);
  assert.equal((await request('/api/lectures/'+lecture+'/join','GET',undefined,student)).data.url,zoom);
  assert.ok((await request('/api/notices','GET',undefined,student)).data.some(n=>n.id===privateNotice));
 });
 await t.test('suspension blocks paid access, reactivation works, passwords can change',async()=>{
  await request('/api/admin/users/'+studentId,'PATCH',{status:'suspended'},admin);
  assert.equal((await request('/api/lectures/'+lecture+'/join','GET',undefined,student)).status,401);
  assert.equal((await request('/api/login','POST',{email:'student@example.com',password:'Student@12345'})).status,401);
  await request('/api/admin/users/'+studentId,'PATCH',{status:'active'},admin);
  student=(await request('/api/login','POST',{email:'student@example.com',password:'Student@12345'})).cookie;
  const r=await request('/api/account','PATCH',{currentPassword:'Student@12345',password:'Changed@12345'},student);assert.equal(r.status,200);student=r.cookie;
  assert.equal((await request('/api/lectures/'+lecture+'/join','GET',undefined,student)).status,200);
 });
 await t.test('cross-origin protection, admin account protection and deletion',async()=>{
  assert.equal((await request('/api/reels','POST',{title:'forged'},admin,{Origin:'https://attacker.example'})).status,403);
  const owner=(await request('/api/admin/users','GET',undefined,admin)).data.find(u=>u.role==='admin');
  assert.equal((await request('/api/admin/users/'+owner.id,'DELETE',{},admin)).status,400);
  assert.equal((await request('/api/lectures/'+lecture,'DELETE',{},admin)).status,200);
  assert.equal((await request('/api/notices/'+privateNotice,'DELETE',{},admin)).status,200);
  assert.equal((await request('/api/reels/'+reel,'DELETE',{},admin)).status,200);
  assert.equal((await request('/api/courses/'+course,'DELETE',{},admin)).status,200);
  assert.ok(!(await request('/api/my-orders','GET',undefined,student)).data.some(o=>o.id===order));
  assert.equal((await request('/api/admin/users/'+studentId,'DELETE',{},admin)).status,200);
  assert.equal((await request('/api/me','GET',undefined,student)).data.user,null);
  await request('/api/logout','POST',{},admin);assert.equal((await request('/api/admin/stats','GET',undefined,admin)).status,401);
 });
});
