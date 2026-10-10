import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {projectDefaultFinance,projectDefaultTracking,projectValidate,projectShiftCost,projectTotals,projectProgress,projectParseReceipt} from '../public/project-model.js';
const H=3600000,now=Date.now(),shift={id:'shift',personId:'person-1',start:now-1.5*H,end:null,rateCents:2500,note:''};
test('Live cost changes only at complete hourly boundaries; clock-out includes the exact partial hour',()=>{
 assert.deepEqual(projectShiftCost(shift,now-0.6*H),{hours:0,cents:0});assert.deepEqual(projectShiftCost(shift,now),{hours:1,cents:2500});assert.deepEqual(projectShiftCost(shift,now+0.5*H),{hours:2,cents:5000});assert.deepEqual(projectShiftCost({...shift,end:now},now),{hours:1.5,cents:3750});
 const data=projectDefaultFinance();data.shifts=[{...shift,end:now}];data.expenses=[{amountCents:10000},{amountCents:-500}];data.budgetCents=20000;data.crew[0].rateCents=9999;assert.deepEqual(projectTotals(data,now),{materials:9500,labor:3750,total:13250,remaining:6750});
});
test('Reject overlapping shifts, future times, duplicate records and removal of an active worker',()=>{
 const d=projectDefaultFinance();assert.equal(d.crew.length,2);assert.ok(d.crew.every(c=>c.rateCents===0));d.shifts=[shift];projectValidate('finance',d,now);
 assert.throws(()=>projectValidate('finance',{...d,shifts:[shift,{...shift,id:'other',start:now-H}]},now),/overlapping/);
 assert.throws(()=>projectValidate('finance',{...d,shifts:[{...shift,start:now+H}]},now),/times/);
 assert.throws(()=>projectValidate('finance',{...d,crew:d.crew.map(c=>({...c,archived:true}))},now),/Clock out/);
 assert.throws(()=>projectValidate('finance',{...d,shifts:[{...shift,end:shift.start-1}]},now),/times/);
 assert.throws(()=>projectValidate('finance',{...d,shifts:[shift,shift]},now),/Duplicate/);
 const e={id:'a',vendor:'Lumber',amountCents:3200,date:'2026-10-09',note:'',receiptId:'receipt'};assert.throws(()=>projectValidate('finance',{...d,expenses:[e,{...e,id:'b'}]},now),/already recorded/);
});
test('Production starts walls, floor, platform; progress includes partial steps and survives reorder',()=>{
 const d=projectDefaultTracking();assert.deepEqual(d.stages.map(s=>s.name),['Walls','Floor','Platform']);assert.deepEqual(projectProgress(d),{percent:0,done:0,total:15});d.stages[0].steps[0].percent=100;d.stages[1].steps[0].percent=50;assert.deepEqual(projectProgress(d),{percent:10,done:1,total:15});d.stages.reverse();assert.equal(projectProgress(projectValidate('tracking',d)).percent,10);d.stages[0].steps[0].percent=101;assert.throws(()=>projectValidate('tracking',d),/0–100/);
});
test('Receipt extraction distinguishes total from subtotal, savings, tender and card numbers',()=>{
 const r=projectParseReceipt('LOCAL HARDWARE\n10/09/2026\nSUBTOTAL 100.00\nTAX 7.00\nTOTAL $107.00\nCASH 120.00\nCHANGE 13.00\nTOTAL SAVINGS 10.00');assert.equal(r.amountCents,10700);assert.equal(r.date,'2026-10-09');assert.equal(r.taxCents,700);assert.equal(r.warning,'');
 assert.equal(projectParseReceipt('STORE\nVISA ****1234\nSUBTOTAL 99.00').amountCents,null);
 assert.equal(projectParseReceipt('STORE\nTOTAL 107.00\nTOTAL 108.00').amountCents,null);
 assert.match(projectParseReceipt('STORE\nSUBTOTAL 100.00\nTAX 8.00\nTOTAL 107.00').warning,/do not match/);
 assert.equal(projectParseReceipt('STORE\nTOTAL\n$1,234.56').amountCents,123456);
});
const model=fs.readFileSync(new URL('../public/project-model.js',import.meta.url),'utf8').replaceAll('export function ','function '),routes=fs.readFileSync(new URL('../worker/project.js',import.meta.url),'utf8');
const api=(await import('data:text/javascript;base64,'+Buffer.from('const json=(data,status=200,headers={})=>Response.json(data,{status,headers});\n'+model+'\n'+routes+'\nexport {projectAPI,projectPinHash};').toString('base64')));
function rig(){const sqlite=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));const env={DB:{prepare(sql){const stmt=sqlite.prepare(sql);let args=[];return {bind(...values){args=values;return this;},async first(){return stmt.get(...args)||null;},async run(){return {meta:stmt.run(...args)};}};}}};return {sqlite,call:(path,method='GET',body,cookie,origin)=>api.projectAPI(new Request('http://localhost/api/project/'+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})},body:body?JSON.stringify(body):undefined}),env)};}
test('PIN setup, shared sessions, finance/receipt API enforcement, lockout, and logout',async()=>{
 const r=rig();assert.equal((await r.call('finance')).status,401);assert.equal((await r.call('receipts/id')).status,401);
 assert.deepEqual(await (await r.call('access')).json(),{configured:false,unlocked:false});
 const setup=await r.call('access','POST',{action:'setup',pin:'2580'});assert.equal(setup.status,200);const cookie=setup.headers.get('set-cookie').split(';')[0];assert.match(setup.headers.get('set-cookie'),/HttpOnly/);assert.match(setup.headers.get('set-cookie'),/SameSite=Strict/);
 assert.equal((await r.call('access','POST',{action:'setup',pin:'0000'})).status,409);
 assert.equal((await r.call('finance','GET',null,cookie)).status,200);assert.equal((await r.call('tracking')).status,200);
 for(let i=0;i<5;i++)assert.equal((await r.call('access','POST',{action:'unlock',pin:'9999'})).status,401);
 assert.equal((await r.call('access','POST',{action:'unlock',pin:'2580'})).status,429);
 assert.notEqual(r.sqlite.prepare('SELECT hash FROM project_access').get().hash,'2580');
 await r.call('access','POST',{action:'lock'},cookie);assert.equal((await r.call('finance','GET',null,cookie)).status,401);
 r.sqlite.prepare('UPDATE project_access SET locked_until=?').run(Date.now()-1);assert.equal((await r.call('access','POST',{action:'unlock',pin:'2580'})).status,200);
});
test('Updates survive reload, reject stale changes, safely retry identical writes, and enforce same-origin',async()=>{
 const r=rig(),snapshot=await (await r.call('tracking')).json();snapshot.data.stages[0].steps[0].percent=55;
 const saved=await r.call('tracking','PUT',snapshot);assert.equal(saved.status,200);assert.equal((await r.call('tracking','PUT',snapshot)).status,200);
 const loaded=await (await r.call('tracking')).json();assert.equal(loaded.data.stages[0].steps[0].percent,55);assert.equal(loaded.revision,1);
 snapshot.data.stages[0].steps[0].percent=20;assert.equal((await r.call('tracking','PUT',snapshot)).status,409);assert.equal((await r.call('tracking','PUT',loaded,null,'https://elsewhere.test')).status,403);
});
test('Receipt data is private, deduplicated and restricted to validated image payloads',async()=>{
 const r=rig(),setup=await r.call('access','POST',{action:'setup',pin:'2580'}),cookie=setup.headers.get('set-cookie').split(';')[0];
 const receipt={id:'receipt-a',fingerprint:'a'.repeat(64),filename:'sample.jpg',pages:['data:image/jpeg;base64,/9j/']};
 assert.equal((await r.call('receipts','POST',receipt)).status,401);assert.equal((await r.call('receipts','POST',receipt,cookie)).status,201);
 assert.deepEqual(await (await r.call('receipts','POST',{...receipt,id:'receipt-b'},cookie)).json(),{id:'receipt-a',duplicate:true});
 assert.equal((await r.call('receipts/receipt-a','GET',null,cookie)).status,200);assert.equal((await r.call('receipts','POST',{...receipt,pages:['data:text/html;base64,evil']},cookie)).status,400);
 const d=await (await r.call('finance','GET',null,cookie)).json();d.data.expenses=[{id:'expense-a',vendor:'Shop',date:'2026-10-09',amountCents:100,note:'note',receiptId:'missing'}];assert.equal((await r.call('finance','PUT',d,cookie)).status,400);
});
