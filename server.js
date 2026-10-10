import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const UPLOADS = path.join(DATA, 'uploads');
mkdirSync(UPLOADS, { recursive: true });
const db = new DatabaseSync(path.join(DATA, 'medcircle.sqlite'));
db.exec(`
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
 password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'student',
 status TEXT NOT NULL DEFAULT 'active', created TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
 expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS courses (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
 category TEXT NOT NULL, level TEXT NOT NULL, color TEXT NOT NULL,
 icon TEXT NOT NULL, thumbnail TEXT NOT NULL DEFAULT '',
 price INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'PKR',
 published INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
 course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
 amount INTEGER NOT NULL, currency TEXT NOT NULL, reference TEXT NOT NULL,
 proof TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
 admin_note TEXT NOT NULL DEFAULT '', created TEXT NOT NULL,
 updated TEXT NOT NULL, UNIQUE(user_id,course_id)
);
CREATE TABLE IF NOT EXISTS lectures (
 id TEXT PRIMARY KEY, course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
 title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', speaker TEXT NOT NULL DEFAULT '',
 starts_at TEXT NOT NULL, duration INTEGER NOT NULL DEFAULT 60,
 timezone TEXT NOT NULL DEFAULT 'Asia/Karachi', zoom_url TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'scheduled', created TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notices (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
 course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
 pinned INTEGER NOT NULL DEFAULT 0, published INTEGER NOT NULL DEFAULT 1,
 created TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reels (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL,
 video TEXT NOT NULL DEFAULT '', caption TEXT NOT NULL DEFAULT '',
 color TEXT NOT NULL DEFAULT 'purple', published INTEGER NOT NULL DEFAULT 1, created TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS likes (
 user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
 reel_id TEXT REFERENCES reels(id) ON DELETE CASCADE, PRIMARY KEY(user_id,reel_id)
);
CREATE TABLE IF NOT EXISTS uploads (
 name TEXT PRIMARY KEY, owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, type TEXT NOT NULL, created TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
`);
const now = () => new Date().toISOString();
const hash = value => createHash('sha256').update(value).digest('hex');
const passwordHash = password => {
 const salt = randomBytes(16).toString('hex');
 return salt + ':' + scryptSync(password, salt, 64).toString('hex');
};
const passwordOK = (password, stored) => {
 const [salt, digest] = stored.split(':');
 return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(digest, 'hex'));
};
const demo = process.env.DEMO_MODE !== 'false';
if (!db.prepare("SELECT id FROM users WHERE role='admin'").get()) {
 const password = process.env.ADMIN_PASSWORD || (demo ? 'Admin@12345' : '');
 if (password.length < 10 || (!demo && password === 'Admin@12345')) {
  throw new Error('Set a unique ADMIN_PASSWORD of at least 10 characters for non-demo mode.');
 }
 db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(
  randomUUID(), 'Academy Admin', (process.env.ADMIN_EMAIL || 'admin@medcircle.dev').toLowerCase(),
  passwordHash(password), 'admin', 'active', now()
 );
}
if (demo && !db.prepare("SELECT value FROM settings WHERE key='seeded'").get()) {
 db.exec('BEGIN');
 const seedCourses = [
  ['Anatomy: a stronger foundation','A sample live course for medical students. Replace this outline with your own syllabus, instructor and session plan.','Anatomy','Foundation','blue','AN',250000],
  ['Physiology, connected','A sample course bringing core physiology topics into a structured live study plan. Edit the details before opening enrollment.','Physiology','Foundation','green','PH',300000],
  ['Your clinical exam study circle','A sample revision course for focused medical exam preparation. Set your own learning outcomes and lecture schedule.','Exam preparation','Revision','purple','EX',200000]
 ];
 seedCourses.forEach(([title,description,category,level,color,icon,price],i)=>{
  const id=randomUUID();
  db.prepare('INSERT INTO courses VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,title,description,category,level,color,icon,'',price,'PKR',1,now());
  const date=new Date();date.setUTCDate(date.getUTCDate()+7+i);date.setUTCHours(14,0,0,0);
  db.prepare('INSERT INTO lectures VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),id,['Orientation & course roadmap','Core concepts: a guided discussion','Plan your revision week'][i],'Sample schedule — the administrator will confirm the final topic, time and Zoom link.','Instructor to be announced',date.toISOString(),60,'Asia/Karachi','','scheduled',now());
 });
 db.prepare('INSERT INTO notices VALUES(?,?,?,?,?,?,?)').run(randomUUID(),'Welcome to your medical learning circle','This is a demo notice. Your instructor can publish lecture announcements, schedule changes and course updates here. Sample course fees and schedules are editable.',null,1,1,now());
 for(const [title,category,caption,color] of [
  ['Meet your next study session','Academy updates','Sample reel placeholder. Upload a short introduction to your next medical lecture.','blue'],
  ['One topic. A clearer understanding.','Study circle','Sample reel placeholder. Share a preview of the topic your class will explore together.','green'],
  ['A moment from your learning journey','Behind the scenes','Sample reel placeholder. Introduce the instructor, course or next live session.','purple']
 ]) db.prepare('INSERT INTO reels VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),title,category,'',caption,color,1,now());
 db.prepare("INSERT INTO settings VALUES('seeded','yes')").run();
 db.exec('COMMIT');
}

function fail(status,message) { const e = new Error(message); e.status=status; throw e; }
function json(res,status,data) { res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); }
async function body(req,limit=1024*1024) { const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>limit)fail(413,'File or request is too large.');chunks.push(c);}return Buffer.concat(chunks); }
async function payload(req){try{return JSON.parse((await body(req)).toString()||'{}');}catch(e){if(e.status)throw e;fail(400,'Invalid JSON.');}}
const clean = (v,max=200) => typeof v==='string'?v.trim().slice(0,max):'';
const userSafe = u => u ? {id:u.id,name:u.name,email:u.email,role:u.role,status:u.status,created:u.created} : null;
function identity(req){const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('session='))?.slice(8);if(!token)return null;return db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>? AND status=?').get(hash(token),Date.now(),'active')||null;}
function requireUser(req){const u=identity(req);if(!u)fail(401,'Please sign in to continue.');return u;}
function admin(req){const u=requireUser(req);if(u.role!=='admin')fail(403,'Administrator access required.');return u;}
function session(res,id){const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),id,Date.now()+7*86400000);res.setHeader('Set-Cookie',`session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.COOKIE_SECURE==='true'?'; Secure':''}`);}
const attempts=new Map();
function limit(req){const key=req.socket.remoteAddress;const x=attempts.get(key)||{n:0,until:Date.now()+900000};if(Date.now()>x.until){x.n=0;x.until=Date.now()+900000;}x.n++;attempts.set(key,x);if(attempts.size>10000)attempts.delete(attempts.keys().next().value);if(x.n>40)fail(429,'Too many sign-in attempts. Try again in 15 minutes.');}
const colors=['blue','purple','yellow','green','cyan','orange'];
function media(v){v=clean(v,2000);if(!v)return '';if(/^\/uploads\/[a-f0-9-]+\.(mp4|webm|png|jpg|webp)$/.test(v))return v;try{const u=new URL(v);if(u.protocol==='https:')return u.href;}catch{}fail(400,'Use an HTTPS media URL or upload a file.');}


