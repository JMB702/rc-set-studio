import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {projectStampProgress,projectSyncCounts,projectDefaultFinance,projectDefaultTracking,projectUpgradeTracking,projectAssembly,projectPartStatus,projectUpgradePlatform,projectGuideStagePercent,projectGuideStageDone,projectSetGuideStage,projectSetAssemblyCounts,projectReconcileGuideChecks,projectValidate,projectShiftCost,projectTotals,projectProgress,projectParseReceipt} from '../public/project-model.js';
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
 const d=projectDefaultTracking();assert.deepEqual(d.stages.map(s=>s.name),['Walls','Dress, prime and paint — Walls','Floor','Dress, prime and paint — Floor','Platform','Dress, prime and paint — Platform']);assert.deepEqual(projectProgress(d),{percent:0,done:0,total:26,weight:26});d.stages[0].steps[0].percent=100;d.stages[1].steps[0].percent=50;assert.deepEqual(projectProgress(d),{percent:6,done:1,total:26,weight:26});d.stages.reverse();assert.equal(projectProgress(projectValidate('tracking',d)).percent,6);d.stages[0].steps[0].percent=101;assert.throws(()=>projectValidate('tracking',d),/0–100/);
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
test('Read-only tracking diagnostics never initialize or upgrade saved progress',async()=>{
 const r=rig();
 assert.deepEqual(await (await r.call('tracking?readOnly=1')).json(),{data:null,revision:null});
 assert.equal(r.sqlite.prepare('SELECT count(*) AS n FROM project_documents').get().n,0);
 const content=JSON.stringify({stages:[{id:'walls',name:'Walls',notes:[],steps:[{id:'walls-1',name:'Legacy work',percent:37,notes:['Keep this']}]}]});
 r.sqlite.prepare('INSERT INTO project_documents (id,content,revision,updated_at) VALUES (?,?,?,?)').run('tracking',content,7,123);
 assert.deepEqual(await (await r.call('tracking?readOnly=1')).json(),{data:JSON.parse(content),revision:7});
 const saved=r.sqlite.prepare('SELECT content,revision,updated_at FROM project_documents WHERE id=?').get('tracking');
 assert.equal(saved.content,content);assert.equal(saved.revision,7);assert.equal(saved.updated_at,123);
 assert.equal((await r.call('finance?readOnly=1')).status,401);
});
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
 assert.deepEqual(updated.stages.map(s=>s.id),['platform-finishing','platform','floor-finishing','floor','walls','wall-finishing']);assert.deepEqual(finish.notes,[note]);assert.equal(finish.steps.length,5);assert.ok(finish.steps.every(t=>t.percent===40));
 assert.deepEqual(updated.stages.find(s=>s.id==='walls').steps,walls.steps.slice(0,-1));assert.equal(projectUpgradeTracking(updated),updated);assert.equal(data.stages.length,5);
});
test('Existing saved trackers upgrade once with an optimistic revision bump',async()=>{
 const r=rig(),old=projectDefaultTracking();old.stages=old.stages.filter(s=>s.id!=='wall-finishing');old.stages[0].steps.push({id:'walls-6',name:'Dress, prime and paint',percent:30,notes:[]});
 r.sqlite.prepare('INSERT INTO project_documents (id,content,revision,updated_at) VALUES (?,?,?,?)').run('tracking',JSON.stringify(old),4,Date.now());
 const result=await (await r.call('tracking')).json();assert.equal(result.revision,5);assert.equal(result.data.stages[1].name,'Dress, prime and paint — Walls');assert.ok(result.data.stages[1].steps.every(s=>s.percent===30));
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

test('Assembly counts distinguish completed panels, built jacks and attached jacks; in-progress jacks are not tracked',()=>{
 const data={...projectDefaultTracking(),assembly:{panelsCompleted:8,jacksBuilt:4,jacksAttached:2,jacksPartial:2}};
 assert.equal(projectPartStatus({kind:'panel',panel:7},data).assembled,true);
 for(let j=0;j<16;j++)assert.equal(projectPartStatus({kind:'jack',panel:Math.floor(j/2),side:j%2},data).assembled,Math.floor(j/2)===7);
 assert.equal(projectPartStatus({kind:'panel'},projectDefaultTracking()).assembled,false);
 assert.throws(()=>projectAssembly({...data.assembly,jacksAttached:5}),/cannot exceed/);
 assert.equal(projectAssembly({...data.assembly,jacksBuilt:16,jacksAttached:2}).jacksBuilt,16,'a leftover in-progress count never blocks built jacks');assert.equal('jacksPartial' in projectAssembly(data.assembly),false);
 assert.throws(()=>projectAssembly({...data.assembly,panelsCompleted:9}),/Invalid/);
 assert.deepEqual(projectValidate('tracking',data).assembly,{panelsCompleted:8,jacksBuilt:4,jacksAttached:2,ballastAttached:null,wallsJoined:null,anglesSet:null});
});
test('Platform parts require joined modules; deck, fascia and finish follow assembly dependencies',()=>{
 const data=projectDefaultTracking(),set=(id,p)=>data.stages.flatMap(s=>s.steps).find(s=>s.id===id).percent=p;
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

test('Finishing a unit\'s guide steps records at least one, keeps the checks, and never moves the count again',()=>{
 const design={height:120,floor:'charcoal',platformShape:'square'},walls1=d=>d.stages[0].steps[1].percent,panelStages=[1,2,3,4,5,6,7,8,9,10,11,12];
 let next=projectDefaultTracking();
 for(const stage of panelStages.slice(0,-1))next=projectSetGuideStage(next,stage,true,design);
 assert.equal(next.assembly?.panelsCompleted??null,null,'a partial pass never counts');
 next=projectSetGuideStage(next,12,true,design);
 assert.equal(next.assembly.panelsCompleted,1,'every step checked: at least one panel');assert.equal(walls1(next),13);
 assert.ok(panelStages.every(n=>projectGuideStageDone(next,n,design)),'checks stay checked');
 next=projectSetGuideStage(next,5,false,design);assert.equal(next.assembly.panelsCompleted,1,'an accidental uncheck keeps the count');assert.equal(projectGuideStageDone(next,5,design),false);
 next=projectSetGuideStage(next,5,true,design);assert.equal(next.assembly.panelsCompleted,1,'re-checking does not add another');
 for(const stage of panelStages)next=projectSetGuideStage(next,stage,true,design);assert.equal(next.assembly.panelsCompleted,1,'walking back through never adds');
 let counted=projectDefaultTracking();counted.assembly={panelsCompleted:3};for(const stage of panelStages)counted=projectSetGuideStage(counted,stage,true,design);
 assert.equal(counted.assembly.panelsCompleted,3,'a higher count is left alone');
 counted=projectSetGuideStage(counted,1,false,design);assert.equal(counted.assembly.panelsCompleted,3);
 let jacks=projectDefaultTracking();for(let pass=1;pass<=2;pass++)for(const stage of [13,14,15,16])jacks=projectSetGuideStage(jacks,stage,true,design);assert.equal(jacks.assembly.jacksBuilt,2,'the jack steps prove one pair, however often they are walked');
 jacks=projectSetGuideStage(jacks,17,true,design);assert.equal(jacks.assembly.jacksAttached,2);assert.equal(jacks.assembly.panelsCompleted,1,'attaching a pair needs a panel');
 for(const stage of [18,19,20])jacks=projectSetGuideStage(jacks,stage,true,design);assert.equal(jacks.assembly.ballastAttached,1);
 assert.equal(projectSetGuideStage(projectSetGuideStage(projectDefaultTracking(),1,true,design),1,false,design).assembly?.panelsCompleted??null,null,'unchecking never counts');
 projectValidate('tracking',jacks);
});
test('Loading never clears checked guide steps',()=>{
 const data=projectDefaultTracking();data.assembly={panelsCompleted:8,jacksBuilt:4,jacksAttached:2,ballastAttached:1};
 data.guideChecks=Object.fromEntries([13,14,15,16,17,18,19,20].map(n=>['jack:120:'+n,true]).concat([['panel:120:1',true],['set:28',true]]));
 assert.deepEqual(projectUpgradeTracking(data).guideChecks,data.guideChecks);
});
test('Uncounted milestones still follow guide checks, and manual edits supersede them',()=>{
 const design={height:120,floor:'charcoal',platformShape:'square'},base=projectDefaultTracking();base.stages[0].steps[0].percent=100;assert.equal(projectGuideStageDone(base,0,design),true);
 const next=projectSetGuideStage(base,0,false,design);assert.equal(next.stages[0].steps[0].percent,0);
 const edited=structuredClone(next);edited.stages[0].steps[0].percent=100;const result=projectReconcileGuideChecks(next,edited);assert.equal(projectGuideStageDone(result,0,design),true);
 const counted=projectSetAssemblyCounts(next,{panelsCompleted:4},design),moved=structuredClone(counted);assert.deepEqual(projectReconcileGuideChecks(next,moved).guideChecks,counted.guideChecks,'count changes keep walkthrough checks');
});
test('Guide completion distinguishes floor types and updates combined finishing instructions',()=>{
 const base=projectDefaultTracking(),wood={height:96,floor:'wood',platformShape:'square'},paint={...wood,floor:'charcoal'};
 const next=projectSetGuideStage(base,24,true,wood);assert.equal(next.stages.find(s=>s.id==='floor').steps.find(s=>s.id==='floor-1').percent,100);assert.equal(projectGuideStageDone(next,24,paint),false);
 const finished=projectSetGuideStage(base,37,true,paint);for(const id of ['platform-prime','platform-paint'])assert.equal(finished.stages.flatMap(s=>s.steps).find(s=>s.id===id).percent,100);
 const walls=projectSetGuideStage(base,28,true,paint);assert.ok(walls.stages.find(s=>s.id==='wall-finishing').steps.every(s=>s.percent===100));
});
test('Older open tabs cannot erase assembly counts or guide completion when saving tracker edits',async()=>{
 const r=rig(),first=await (await r.call('tracking')).json();first.data.assembly={panelsCompleted:8,jacksBuilt:4,jacksAttached:2,jacksPartial:2};first.data.guideChecks={'panel:120:0':true};first.data.stages[0].steps[0].percent=100;
 const saved=await (await r.call('tracking','PUT',first)).json();const older=structuredClone(saved);delete older.data.assembly;delete older.data.guideChecks;older.data.stages[0].name='Wall production';
 const updated=await (await r.call('tracking','PUT',older)).json();assert.deepEqual(updated.data.assembly,{panelsCompleted:8,jacksBuilt:4,jacksAttached:2,ballastAttached:null,wallsJoined:null,anglesSet:null});assert.deepEqual(updated.data.guideChecks,first.data.guideChecks);
});
test('Patched platform seams are a separate finish before full skim, primer and paint',()=>{
 const data=projectDefaultTracking(),steps=data.stages.flatMap(s=>s.steps);
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

test('Attached jacks start at the front right and continue around the perimeter',()=>{
 const data=projectDefaultTracking();data.assembly={panelsCompleted:8,jacksBuilt:16,jacksAttached:0,jacksPartial:0};
 const order=[7,6,3,2,1,0,4,5].flatMap(panel=>[{panel,side:1},{panel,side:0}]);
 for(let count=0;count<=16;count++){data.assembly.jacksAttached=count;for(const [i,part] of order.entries())assert.equal(projectPartStatus({kind:'jack',...part},data).assembled,i<count);}
});

function combinedFinishing(data=projectDefaultTracking()) {
 data=structuredClone(data);
 for(const [from,to]of [['floor-finishing','floor'],['platform-finishing','platform']]){const s=data.stages.find(s=>s.id===from);if(s){data.stages.find(s=>s.id===to).steps.push(...s.steps);data.stages=data.stages.filter(s=>s.id!==from);}}
 data.stages.find(s=>s.id==='wall-finishing').name='Dress, prime and paint';return data;
}
test('Separating finishing preserves the exact progress, step IDs, values and notes',()=>{
 for(let seed=0;seed<20;seed++){
  const old=combinedFinishing();old.stages[0].steps=old.stages[0].steps.filter(s=>s.id!=='walls-4');
  old.stages.flatMap(s=>s.steps).forEach((s,i)=>{s.percent=(i*37+seed*13)%101;s.notes=[{id:'n-'+i,text:'Retain '+s.id,at:1}];});
  if(seed===0)old.stages.flatMap(s=>s.steps).forEach((s,i)=>s.percent=i<3?100:i===3?15:0);
  old.assembly={panelsCompleted:3,jacksBuilt:2,jacksAttached:2,jacksPartial:0};old.guideChecks={'set:28':false};
  const before=structuredClone(old),synced=projectSyncCounts(old),expected=projectProgress(synced),next=projectUpgradeTracking(old);
  assert.deepEqual(projectProgress(next),expected);
  const ordered=d=>d.stages.flatMap(s=>s.steps).sort((a,b)=>a.id.localeCompare(b.id));assert.deepEqual(ordered(next),ordered(synced),'only counted milestones change, to match the counts');assert.deepEqual(old,before);
  assert.deepEqual(next.assembly,old.assembly);assert.deepEqual(next.guideChecks,old.guideChecks);assert.equal(projectUpgradeTracking(next),next);
  assert.deepEqual(next.stages.find(s=>s.id==='platform-finishing').steps.map(s=>s.id),['platform-seams','platform-skim','platform-prime','platform-paint']);
  assert.equal(next.stages.find(s=>s.id==='floor-finishing').steps[0].id,'floor-3');projectValidate('tracking',next);
 }
});
test('Server upgrades combined finishing once and rejects writes from stale tabs',async()=>{
 const r=rig(),old=combinedFinishing();old.stages[0].steps[0].percent=100;
 r.sqlite.prepare('INSERT INTO project_documents (id,content,revision,updated_at) VALUES (?,?,?,?)').run('tracking',JSON.stringify(old),7,Date.now());
 const next=await(await r.call('tracking')).json();assert.equal(next.revision,8);assert.deepEqual(projectProgress(next.data),projectProgress(old));assert.equal(next.data.stages.length,6);
 const again=await(await r.call('tracking')).json();assert.equal(again.revision,8);
 assert.equal((await r.call('tracking','PUT',{data:old,revision:7})).status,409);
});

test('Guide percentages preserve partial milestones and legacy boolean completion',()=>{
 const design={height:120,floor:'charcoal',platformShape:'square'},base=projectDefaultTracking(),floor3=d=>d.stages.flatMap(s=>s.steps).find(t=>t.id==='floor-3').percent;base.stages.flatMap(s=>s.steps).find(t=>t.id==='floor-3').percent=50;
 assert.equal(projectGuideStagePercent(base,26,design),50);
 const partial=projectSetGuideStage(base,26,20,design);assert.equal(projectGuideStagePercent(partial,26,design),20);assert.equal(projectGuideStageDone(partial,26,design),false);assert.equal(projectGuideStagePercent(partial,27,design),50);assert.equal(floor3(partial),35);
 const full=projectSetGuideStage(partial,26,true,design);assert.equal(projectGuideStagePercent(full,26,design),100);assert.equal(projectGuideStageDone(full,26,design),true);
 const lowered=projectSetGuideStage(full,26,90,design);assert.equal(projectGuideStageDone(lowered,26,design),false);assert.equal(projectGuideStagePercent(lowered,26,design),90);
 for(const value of [-1,101,1.5,'50',null])assert.throws(()=>projectSetGuideStage(base,26,value,design));
 projectValidate('tracking',lowered);
 const counted=projectSetGuideStage(base,1,true,design);assert.equal(counted.stages[0].steps[1].percent,0,'checking a panel step alone never moves panel progress');
});
test('Guide percentages round-trip through storage and update project totals',async()=>{
 const r=rig(),design={height:120,floor:'charcoal',platformShape:'square'},snapshot=await(await r.call('tracking')).json();
 snapshot.data=projectSetGuideStage(snapshot.data,0,70,design);let response=await r.call('tracking','PUT',snapshot);assert.equal(response.status,200);
 const saved=await(await r.call('tracking')).json();assert.equal(projectGuideStagePercent(saved.data,0,design),70);assert.equal(saved.data.stages[0].steps[0].percent,70);assert.equal(projectProgress(saved.data).done,0);
 saved.data=projectSetGuideStage(saved.data,0,true,design);response=await r.call('tracking','PUT',saved);assert.equal(response.status,200);const done=await response.json();assert.equal(projectGuideStagePercent(done.data,0,design),100);assert.equal(projectProgress(done.data).done,1);
});

test('Exact assembly counts update guide and tracker without inventing attached jacks',()=>{
 const original=projectDefaultTracking(),design={height:120,floor:'charcoal'};
 const data=projectSetAssemblyCounts(original,{panelsCompleted:8,jacksBuilt:4,jacksAttached:2,jacksPartial:1},design);
 assert.equal(projectGuideStagePercent(data,13,design),25);
 assert.equal(projectGuideStagePercent(data,17,design),13);
 assert.equal(projectGuideStagePercent(data,10,design),100);
 assert.equal(data.stages.flatMap(s=>s.steps).find(s=>s.id==='walls-3').percent,21,'building a pair weighs twice attaching it');
 assert.equal(original.assembly,undefined);
 const changed=projectSetGuideStage(data,17,100,design);
 assert.equal(changed.assembly.jacksAttached,2,'checking the step again never adds to an exact count');
 assert.throws(()=>projectSetAssemblyCounts(data,{panelsCompleted:1,jacksBuilt:4,jacksAttached:3},design),/Attached jacks/);
});
test('Attached jacks remain visible when only one panel has been completed',()=>{
 const data=projectDefaultTracking();data.assembly={panelsCompleted:1,jacksBuilt:2,jacksAttached:2,jacksPartial:0};
 for(const side of [0,1])assert.equal(projectPartStatus({kind:'jack',panel:0,side},data).assembled,true);
 assert.equal(projectPartStatus({kind:'jack',panel:7,side:0},data).assembled,false);
});

test('Saving a checkpoint count reconciles its percentage even when count is unchanged',()=>{
 const data=projectDefaultTracking(),design={height:120,floor:'charcoal'};
 data.assembly={panelsCompleted:8,jacksBuilt:4,jacksAttached:2,jacksPartial:2};
 const next=projectSetAssemblyCounts(data,data.assembly,design,'jacksAttached');
 assert.equal(projectGuideStagePercent(next,17,design),13);
 assert.equal(next.assembly.jacksBuilt,4);
});

test('Ballast counts require attached jack pairs and update the existing milestone',()=>{
 const data=projectDefaultTracking(),design={height:120,floor:'charcoal'};
 const counts={panelsCompleted:8,jacksBuilt:8,jacksAttached:6,jacksPartial:0,ballastAttached:3};
 const result=projectSetAssemblyCounts(data,counts,design,'ballastAttached');
 for(const stage of [18,19,20])assert.equal(projectGuideStagePercent(result,stage,design),38);
 assert.equal(projectPartStatus({kind:'bracing',panel:7},result).assembled,true);
 assert.throws(()=>projectAssembly({...counts,ballastAttached:4}),/both jacks/);
 assert.equal(projectAssembly({}).ballastAttached,null);
});
test('An older client carrying assembly fields preserves the new ballast count',async()=>{
 const r=rig(),first=await (await r.call('tracking')).json();first.data.assembly={panelsCompleted:8,jacksBuilt:4,jacksAttached:2,jacksPartial:0,ballastAttached:1};
 const saved=await (await r.call('tracking','PUT',first)).json();delete saved.data.assembly.ballastAttached;
 const updated=await (await r.call('tracking','PUT',saved)).json();assert.equal(updated.data.assembly.ballastAttached,1);
});

test('Double-layer floor migration preserves old completion and notes but starts the new layer undone',()=>{
 const old=projectDefaultTracking();delete old.floorAssemblyVersion;for(const s of old.stages)s.steps=s.steps.filter(t=>t.id!=='floor-upper');
 const lower=old.stages.flatMap(s=>s.steps).find(t=>t.id==='floor-2');lower.percent=100;lower.notes=[{id:'floor-note',text:'Existing floor work',at:1}];
 const upgraded=projectUpgradeTracking(old),upper=upgraded.stages.flatMap(s=>s.steps).find(t=>t.id==='floor-upper');
 assert.equal(upper.percent,0);assert.deepEqual(upgraded.stages.flatMap(s=>s.steps).find(t=>t.id==='floor-2'),lower);assert.equal(projectUpgradeTracking(upgraded),upgraded);
 const saved=projectSetGuideStage(upgraded,42,50,{height:120,floor:'charcoal'});assert.equal(saved.stages.flatMap(s=>s.steps).find(t=>t.id==='floor-upper').percent,50);assert.equal(projectGuideStagePercent(saved,24,{height:120,floor:'charcoal'}),100);
});

test('Finance API stores receipt line items and work stages, and an older window cannot erase them',async()=>{
 const r=rig(),setup=await r.call('access','POST',{action:'setup',pin:'2580'}),cookie=setup.headers.get('set-cookie').split(';')[0];
 const d=await (await r.call('finance','GET',null,cookie)).json();
 d.data.expenses=[{id:'expense-a',vendor:'Home Depot',date:'2026-10-09',amountCents:146200,note:'',receiptId:null,items:[{id:'line-a',materialId:'board16',description:'',quantity:null,amountCents:null,complete:true,substitute:false,note:''}]}];
 d.data.shifts=[{id:'shift-a',personId:'person-1',start:Date.now()-H,end:Date.now(),rateCents:0,note:'',taskId:'frames'}];
 const saved=await (await r.call('finance','PUT',d,cookie)).json();assert.equal(saved.data.expenses[0].items[0].materialId,'board16');assert.equal(saved.data.shifts[0].taskId,'frames');
 // A tab loaded before this release sends records without the new fields.
 const old={revision:saved.revision,data:{...saved.data,expenses:saved.data.expenses.map(({items,...e})=>({...e,note:'edited'})),shifts:saved.data.shifts.map(({taskId,...s})=>s)}};
 const after=await (await r.call('finance','PUT',old,cookie)).json();assert.equal(after.data.expenses[0].note,'edited');assert.deepEqual(after.data.expenses[0].items,saved.data.expenses[0].items);assert.equal(after.data.shifts[0].taskId,'frames');
 const bad={revision:after.revision,data:{...after.data,expenses:[{...after.data.expenses[0],items:[{id:'x',materialId:null,description:'',quantity:null,amountCents:null,complete:false,substitute:false,note:''}]}]}};
 assert.equal((await r.call('finance','PUT',bad,cookie)).status,400);
});

test('Loading syncs counted milestones to the counts once and is then stable',()=>{
 const data=projectDefaultTracking();data.assembly={panelsCompleted:8,jacksBuilt:4,jacksAttached:2,jacksPartial:2,ballastAttached:1};for(const t of data.stages[0].steps)t.percent=100;
 const next=projectUpgradeTracking(data),pct=id=>next.stages.flatMap(s=>s.steps).find(t=>t.id===id).percent;
 assert.equal(pct('walls-1'),100);assert.equal(pct('walls-2'),100);assert.equal(pct('walls-3'),21);assert.equal(pct('walls-4'),13);assert.equal(pct('walls-0'),100,'uncounted steps keep their checkbox');
 assert.equal(projectUpgradeTracking(next),next);assert.equal(projectUpgradeTracking(projectDefaultTracking()).stages[0].steps[1].percent,0,'no counts, nothing synced');
});

test('The jack step is named Build jacks; a separate attach step is folded back with its notes',()=>{
 const old=projectDefaultTracking(),walls=old.stages.find(s=>s.id==='walls'),jacks=walls.steps.find(t=>t.id==='walls-3');jacks.name='Build and attach jacks';
 walls.steps.splice(walls.steps.indexOf(jacks)+1,0,{id:'walls-attach',name:'Attach jacks to walls',percent:0,notes:[{id:'n',text:'keep',at:1}]});
 const next=projectUpgradeTracking(old),w=next.stages.find(s=>s.id==='walls');
 assert.equal(w.steps.find(t=>t.id==='walls-3').name,'Build jacks');assert.ok(!w.steps.some(t=>t.id==='walls-attach'));assert.equal(w.steps.find(t=>t.id==='walls-3').notes[0].text,'keep');
 assert.equal(projectUpgradeTracking(next),next);
});

test('Joining walls and setting angles are counted: 8 walls, 2 angles',()=>{
 const design={height:120,floor:'charcoal',platformShape:'square'},base=projectDefaultTracking(),pct=d=>d.stages.flatMap(s=>s.steps).find(t=>t.id==='walls-5').percent;
 let d=projectSetAssemblyCounts(base,{panelsCompleted:8,jacksBuilt:16,jacksAttached:16,ballastAttached:8,wallsJoined:4,anglesSet:1},design);
 assert.equal(pct(d),50);assert.equal(projectGuideStagePercent(d,21,design),50);assert.equal(projectGuideStagePercent(d,22,design),50);
 d=projectSetAssemblyCounts(d,{...d.assembly,wallsJoined:8,anglesSet:2},design);assert.equal(pct(d),100);
 assert.throws(()=>projectAssembly({panelsCompleted:3,wallsJoined:4}),/Joined walls/);assert.throws(()=>projectAssembly({anglesSet:3}),/Invalid/);
 const checked=projectSetGuideStage(projectSetGuideStage(base,21,true,design),22,true,design);assert.equal(checked.assembly?.wallsJoined??null,null,'the guide never invents join counts');
});

test('Progress going up is time-stamped; reaching 100% stamps completion once; older clients keep history',async()=>{
 const t0=Date.UTC(2026,9,9,15),prev=projectDefaultTracking(),next=structuredClone(prev);next.stages[0].steps[0].percent=100;next.stages[0].steps[1].percent=40;
 const stamped=projectStampProgress(prev,next,t0);
 assert.deepEqual(stamped.progressLog,[{at:t0,step:'walls-0',from:0,to:100},{at:t0,step:'walls-1',from:0,to:40}]);
 assert.equal(stamped.stages[0].steps[0].completedAt,t0);assert.equal(stamped.stages[0].steps[1].completedAt,null);
 const later=structuredClone(stamped);delete later.progressLog;later.stages[0].steps.forEach(t=>delete t.completedAt);later.stages[0].steps[1].percent=100;
 const again=projectStampProgress(stamped,later,t0+3600000);
 assert.equal(again.stages[0].steps[0].completedAt,t0,'an existing stamp is kept');assert.equal(again.stages[0].steps[1].completedAt,t0+3600000);assert.equal(again.progressLog.length,3);
 const back=structuredClone(again);back.stages[0].steps[0].completedAt=t0-86400000;back.progressLog[0].at=t0-86400000;
 const edited=projectStampProgress(again,back,t0+7200000);assert.equal(edited.stages[0].steps[0].completedAt,t0-86400000,'backdating is allowed');assert.equal(edited.progressLog[0].at,t0-86400000);
 const undone=structuredClone(edited);undone.stages[0].steps[0].percent=0;assert.equal(projectStampProgress(edited,undone,t0).stages[0].steps[0].completedAt,null);
 projectValidate('tracking',edited,t0+7200000);
 const r=rig(),snap=await(await r.call('tracking')).json();snap.data.stages[0].steps[0].percent=100;const saved=await(await r.call('tracking','PUT',snap)).json();
 assert.equal(saved.data.progressLog.length,1);assert.ok(saved.data.stages[0].steps[0].completedAt>0,'the server stamps saves from every screen');
});
test('The build design is saved with tracking and kept by saves that omit it',async()=>{
 const r=rig(),design={height:120,angle:45,floor:'charcoal',platformShape:'angled',platformAngle:45,platformBack:12,platformSide:12,wallColor:'#E4E1D8',platformColor:'#34383b',floorColor:'#34383b'};
 let t=await (await r.call('tracking')).json();assert.equal(t.data.design??null,null);
 t=await (await r.call('tracking','PUT',{data:{...t.data,design},revision:t.revision})).json();
 assert.deepEqual(t.data.design,{...design,seamlessCorners:false,seamlessPerimeter:false,wallColor:'#e4e1d8'});
 const {design:_,...rest}=t.data;t=await (await r.call('tracking','PUT',{data:rest,revision:t.revision})).json();
 assert.equal(t.data.design.floor,'charcoal');
 assert.equal((await r.call('tracking','PUT',{data:{...t.data,design:{...design,height:100}},revision:t.revision})).status,400);
});
test('Without a saved build design, every device reads progress through the newest approved design',async()=>{
 const r=rig();let t=await (await r.call('tracking')).json();assert.equal(t.data.design,null,'no approvals: nothing to infer');
 const design=(height,angle)=>JSON.stringify({height,angle,wallColor:'#34383b',platformShape:'square',platformAngle:90,platformBack:12,platformSide:12,platformColor:'#34383b',floor:'charcoal',floorColor:'#34383b',figures:'rap'});
 r.sqlite.prepare('INSERT INTO design_approvals (id,name,design,created_at) VALUES (?,?,?,?)').run('a1','Jeff',design(120,45),1);
 r.sqlite.prepare('INSERT INTO design_approvals (id,name,design,created_at) VALUES (?,?,?,?)').run('a2','Jeff',design(120,90),2);
 const before=r.sqlite.prepare('SELECT content,revision,updated_at FROM project_documents WHERE id=?').get('tracking');
 t=await (await r.call('tracking')).json();assert.equal(t.data.design.angle,90,'newest approval');assert.equal(t.data.design.platformShape,'square');
 assert.deepEqual(r.sqlite.prepare('SELECT content,revision,updated_at FROM project_documents WHERE id=?').get('tracking'),before,'inferring the build design does not write saved progress');
 const saved={...t.data.design,height:96};t=await (await r.call('tracking','PUT',{data:{...t.data,design:saved},revision:t.revision})).json();
 t=await (await r.call('tracking')).json();assert.equal(t.data.design.height,96,'a saved build design always wins');
});

test('Older tracker clients preserve omitted seamless settings while explicit removal remains possible',async()=>{
 const r=rig(),design={height:120,angle:45,floor:'charcoal',platformShape:'angled',platformAngle:45,platformBack:12,platformSide:12,wallColor:'#34383b',platformColor:'#34383b',floorColor:'#34383b',seamlessCorners:true,seamlessPerimeter:true};
 let snapshot=await(await r.call('tracking')).json();snapshot=await(await r.call('tracking','PUT',{data:{...snapshot.data,design},revision:snapshot.revision})).json();
 snapshot=await(await r.call('tracking')).json();
 const old=structuredClone(snapshot);delete old.data.design.seamlessCorners;delete old.data.design.seamlessPerimeter;old.data.stages[0].notes.push({id:'old-window',text:'Existing wall work recorded',at:Date.now()});
 const response=await r.call('tracking','PUT',old);assert.equal(response.status,200);snapshot=await response.json();
 assert.equal(snapshot.data.design.seamlessCorners,true);assert.equal(snapshot.data.design.seamlessPerimeter,true);assert.equal(snapshot.data.design.platformBack,12);assert.equal(snapshot.data.stages[0].notes.at(-1).text,'Existing wall work recorded');
 const remove=structuredClone(snapshot);remove.data.design.seamlessPerimeter=false;delete remove.data.design.seamlessCorners;
 const removed=await r.call('tracking','PUT',remove);assert.equal(removed.status,200);const data=(await removed.json()).data;assert.equal(data.design.seamlessCorners,true);assert.equal(data.design.seamlessPerimeter,false);
 assert.equal((await r.call('tracking','PUT',old)).status,409,'stale writers remain revision protected');
});
test('Older tracker clients also preserve seamless settings inherited from the approved design',async()=>{
 const r=rig(),design={height:120,angle:45,floor:'charcoal',platformShape:'angled',platformAngle:45,platformBack:12,platformSide:12,wallColor:'#34383b',platformColor:'#34383b',floorColor:'#34383b',seamlessCorners:true,seamlessPerimeter:true};
 r.sqlite.prepare('INSERT INTO design_approvals (id,name,design,created_at) VALUES (?,?,?,?)').run('cyc-approved','Jeff',JSON.stringify(design),1);
 const old=await(await r.call('tracking')).json();assert.equal(old.data.design.seamlessCorners,true);delete old.data.design.seamlessCorners;delete old.data.design.seamlessPerimeter;
 const response=await r.call('tracking','PUT',old);assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.data.design.seamlessCorners,true);assert.equal(saved.data.design.seamlessPerimeter,true);
});
