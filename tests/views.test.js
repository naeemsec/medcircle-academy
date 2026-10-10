// These are view-rendering checks, not a substitute for real browser/mobile QA.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').split("try{const me=await api('/api/me')")[0];
const course={id:'course1',title:'Medical <sample>',description:'Course & description',category:'Anatomy',level:'Foundation',color:'blue',icon:'AN',price:250000,currency:'PKR',published:1,lectureCount:1,access:false,order:null};
const lecture={id:'lecture1',course_id:'course1',course_title:'Anatomy',title:'Session',description:'Details',starts_at:new Date(Date.now()+86400000).toISOString(),duration:60,status:'scheduled',access:false,canJoin:false,hasLink:false};
const reel={id:'reel1',title:'Academy preview',category:'Updates',caption:'Sample caption',video:'',likes:0,published:1};
const notice={id:'notice1',title:'Announcement',body:'Notice text',pinned:1,published:1,created:new Date().toISOString()};
const student={id:'student1',name:'Test Student',email:'test@example.com',role:'student',status:'active',enrollments:0};
const nodes=new Map();
const document={querySelector:s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',classList:{add(){},remove(){}},focus(){},dataset:{}});return nodes.get(s);},addEventListener(){},querySelectorAll(){return [];},hidden:false};
const context=vm.createContext({document,window:{addEventListener(){}},location:{hash:'#/'},localStorage:{getItem(){return '';},setItem(){}},sessionStorage:{setItem(){},getItem(){return null;}},setInterval(){},setTimeout(){},clearTimeout(){},console,URL,Intl,Date,fetch:async path=>{
 const routes={
  '/api/courses':[course],'/api/courses?all=1':[course],'/api/courses/course1':{...course,lectures:[lecture]},
  '/api/reels':[reel],'/api/reels?all=1':[reel],'/api/lectures':[lecture],'/api/lectures?all=1':[lecture],
  '/api/notices':[notice],'/api/notices?all=1':[notice],'/api/my-orders':[],
  '/api/payment-settings':{enabled:true,instructions:'Test payment instructions',contact:'test@example.com'},
  '/api/admin/stats':{courses:1,students:1,pending:0,approved:0,recent:[]},
  '/api/admin/orders':[], '/api/admin/users':[student]
 };
 assert.ok(path in routes,'View used unknown API: '+path);return {ok:true,json:async()=>structuredClone(routes[path])};
}});
vm.runInContext(source,context);
test('medical public and student views render without runtime reference errors',async()=>{
 vm.runInContext('user='+JSON.stringify(student),context);
 for(const expression of ['home()','catalogue()','auth("login")','auth("signup")','courseDetail("course1")','schedule()','noticePage()','learning()','checkout("course1")','reelPage()','accountForm()']){
  const html=await vm.runInContext(expression,context);assert.equal(typeof html,'string',expression);assert.ok(html.length>100,expression);assert.ok(!html.includes('Medical <sample>'),expression+' must escape course title');
 }
 const checkout=await vm.runInContext('checkout("course1")',context);assert.ok(checkout.includes('id="payment-form"'));assert.ok(checkout.includes('Submit for verification'));
});
test('all admin tabs and create/edit forms render',async()=>{
 vm.runInContext('user='+JSON.stringify({...student,role:'admin'}),context);
 for(const tab of ['overview','courses','lectures','notices','reels','payments','users','settings']){
  const html=await vm.runInContext(`adminPage('${tab}')`,context);assert.ok(html.includes('Academy workspace'),tab);
 }
 for(const [type,id] of [['course','course1'],['lecture','lecture1'],['notice','notice1'],['reel','reel1']]){
  for(const mode of ['new',id]){
   const html=await vm.runInContext(`editor('${type}','${mode}')`,context);assert.ok(html.includes('id="content-form"'),type+mode);
  }
 }
 const lectureForm=await vm.runInContext("editor('lecture','lecture1')",context);assert.ok(lectureForm.includes('Private Zoom meeting link'));
});