// Prices are stored as integer minor units (e.g. PKR 2,500 = 250000).
function priceMinor(value) {
 const text=String(value);
 if(!/^\d{1,7}(\.\d{1,2})?$/.test(text)) fail(400,'Enter a valid course fee with at most two decimal places.');
 const [whole,fraction='']=text.split('.');
 const result=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(result<100 || result>100000000) fail(400,'Course fee must be between 1 and 1,000,000.');
 return result;
}
function hasAccess(user,courseId) {
 return !!user && (user.role==='admin' || !!db.prepare("SELECT 1 FROM orders WHERE user_id=? AND course_id=? AND status='approved'").get(user.id,courseId));
}
function getCourse(id,user) {
 const c=db.prepare('SELECT * FROM courses WHERE id=?').get(id);
 if(!c || (!c.published && user?.role!=='admin')) fail(404,'Course not found.');
 return c;
}
function courseView(c,user) {
 const order=user?db.prepare('SELECT id,status,amount,currency,admin_note,created FROM orders WHERE user_id=? AND course_id=?').get(user.id,c.id):null;
 return {...c,lectureCount:db.prepare('SELECT COUNT(*) n FROM lectures WHERE course_id=?').get(c.id).n,
  students:user?.role==='admin'?db.prepare("SELECT COUNT(*) n FROM orders WHERE course_id=? AND status='approved'").get(c.id).n:undefined,
  access:hasAccess(user,c.id),order:order||null};
}
function courseInput(b) {
 const title=clean(b.title),description=clean(b.description,5000);
 if(!title||!description) fail(400,'Course title and description are required.');
 const currency=clean(b.currency,3).toUpperCase();
 if(!['PKR','USD','GBP','EUR','AED','INR'].includes(currency)) fail(400,'Choose a supported currency.');
 return [title,description,clean(b.category,60)||'Medical education',
  ['Foundation','Intermediate','Revision'].includes(b.level)?b.level:'Foundation',
  colors.includes(b.color)?b.color:'blue',clean(b.icon,5)||'+',media(b.thumbnail),
  priceMinor(b.price),currency,b.published?1:0];
}
function zoomURL(value) {
 if(!value)return '';
 try {
  const u=new URL(value);
  if(u.protocol==='https:' && !u.username && !u.password && !u.port &&
   ['zoom.us','zoom.com'].some(host=>u.hostname===host||u.hostname.endsWith('.'+host))) return u.href;
 } catch {}
 fail(400,'Enter a valid HTTPS Zoom meeting link (zoom.us or zoom.com).');
}
function lectureInput(b,user) {
 getCourse(clean(b.course_id),user);
 const title=clean(b.title),date=new Date(b.starts_at),duration=Number(b.duration);
 if(!title||!Number.isFinite(date.getTime())) fail(400,'Add a lecture title and a valid start time.');
 if(!Number.isInteger(duration)||duration<5||duration>480) fail(400,'Duration must be 5–480 minutes.');
 const timezone=clean(b.timezone,80)||'Asia/Karachi';
 try { new Intl.DateTimeFormat('en',{timeZone:timezone}).format(); } catch { fail(400,'Invalid time zone.'); }
 if(!['scheduled','cancelled','completed'].includes(b.status)) fail(400,'Invalid lecture status.');
 return [clean(b.course_id),title,clean(b.description,5000),clean(b.speaker,100),date.toISOString(),duration,timezone,zoomURL(b.zoom_url),b.status];
}
function lectureView(l,user) {
 const {zoom_url,...safe}=l;
 const approved=hasAccess(user,l.course_id);
 const ended=Date.now()>new Date(l.starts_at).getTime()+l.duration*60000;
 return {...safe,status:l.status==='scheduled'&&ended?'completed':l.status,access:approved,
  hasLink:!!zoom_url,canJoin:approved&&!!zoom_url&&l.status==='scheduled'&&!ended,
  ...(user?.role==='admin'?{zoom_url}:{})};
}
function lecturesFor(user,all=false,courseId=null) {
 let sql='SELECT l.*,c.title course_title,c.published FROM lectures l JOIN courses c ON c.id=l.course_id WHERE 1=1';
 const args=[];
 if(!all)sql+=' AND c.published=1';
 if(courseId){sql+=' AND l.course_id=?';args.push(courseId);}
 return db.prepare(sql+' ORDER BY l.starts_at ASC').all(...args).map(l=>lectureView(l,user));
}
function paymentSettings(){
 const row=db.prepare("SELECT value FROM settings WHERE key='payment'").get();
 return row?JSON.parse(row.value):{enabled:false,instructions:'',contact:''};
}
function verifyProof(proof,user) {
 if(!proof)return '';
 if(!/^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(proof)) fail(400,'Upload a payment screenshot.');
 const file=db.prepare("SELECT * FROM uploads WHERE name=? AND kind='proof' AND owner_id=?").get(path.basename(proof),user.id);
 if(!file)fail(400,'Payment screenshot was not uploaded by this account.');
 return proof;
}

