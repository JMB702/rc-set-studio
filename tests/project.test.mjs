import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {projectDefaultFinance,projectDefaultTracking,projectUpgradeTracking,projectAssembly,projectPartStatus,projectUpgradePlatform,projectGuideStageDone,projectSetGuideStage,projectReconcileGuideChecks,projectValidate,projectShiftCost,projectTotals,projectProgress,projectParseReceipt} from '../public/project-model.js';
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
test('Production starts walls, finishing, floor, platform; progress includes partial steps and survives reorder',()=>{
 const d=projectDefaultTracking();assert.deepEqual(d.stages.map(s=>s.name),['Walls','Dress, prime and paint','Floor','Platform']);assert.deepEqual(projectProgress(d),{percent:0,done:0,total:25});d.stages[0].steps[0].percent=100;d.stages[1].steps[0].percent=50;assert.deepEqual(projectProgress(d),{percent:6,done:1,total:25});d.stages.reverse();assert.equal(projectProgress(projectValidate('tracking',d)).percent,6);d.stages[0].steps[0].percent=101;assert.throws(()=>projectValidate('tracking',d),/0–100/);
});
test('Receipt extraction distinguishes total from subtotal, savings, tender and card numbers',()=>{
 const r=projectParseReceipt('LOCAL HARDWARE\n10/09/2026\nSUBTOTAL 100.00\nTAX 7.00\nTOTAL $107.00\nCASH 120.00\nCHANGE 13.00\nTOTAL SAVINGS 10.00');assert.equal(r.amountCents,10700);assert.equal(r.date,'2026-10-09');assert.equal(r.taxCents,700);assert.equal(r.warning,'');
 assert.equal(projectParseReceipt('STORE\nVISA ****1234\nSUBTOTAL 99.00').amountCents,null);
 assert.equal(projectParseReceipt('STORE\nTOTAL 107.00\nTOTAL 108.00').amountCents,null);
 assert.match(projectParseReceipt('STORE\nSUBTOTAL 100.00\nTAX 8.00\nTOTAL 107.00').warning,/do not match/);
 assert.equal(projectParseReceipt('STORE\nTOTAL\n$1,234.56').amountCents,123456);
});
const model=fs.readFileSync(new URL('../public/project-model.js',import.meta.url),'utf8').replaceAll('export function ','function '),routes=fs.readFileSync(new URL('../worker/project.js',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../worker/project-transfer.js',import.meta.url),'utf8');
const api=(await import('data:text/javascript;base64,'+Buffer.from('const json=(data,status=200,headers={})=>Response.json(data,{status,headers});\n'+model+'\n'+routes+'\nexport {projectAPI,projectPinHash,projectTransfer};').toString('base64')));
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

test('Promoting wall finishing preserves custom order, progress and notes and is idempotent',()=>{
 const data=projectDefaultTracking();data.stages=data.stages.filter(s=>s.id!=='wall-finishing');
 const walls=data.stages.find(s=>s.id==='walls');walls.steps=walls.steps.filter(t=>t.id!=='walls-4');walls.steps[0].percent=100;
 const note={id:'note',text:'Use the approved color.',at:Date.now()};walls.steps.push({id:'walls-6',name:'Dress, prime and paint',percent:40,notes:[note]});
 data.stages.reverse();const updated=projectUpgradeTracking(data),finish=updated.stages.find(s=>s.id==='wall-finishing');
 assert.deepEqual(updated.stages.map(s=>s.id),['platform','floor','walls','wall-finishing']);assert.deepEqual(finish.notes,[note]);assert.equal(finish.steps.length,5);assert.ok(finish.steps.every(t=>t.percent===40));
 assert.deepEqual(updated.stages.find(s=>s.id==='walls').steps,walls.steps.slice(0,-1));assert.equal(projectUpgradeTracking(updated),updated);assert.equal(data.stages.length,3);
});
test('Existing saved trackers upgrade once with an optimistic revision bump',async()=>{
 const r=rig(),old=projectDefaultTracking();old.stages=old.stages.filter(s=>s.id!=='wall-finishing');old.stages[0].steps.push({id:'walls-6',name:'Dress, prime and paint',percent:30,notes:[]});
 r.sqlite.prepare('INSERT INTO project_documents (id,content,revision,updated_at) VALUES (?,?,?,?)').run('tracking',JSON.stringify(old),4,Date.now());
 const result=await (await r.call('tracking')).json();assert.equal(result.revision,5);assert.equal(result.data.stages[1].name,'Dress, prime and paint');assert.ok(result.data.stages[1].steps.every(s=>s.percent===30));
 assert.equal((await (await r.call('tracking')).json()).revision,5);
});

test('Production transfer is disabled by default and atomically imports records and the existing PIN',async()=>{
 const sqlite=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 const DB={prepare(sql){let args=[];return {bind(...v){args=v;return this;},async first(){return sqlite.prepare(sql).get(...args)||null;},exec(){return sqlite.prepare(sql).run(...args);}};},async batch(statements){sqlite.exec('BEGIN');try{statements.forEach(s=>s.exec());sqlite.exec('COMMIT');}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 const token='a'.repeat(64),env={DB,PROJECT_TRANSFER_SECRET:JSON.stringify({token,expiresAt:Date.now()+60000})},access={id:'main',salt:crypto.randomUUID(),hash:await api.projectPinHash('1234','salt')},payload={version:1,access,receipts:[],documents:[{id:'finance',content:JSON.stringify(projectDefaultFinance()),revision:6,updated_at:Date.now()},{id:'tracking',content:JSON.stringify(projectDefaultTracking()),revision:11,updated_at:Date.now()}]};
 const req=(data=payload,bearer=token)=>new Request('https://site.test/api/project/transfer',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+bearer},body:JSON.stringify(data)});
 assert.equal((await api.projectTransfer(req(),{DB})).status,404);assert.equal((await api.projectTransfer(req(payload,'wrong'),env)).status,404);
 assert.equal((await api.projectAPI(new Request('https://site.test/api/project/tracking'),env)).status,503);
 assert.equal((await api.projectTransfer(req(),env)).status,200);assert.equal(sqlite.prepare('SELECT hash FROM project_access').get().hash,access.hash);assert.equal(sqlite.prepare("SELECT revision FROM project_documents WHERE id='finance'").get().revision,6);
 assert.equal((await api.projectTransfer(req(),env)).status,200);
 const changed=structuredClone(payload);changed.documents[0].revision=7;assert.equal((await api.projectTransfer(req(changed),env)).status,409);
 assert.equal((await api.projectTransfer(req(),{DB})).status,404);
 sqlite.prepare("DELETE FROM project_documents WHERE id='transfer-receipt'").run();assert.equal((await api.projectTransfer(req(),env)).status,409);
});

test('Assembly counts distinguish completed panels, built jacks, attached jacks and partial jacks',()=>{
 const data={...projectDefaultTracking(),assembly:{panelsCompleted:8,jacksBuilt:4,jacksAttached:2,jacksPartial:2}};
 assert.equal(projectPartStatus({kind:'panel',panel:7},data).assembled,true);
 for(let j=0;j<16;j++)assert.equal(projectPartStatus({kind:'jack',panel:Math.floor(j/2),side:j%2},data).assembled,j<2);
 assert.equal(projectPartStatus({kind:'panel'},projectDefaultTracking()).assembled,false);
 assert.throws(()=>projectAssembly({...data.assembly,jacksAttached:5}),/cannot exceed/);
 assert.throws(()=>projectAssembly({...data.assembly,jacksPartial:13}),/cannot exceed/);
 assert.throws(()=>projectAssembly({...data.assembly,panelsCompleted:9}),/Invalid/);
 assert.deepEqual(projectValidate('tracking',data).assembly,data.assembly);
});
test('Platform parts require joined modules; deck, fascia and finish follow assembly dependencies',()=>{
 const data=projectDefaultTracking(),set=(id,p)=>data.stages.find(s=>s.id==='platform').steps.find(s=>s.id===id).percent=p;
 set('platform-frame',100);set('platform-legs',100);
 const frame={kind:'platform',stage:31,total:8,module:0};assert.equal(projectPartStatus(frame,data).assembled,false);
 set('platform-join',25);assert.equal(projectPartStatus(frame,data).assembled,true);assert.equal(projectPartStatus({...frame,module:2},data).assembled,false);
 assert.equal(projectPartStatus({...frame,stage:34},data).assembled,false);set('platform-deck',100);assert.equal(projectPartStatus({...frame,stage:34},data).assembled,true);
 set('platform-paint',100);assert.equal(projectPartStatus({...frame,stage:34},data).finish,'raw');set('platform-fascia',100);set('platform-seams',100);set('platform-skim',100);set('platform-prime',100);assert.equal(projectPartStatus({...frame,stage:35},data).finish,'paint');
});
test('Platform stage upgrade keeps all notes and respects custom order and removed steps',()=>{
 const data={stages:[{id:'platform',name:'Platform',notes:[],steps:[3,1,0,2].map(i=>({id:'platform-'+i,name:'Legacy '+i,percent:i*20,notes:[{id:'note-'+i,text:'keep',at:1}]}))}]};
 const next=projectUpgradePlatform(data);assert.equal(next.stages[0].steps.length,10);assert.equal(next.stages[0].steps[0].id,'platform-seams');assert.equal(next.stages[0].steps[0].percent,60);assert.equal(next.stages[0].steps.flatMap(s=>s.notes).length,4);assert.equal(projectUpgradePlatform(next),next);
 data.stages[0].steps.pop();assert.equal(projectUpgradePlatform(data),data);
});

test('Guide checkboxes update grouped tracking percentages and preserve counts and notes',()=>{
 const design={height:120,floor:'charcoal',platformShape:'square'},base=projectDefaultTracking();base.assembly={panelsCompleted:8,jacksBuilt:4,jacksAttached:2,jacksPartial:2};base.stages[0].steps[1].notes=[{id:'n',text:'Keep this note',at:1}];
 let next=projectSetGuideStage(base,1,true,design);assert.equal(next.stages[0].steps[1].percent,11);assert.equal(projectGuideStageDone(next,1,design),true);assert.equal(projectGuideStageDone(next,2,design),false);
 for(const stage of [2,3,4,5,6,7,8,9])next=projectSetGuideStage(next,stage,true,design);assert.equal(next.stages[0].steps[1].percent,100);next=projectSetGuideStage(next,4,false,design);assert.equal(next.stages[0].steps[1].percent,89);assert.deepEqual(next.assembly,base.assembly);assert.deepEqual(next.stages[0].steps[1].notes,base.stages[0].steps[1].notes);
 const saved=projectValidate('tracking',next);assert.equal(projectGuideStageDone(saved,4,design),false);
});
test('Existing completed milestones seed checked guide steps; manual edits supersede checkbox detail',()=>{
 const design={height:120,floor:'charcoal',platformShape:'square'},base=projectDefaultTracking();base.stages[0].steps[1].percent=100;assert.equal(projectGuideStageDone(base,8,design),true);
 const next=projectSetGuideStage(base,8,false,design);assert.equal(next.stages[0].steps[1].percent,89);
 const edited=structuredClone(next);edited.stages[0].steps[1].percent=100;const result=projectReconcileGuideChecks(next,edited);assert.equal(projectGuideStageDone(result,8,design),true);
});
test('Guide completion distinguishes floor types and updates combined finishing instructions',()=>{
 const base=projectDefaultTracking(),wood={height:96,floor:'wood',platformShape:'square'},paint={...wood,floor:'charcoal'};
 const next=projectSetGuideStage(base,24,true,wood);assert.equal(next.stages.find(s=>s.id==='floor').steps.find(s=>s.id==='floor-1').percent,100);assert.equal(projectGuideStageDone(next,24,paint),false);
 const finished=projectSetGuideStage(base,37,true,paint);for(const id of ['platform-prime','platform-paint'])assert.equal(finished.stages.find(s=>s.id==='platform').steps.find(s=>s.id===id).percent,100);
 const walls=projectSetGuideStage(base,28,true,paint);assert.ok(walls.stages.find(s=>s.id==='wall-finishing').steps.every(s=>s.percent===100));
});
test('Older open tabs cannot erase assembly counts or guide completion when saving tracker edits',async()=>{
 const r=rig(),first=await (await r.call('tracking')).json();first.data.assembly={panelsCompleted:8,jacksBuilt:4,jacksAttached:2,jacksPartial:2};first.data.guideChecks={'panel:120:0':true};first.data.stages[0].steps[0].percent=100;
 const saved=await (await r.call('tracking','PUT',first)).json();const older=structuredClone(saved);delete older.data.assembly;delete older.data.guideChecks;older.data.stages[0].name='Wall production';
 const updated=await (await r.call('tracking','PUT',older)).json();assert.deepEqual(updated.data.assembly,first.data.assembly);assert.deepEqual(updated.data.guideChecks,first.data.guideChecks);
});
test('Patched platform seams are a separate finish before full skim, primer and paint',()=>{
 const data=projectDefaultTracking(),steps=data.stages.find(s=>s.id==='platform').steps;
 for(const t of steps)t.percent=['platform-skim','platform-prime','platform-paint'].includes(t.id)?0:100;
 const part={kind:'platform',stage:34,module:0,total:8};assert.equal(projectPartStatus(part,data).finish,'seams');
 steps.find(t=>t.id==='platform-seams').percent=0;assert.equal(projectPartStatus(part,data).finish,'raw');
 steps.find(t=>t.id==='platform-seams').percent=100;steps.find(t=>t.id==='platform-skim').percent=100;assert.equal(projectPartStatus(part,data).finish,'skim');
 steps.find(t=>t.id==='platform-prime').percent=100;assert.equal(projectPartStatus(part,data).finish,'primer');
 steps.find(t=>t.id==='platform-paint').percent=100;assert.equal(projectPartStatus(part,data).finish,'paint');
});

test('Legacy completed frame and skin steps color panels without inventing attached jacks',()=>{
 const data=projectDefaultTracking();delete data.assembly;
 const set=(id,n)=>data.stages.find(s=>s.id==='walls').steps.find(t=>t.id===id).percent=n;
 set('walls-1',100);set('walls-2',100);set('walls-3',15);
 assert.equal(projectPartStatus({kind:'panel',panel:7},data).assembled,true);
 assert.equal(projectPartStatus({kind:'wallSkin',panel:7},data).finish,'raw');
 assert.equal(projectPartStatus({kind:'jack',panel:0,side:0},data).assembled,false);
 data.assembly={panelsCompleted:0};assert.equal(projectPartStatus({kind:'panel'},data).assembled,false);
 delete data.assembly;set('walls-2',99);assert.equal(projectPartStatus({kind:'panel'},data).assembled,false);
});