async function api(req,res,url){const p=url.pathname,m=req.method,u=identity(req);
 if(p==='/api/me'&&m==='GET')return json(res,200,{user:userSafe(u),demo});
 if(p==='/api/register'&&m==='POST'){limit(req);const b=await payload(req),name=clean(b.name,80),email=clean(b.email,254).toLowerCase(),password=b.password;if(!name||!/^\S+@\S+\.\S+$/.test(email)||typeof password!=='string'||password.length<10||password.length>128)fail(400,'Enter your name, a valid email, and a password of 10–128 characters.');if(db.prepare('SELECT id FROM users WHERE email=?').get(email))fail(409,'An account with this email already exists.');const id=randomUUID();db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(id,name,email,passwordHash(password),'student','active',now());session(res,id);return json(res,201,{user:userSafe(db.prepare('SELECT * FROM users WHERE id=?').get(id))});}
 if(p==='/api/login'&&m==='POST'){limit(req);const b=await payload(req),found=db.prepare('SELECT * FROM users WHERE email=?').get(clean(b.email,254).toLowerCase());const pw=typeof b.password==='string'?b.password:'';if(pw.length>128||!found||!passwordOK(pw,found.password)||found.status!=='active')fail(401,'Incorrect email or password, or account suspended.');session(res,found.id);return json(res,200,{user:userSafe(found)});}
 if(p==='/api/logout'&&m==='POST'){const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('session='))?.slice(8);if(token)db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token));res.setHeader('Set-Cookie','session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');return json(res,200,{ok:true});}
 if(p==='/api/account'&&m==='PATCH'){const user=requireUser(req),b=await payload(req);if(typeof b.currentPassword!=='string'||b.currentPassword.length>128||!passwordOK(b.currentPassword,user.password))fail(400,'Current password is incorrect.');if(typeof b.password!=='string'||b.password.length<10||b.password.length>128)fail(400,'Use a password of 10–128 characters.');db.prepare('UPDATE users SET password=? WHERE id=?').run(passwordHash(b.password),user.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);session(res,user.id);return json(res,200,{ok:true});}

 if(p==='/api/courses' && m==='GET') {
  const all=url.searchParams.has('all');if(all)admin(req);
  return json(res,200,db.prepare(`SELECT * FROM courses ${all?'':'WHERE published=1'} ORDER BY created DESC`).all().map(c=>courseView(c,u)));
 }
 const cm=p.match(/^\/api\/courses\/([^/]+)$/);
 if(cm&&m==='GET'){
  const c=getCourse(cm[1],u);
  return json(res,200,{...courseView(c,u),lectures:lecturesFor(u,u?.role==='admin',c.id)});
 }
 if((p==='/api/courses'&&m==='POST')||(cm&&m==='PUT')) {
  const owner=admin(req),fields=courseInput(await payload(req)),id=cm?cm[1]:randomUUID();
  if(cm){getCourse(id,owner);db.prepare('UPDATE courses SET title=?,description=?,category=?,level=?,color=?,icon=?,thumbnail=?,price=?,currency=?,published=? WHERE id=?').run(...fields,id);}
  else db.prepare('INSERT INTO courses VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,...fields,now());
  return json(res,200,{id});
 }
 if(cm&&m==='DELETE'){admin(req);db.prepare('DELETE FROM courses WHERE id=?').run(cm[1]);return json(res,200,{ok:true});}

 if(p==='/api/payment-settings'&&m==='GET')return json(res,200,paymentSettings());
 if(p==='/api/admin/payment-settings'&&m==='PUT'){
  admin(req);const b=await payload(req),instructions=clean(b.instructions,5000),contact=clean(b.contact,200);
  if(b.enabled&&(!instructions||!contact))fail(400,'Add payment instructions and a support contact before enabling requests.');
  const value={enabled:!!b.enabled,instructions,contact};
  db.prepare("INSERT INTO settings VALUES('payment',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(value));
  return json(res,200,value);
 }
 const purchase=p.match(/^\/api\/courses\/([^/]+)\/request-access$/);
 if(purchase&&m==='POST'){
  const student=requireUser(req);
  if(student.role==='admin')fail(400,'Administrators already have course access. Test with a student account.');
  const c=getCourse(purchase[1],student),b=await payload(req),settings=paymentSettings();
  if(!settings.enabled)fail(409,'Enrollment requests are not open yet. Check back after the administrator adds payment instructions.');
  if(b.expectedAmount!==c.price || b.expectedCurrency!==c.currency)fail(409,'The course fee changed. Refresh the page and review the current fee before submitting.');
  const reference=clean(b.reference,300),proof=verifyProof(clean(b.proof,200),student);
  if(!reference)fail(400,'Enter a payment transaction/reference number.');
  const existing=db.prepare('SELECT * FROM orders WHERE user_id=? AND course_id=?').get(student.id,c.id);
  if(existing&&['pending','approved'].includes(existing.status))fail(409,'You already have an active request or approved access for this course.');
  const id=existing?.id||randomUUID(),date=now();
  if(existing)db.prepare("UPDATE orders SET amount=?,currency=?,reference=?,proof=?,status='pending',admin_note='',created=?,updated=? WHERE id=?").run(c.price,c.currency,reference,proof,date,date,id);
  else db.prepare('INSERT INTO orders VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,student.id,c.id,c.price,c.currency,reference,proof,'pending','',date,date);
  return json(res,201,{id,status:'pending'});
 }
 if(p==='/api/my-orders'&&m==='GET'){
  const student=requireUser(req);
  return json(res,200,db.prepare('SELECT o.*,c.title course_title FROM orders o JOIN courses c ON c.id=o.course_id WHERE user_id=? ORDER BY updated DESC').all(student.id));
 }
 if(p==='/api/admin/orders'&&m==='GET'){
  admin(req);return json(res,200,db.prepare('SELECT o.*,u.name,u.email,c.title course_title FROM orders o JOIN users u ON u.id=o.user_id JOIN courses c ON c.id=o.course_id ORDER BY o.updated DESC').all());
 }
 const om=p.match(/^\/api\/admin\/orders\/([^/]+)$/);
 if(om&&m==='PATCH'){
  admin(req);const b=await payload(req),order=db.prepare('SELECT * FROM orders WHERE id=?').get(om[1]);
  if(!order)fail(404,'Payment request not found.');
  const allowed={pending:['approved','rejected'],approved:['revoked'],rejected:[],revoked:[]};
  if(!allowed[order.status]?.includes(b.status))fail(409,'This payment request changed or the action is not allowed. Refresh and try again.');
  const note=clean(b.admin_note,1000);
  if(['rejected','revoked'].includes(b.status)&&!note)fail(400,'Add a reason so the student knows what happened.');
  db.prepare('UPDATE orders SET status=?,admin_note=?,updated=? WHERE id=?').run(b.status,note,now(),order.id);
  return json(res,200,{ok:true});
 }

 if(p==='/api/lectures'&&m==='GET'){
  const all=url.searchParams.has('all');if(all)admin(req);
  return json(res,200,lecturesFor(u,all,url.searchParams.get('course')));
 }
 const lm=p.match(/^\/api\/lectures\/([^/]+)$/);
 if((p==='/api/lectures'&&m==='POST')||(lm&&m==='PUT')){
  const owner=admin(req),fields=lectureInput(await payload(req),owner),id=lm?lm[1]:randomUUID();
  if(lm){if(!db.prepare('SELECT id FROM lectures WHERE id=?').get(id))fail(404,'Lecture not found.');db.prepare('UPDATE lectures SET course_id=?,title=?,description=?,speaker=?,starts_at=?,duration=?,timezone=?,zoom_url=?,status=? WHERE id=?').run(...fields,id);}
  else db.prepare('INSERT INTO lectures VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,...fields,now());
  return json(res,200,{id});
 }
 if(lm&&m==='DELETE'){admin(req);db.prepare('DELETE FROM lectures WHERE id=?').run(lm[1]);return json(res,200,{ok:true});}
 const join=p.match(/^\/api\/lectures\/([^/]+)\/join$/);
 if(join&&m==='GET'){
  const student=requireUser(req),l=db.prepare('SELECT * FROM lectures WHERE id=?').get(join[1]);
  if(!l)fail(404,'Lecture not found.');getCourse(l.course_id,student);
  if(!hasAccess(student,l.course_id))fail(403,'Approved course access is required for the Zoom link.');
  if(!lectureView(l,student).canJoin)fail(409,'This meeting link is not available. It may be cancelled, completed or not yet added.');
  return json(res,200,{url:l.zoom_url});
 }

 if(p==='/api/notices'&&m==='GET'){
  const all=url.searchParams.has('all');if(all)admin(req);
  const rows=db.prepare('SELECT n.*,c.title course_title FROM notices n LEFT JOIN courses c ON c.id=n.course_id ORDER BY n.pinned DESC,n.created DESC').all();
  return json(res,200,all?rows:rows.filter(n=>n.published&&(!n.course_id||(hasAccess(u,n.course_id)&&db.prepare('SELECT 1 FROM courses WHERE id=? AND published=1').get(n.course_id)))));
 }
 const nm=p.match(/^\/api\/notices\/([^/]+)$/);
 if((p==='/api/notices'&&m==='POST')||(nm&&m==='PUT')){
  const owner=admin(req),b=await payload(req),title=clean(b.title),content=clean(b.body,8000),courseId=clean(b.course_id)||null;
  if(!title||!content)fail(400,'Notice title and message are required.');
  if(courseId)getCourse(courseId,owner);
  const id=nm?nm[1]:randomUUID(),fields=[title,content,courseId,b.pinned?1:0,b.published?1:0];
  if(nm){if(!db.prepare('SELECT id FROM notices WHERE id=?').get(id))fail(404,'Notice not found.');db.prepare('UPDATE notices SET title=?,body=?,course_id=?,pinned=?,published=? WHERE id=?').run(...fields,id);}
  else db.prepare('INSERT INTO notices VALUES(?,?,?,?,?,?,?)').run(id,...fields,now());
  return json(res,200,{id});
 }
 if(nm&&m==='DELETE'){admin(req);db.prepare('DELETE FROM notices WHERE id=?').run(nm[1]);return json(res,200,{ok:true});}

 if(p==='/api/reels'&&m==='GET'){const all=url.searchParams.has('all');if(all)admin(req);return json(res,200,db.prepare(`SELECT r.*,(SELECT COUNT(*) FROM likes WHERE reel_id=r.id) likes FROM reels r ${all?'':'WHERE published=1'} ORDER BY created DESC`).all().map(r=>({...r,liked:!!(u&&db.prepare('SELECT 1 FROM likes WHERE user_id=? AND reel_id=?').get(u.id,r.id))})));}
 const rm=p.match(/^\/api\/reels\/([^/]+)$/);
 if((p==='/api/reels'&&m==='POST')||(rm&&m==='PUT')){admin(req);const b=await payload(req),title=clean(b.title);if(!title)fail(400,'A title is required.');const args=[title,clean(b.category,60)||'Programming',media(b.video),clean(b.caption,4000),colors.includes(b.color)?b.color:'purple',b.published?1:0];const id=rm?rm[1]:randomUUID();if(rm)db.prepare('UPDATE reels SET title=?,category=?,video=?,caption=?,color=?,published=? WHERE id=?').run(...args,id);else db.prepare('INSERT INTO reels VALUES(?,?,?,?,?,?,?,?)').run(id,...args,now());return json(res,200,{id});}
 if(rm&&m==='DELETE'){admin(req);db.prepare('DELETE FROM reels WHERE id=?').run(rm[1]);return json(res,200,{ok:true});}
 const likeMatch=p.match(/^\/api\/reels\/([^/]+)\/like$/);if(likeMatch&&m==='POST'){const user=requireUser(req);if(!db.prepare('SELECT id FROM reels WHERE id=? AND published=1').get(likeMatch[1]))fail(404,'Reel not found.');const b=await payload(req);if(b.liked)db.prepare('INSERT OR IGNORE INTO likes VALUES(?,?)').run(user.id,likeMatch[1]);else db.prepare('DELETE FROM likes WHERE user_id=? AND reel_id=?').run(user.id,likeMatch[1]);return json(res,200,{ok:true});}
 if(p==='/api/admin/users'&&m==='GET'){admin(req);return json(res,200,db.prepare("SELECT id,name,email,role,status,created,(SELECT COUNT(*) FROM orders WHERE user_id=users.id AND status='approved') enrollments FROM users ORDER BY created DESC").all());}
 const um=p.match(/^\/api\/admin\/users\/([^/]+)$/);if(um&&(m==='PATCH'||m==='DELETE')){admin(req);const target=db.prepare('SELECT * FROM users WHERE id=?').get(um[1]);if(!target)fail(404,'User not found.');if(target.role==='admin')fail(400,'The administrator account cannot be suspended or deleted.');if(m==='DELETE')db.prepare('DELETE FROM users WHERE id=?').run(target.id);else{const b=await payload(req);if(!['active','suspended'].includes(b.status))fail(400,'Invalid status.');db.prepare('UPDATE users SET status=? WHERE id=?').run(b.status,target.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);}return json(res,200,{ok:true});}
 if(p==='/api/admin/stats'&&m==='GET'){
  admin(req);return json(res,200,{
   courses:db.prepare('SELECT COUNT(*) n FROM courses').get().n,
   students:db.prepare("SELECT COUNT(*) n FROM users WHERE role='student'").get().n,
   pending:db.prepare("SELECT COUNT(*) n FROM orders WHERE status='pending'").get().n,
   approved:db.prepare("SELECT COUNT(*) n FROM orders WHERE status='approved'").get().n,
   recent:db.prepare('SELECT o.status,o.created,u.name,c.title FROM orders o JOIN users u ON u.id=o.user_id JOIN courses c ON c.id=o.course_id ORDER BY o.updated DESC LIMIT 6').all()
  });
 }
 if(p==='/api/upload'&&m==='POST'){
  const owner=requireUser(req),kind=url.searchParams.get('kind')==='proof'?'proof':'media';
  if(kind==='media')admin(req);
  const bytes=await body(req,kind==='proof'?5*1024*1024:100*1024*1024);let ext='',type='';
  if(bytes.length>12&&bytes.toString('ascii',4,8)==='ftyp'){ext='mp4';type='video/mp4';}
  else if(bytes.subarray(0,4).toString('hex')==='1a45dfa3'){ext='webm';type='video/webm';}
  else if(bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'){ext='png';type='image/png';}
  else if(bytes.subarray(0,3).toString('hex')==='ffd8ff'){ext='jpg';type='image/jpeg';}
  else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'){ext='webp';type='image/webp';}
  else fail(400,'Upload an MP4, WebM, PNG, JPEG or WebP file.');
  if(kind==='proof'&&!type.startsWith('image/'))fail(400,'Payment proof must be a PNG, JPEG or WebP image.');
  if(kind==='proof'&&db.prepare("SELECT COUNT(*) n FROM uploads WHERE owner_id=? AND kind='proof' AND created>?").get(owner.id,new Date(Date.now()-86400000).toISOString()).n>=10)fail(429,'Maximum 10 payment screenshots per day.');
  const filename=randomUUID()+'.'+ext;
  writeFileSync(path.join(UPLOADS,filename),bytes);
  db.prepare('INSERT INTO uploads VALUES(?,?,?,?,?)').run(filename,owner.id,kind,type,now());
  return json(res,201,{url:'/uploads/'+filename,type});
 }
 fail(404,'API endpoint not found.');
}

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.mp4':'video/mp4','.webm':'video/webm','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
function serve(req,res,url){let file,privateFile=false;if(url.pathname.startsWith('/uploads/')){if(!/^\/uploads\/[a-f0-9-]+\.(mp4|webm|png|jpg|webp)$/.test(url.pathname))fail(404,'File not found.');const record=db.prepare('SELECT * FROM uploads WHERE name=?').get(path.basename(url.pathname));if(!record)fail(404,'File not found.');if(record.kind==='proof'){privateFile=true;const viewer=requireUser(req);if(viewer.id!==record.owner_id&&viewer.role!=='admin')fail(403,'This payment proof is private.');}file=path.join(UPLOADS,path.basename(url.pathname));}else{const allowed={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css','/favicon.svg':'favicon.svg'};if(!allowed[url.pathname])fail(404,'Page not found.');file=path.join(ROOT,'public',allowed[url.pathname]);}if(!existsSync(file))fail(404,'File not found.');const size=statSync(file).size,headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':privateFile?'private, no-store':'no-cache'};let start=0,end=size-1,status=200;if(req.headers.range){const match=req.headers.range.match(/^bytes=(\d+)-(\d*)$/);if(!match){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}start=Number(match[1]);end=match[2]?Number(match[2]):end;if(start>end||start>=size||end>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;}headers['Content-Length']=Math.max(0,end-start+1);res.writeHead(status,headers);if(req.method==='HEAD'||!size)return res.end();createReadStream(file,{start,end}).pipe(res);}
export const server=http.createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; media-src 'self' https:; frame-src https://www.youtube-nocookie.com; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");try{const url=new URL(req.url,'http://localhost');if(!['GET','HEAD'].includes(req.method)){const origin=req.headers.origin;const expected=process.env.APP_ORIGIN||`http://${req.headers.host}`;if(req.headers['sec-fetch-site']==='cross-site'||(origin&&origin!==expected))fail(403,'Cross-origin request blocked.');if(url.pathname!=='/api/upload'&&!(req.headers['content-type']||'').startsWith('application/json'))fail(415,'Content-Type must be application/json.');}if(url.pathname.startsWith('/api/'))await api(req,res,url);else if(['GET','HEAD'].includes(req.method))serve(req,res,url);else fail(405,'Method not allowed.');}catch(e){if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:'Something went wrong. Please try again.'});else res.end();if(!e.status)console.error(e);}});
server.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log(`MedCircle Academy running at http://${process.env.HOST||'localhost'}:${process.env.PORT||3000}`));
