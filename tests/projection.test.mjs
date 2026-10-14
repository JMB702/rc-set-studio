import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {priceRows} from '../public/pricing-calc.js';
import {laborEstimate,laborCost} from '../public/labor.js';
import {customizeRows} from '../public/pricing-config.js';
import {projectProgress,projectStagePercent,projectDefaultTracking,projectValidate,projectPreserveFinance,projectSetGuideStage,projectSetAssemblyCounts} from '../public/project-model.js';
import {shiftStages,projectMaterials,projectLabor,projectCost,laborStageNumbers,laborTaskProgress,supplyProgress,progressWeights,WALL_GROUPS} from '../public/projection.js';

const data=JSON.parse(fs.readFileSync(new URL('../public/data/flat-shopping-list.json',import.meta.url),'utf8'));
const design={height:120,angle:90,floor:'charcoal',platformShape:'square',platformBack:12,platformSide:12,platformAngle:90};
const rows=priceRows(data,{scope:'set',...design});
const H=3600000,now=Date.UTC(2026,9,10,18);
// What laborFor() returns, without the browser's saved settings.
function labor(d=design,{rates=[5000,null],crew=2,hours=null}={}){const est=laborEstimate(d,crew),used=hours??est.hours,base=laborCost(used,rates),shoppingRateCents=rates[0],shoppingCents=shoppingRateCents==null?null:Math.round(est.shoppingHours*shoppingRateCents);return {...est,defaultHours:est.hours,hours:used,adjusted:hours!=null,rates,...base,shoppingRateCents,shoppingCents,costCents:base.costCents===null&&shoppingCents===null?null:(base.costCents??0)+(shoppingCents??0)};}
const item=(materialId,extra={})=>({id:'i-'+materialId+(extra.id||''),materialId,description:'',quantity:null,amountCents:null,complete:materialId!==null,substitute:false,note:'',...extra});
const expense=(items,amountCents=10000,id='e1')=>({id,vendor:'Home Depot',date:'2026-10-09',amountCents,note:'',receiptId:null,items});

test('An unlogged completed shopping trip is excluded from projection, across designs and crew rates',()=>{
 for(const d of [design,{...design,height:96,platformShape:'none',floor:'wood',angle:45},{...design,platformShape:'angled',platformAngle:60,angle:45,floor:'none'}])
  for(const options of [{},{rates:[5000,3000]},{rates:[null,null]},{rates:[2500,null,1000],crew:3},{hours:71.5}]){
   const l=labor(d,options),r=priceRows(data,{scope:'set',...d}),p=projectCost({rows:r,finance:{expenses:[],shifts:[]},tracking:projectDefaultTracking(),design:d,labor:l,now});
   const unloggedShopping=Math.round(3.5*(l.shoppingRateCents??0));assert.equal(p.projectedCents,p.estimateCents-unloggedShopping,JSON.stringify({d,options}));assert.equal(p.varianceCents,0-unloggedShopping);
   assert.ok(Math.abs(p.labor.projectedHours-((l.personHours-l.shoppingHours)*l.hours/l.defaultHours+l.shoppingHours-3.5))<.01);
  }
});

test('Linked purchases replace the estimate: spent counts in full, bought rows leave the to-buy total',()=>{
 const wall=rows.filter(r=>WALL_GROUPS.includes(r.group)),est=wall.reduce((n,r)=>n+r.subtotalCents,0);
 const p=projectMaterials(rows,[expense(wall.map(r=>item(r.id)),146200)]);
 assert.equal(p.counts.bought,wall.length);assert.equal(p.spentCents,146200);
 assert.equal(p.remainingCents,rows.filter(r=>!WALL_GROUPS.includes(r.group)).reduce((n,r)=>n+(r.subtotalCents??0),0));
 assert.equal(p.coveredEstimateCents,est+Math.round(est*.07));
 assert.equal(p.projectedCents,146200+p.remainingCents+p.remainingTaxCents);
 assert.deepEqual(p.unlinked,[]);
 // Not itemized: no per-row actual is invented from the receipt total.
 assert.ok(p.plan.filter(x=>x.status==='bought').every(x=>x.actualCents===null&&!x.itemized));
});

test('Unlinked purchases are flagged; partial quantities leave the rest to buy; extras and retired rows still count as spent',()=>{
 const board=rows.find(r=>r.id==='board14');
 const p=projectMaterials(rows,[expense([],5000,'plain'),expense([item('board14',{quantity:10,amountCents:15320,complete:false}),item(null,{description:'Drill bits',amountCents:899}),item('laminate',{amountCents:2399})],18618,'mixed')]);
 assert.deepEqual(p.unlinked.map(e=>e.id),['plain']);assert.equal(p.spentCents,23618);
 const b=p.plan.find(x=>x.row.id==='board14');assert.equal(b.status,'partial');assert.equal(b.remainingQuantity,board.purchaseQuantity-10);assert.equal(b.remainingCents,(board.purchaseQuantity-10)*board.unitPriceCents);assert.equal(b.actualCents,15320);assert.ok(b.itemized);
 assert.deepEqual(p.extras.map(i=>i.description),['Drill bits']);assert.deepEqual(p.outsidePlan.map(i=>i.materialId),['laminate']);
 // Buying the planned quantity completes a row even without the checkbox.
 assert.equal(projectMaterials(rows,[expense([item('board14',{quantity:board.purchaseQuantity,complete:false})])]).plan.find(x=>x.row.id==='board14').status,'bought');
 // A partial purchase of a row with no price leaves its remainder unpriced rather than zero.
 const pendingRow={id:'pendingRow',name:'Unpriced',group:'floor',purchaseQuantity:null,unitPriceCents:null,subtotalCents:null,packSize:1};const ply=projectMaterials([...rows,pendingRow],[expense([item('pendingRow',{quantity:4,complete:false})])]).plan.find(x=>x.row.id==='pendingRow');assert.equal(ply.status,'partial');assert.equal(ply.remainingCents,null);
});

test('Estimated tax applies to catalog rows still to buy, never to added costs',()=>{
 const custom=customizeRows(rows,{excluded:[],customItems:[{id:'custom-00000000-0000-4000-8000-000000000000',title:'Delivery',description:'',link:'',quantity:1,unitPriceCents:10000}]});
 const a=projectMaterials(custom,[]),b=projectMaterials(rows,[]);assert.equal(a.remainingCents-b.remainingCents,10000);assert.equal(a.remainingTaxCents,b.remainingTaxCents);
});

test('Labor stages parse Build guide ranges, and task progress follows the tracker',()=>{
 assert.deepEqual(laborStageNumbers('1–9'),[1,2,3,4,5,6,7,8,9]);assert.deepEqual(laborStageNumbers('23–27, 42'),[23,24,25,26,27,42]);assert.deepEqual(laborStageNumbers('All'),[]);assert.deepEqual(laborStageNumbers('17'),[17]);
 let t=projectDefaultTracking();for(const stage of [13,14])t=projectSetGuideStage(t,stage,100,design);
 const jacks=labor().tasks.find(x=>x.id==='jacks');assert.equal(laborTaskProgress(jacks,{design,tracking:t}),0,'steps alone are not jacks');
 t=projectSetAssemblyCounts(t,{panelsCompleted:8,jacksBuilt:8},design);assert.equal(laborTaskProgress(jacks,{design,tracking:t}),50,'8 of 16 built');
 assert.equal(laborTaskProgress(labor().tasks.find(x=>x.id==='shoppingDone'),{design,tracking:null}),100);
 assert.equal(laborTaskProgress(jacks,{design,tracking:null}),0);
});

test('Hours: logged time is actual, the tracker sets what is left, unassigned time still counts',()=>{
 let t=projectSetAssemblyCounts(projectDefaultTracking(),{panelsCompleted:8,jacksBuilt:8},design);
 const l=labor(),shifts=[{id:'a',personId:'person-1',start:now-6*H,end:now,rateCents:5000,note:'',taskId:'jacks'},{id:'b',personId:'person-2',start:now-2*H,end:now,rateCents:0,note:'',taskId:null}];
 const p=projectLabor(l,{design,tracking:t,shifts,now}),jacks=p.tasks.find(x=>x.id==='jacks'),estimate=l.tasks.find(x=>x.id==='jacks').personHours;
 assert.equal(jacks.actual,6);assert.equal(jacks.progress,50);assert.equal(jacks.remaining,estimate/2);assert.equal(jacks.projected,6+estimate/2);assert.equal(jacks.actualCents,30000);
 assert.equal(p.unassignedHours,2);assert.equal(p.unassignedCount,1);assert.equal(p.actualCents,30000);
 // Shopping is never added on top of logged time; explicit shopping entries count once.
 assert.equal(p.tasks.find(x=>x.id==='shoppingDone').actual,0);
 const logged=projectLabor(l,{design,tracking:t,shifts:[{...shifts[0],taskId:'shoppingDone',start:now-2*H}],now}).tasks.find(x=>x.id==='shoppingDone');assert.equal(logged.actual,2);assert.equal(logged.reported,false);
 // A finished stage has nothing left, however long it took.
 let done=projectSetAssemblyCounts(projectDefaultTracking(),{panelsCompleted:8,jacksBuilt:16,jacksAttached:0,jacksPartial:0},design);assert.equal(projectLabor(l,{design,tracking:done,shifts,now}).tasks.find(x=>x.id==='jacks').projected,6);
});

test('Remaining-supplies shopping progresses as non-wall rows are bought',()=>{
 assert.equal(supplyProgress(projectMaterials(rows,[])),0);
 const others=rows.filter(r=>!WALL_GROUPS.includes(r.group));
 assert.equal(supplyProgress(projectMaterials(rows,[expense(others.map(r=>item(r.id)))])),100);
 assert.equal(supplyProgress(projectMaterials(rows,[expense(rows.filter(r=>WALL_GROUPS.includes(r.group)).map(r=>item(r.id)))])),0);
});

test('Finance validation accepts line items and work stages, and rejects malformed ones',()=>{
 const base={budgetCents:null,crew:[{id:'person-1',name:'Jeff',rateCents:5000,archived:false}],shifts:[{id:'s',personId:'person-1',start:now-H,end:now,rateCents:5000,note:'',taskId:'frames'}],expenses:[expense([item('board14',{quantity:2.5,amountCents:3064,substitute:true,note:' select pine '}),item(null,{description:' Bits ',complete:true,substitute:true})])]};
 const out=projectValidate('finance',base,now);
 assert.deepEqual(out.expenses[0].items[1],{id:'i-null',materialId:null,description:'Bits',quantity:null,amountCents:null,complete:false,substitute:false,note:''});
 assert.equal(out.expenses[0].items[0].note,'select pine');assert.equal(out.shifts[0].taskId,'frames');
 const legacy=projectValidate('finance',{...base,expenses:[{...base.expenses[0],items:undefined}],shifts:[{...base.shifts[0],taskId:undefined}]},now);assert.deepEqual(legacy.expenses[0].items,[]);assert.equal(legacy.shifts[0].taskId,null);
 for(const bad of [item(null),item('board14',{quantity:0}),item('board14',{amountCents:1.5}),item('bad id'),{...item('board14'),complete:'yes'}])assert.throws(()=>projectValidate('finance',{...base,expenses:[expense([bad])]},now),/line items/);
 assert.throws(()=>projectValidate('finance',{...base,expenses:[expense([item('a'),item('a')])]},now),/line items/);
 assert.throws(()=>projectValidate('finance',{...base,shifts:[{...base.shifts[0],taskId:'not valid!'}]},now),/shift/);
});

test('A window from before line items cannot erase them or work stages',()=>{
 const previous={expenses:[expense([item('skin')])],shifts:[{id:'s',taskId:'skins'}]};
 const next=projectPreserveFinance(previous,{expenses:[{id:'e1',vendor:'Home Depot',amountCents:1},{id:'new',vendor:'Shop'}],shifts:[{id:'s'},{id:'t'}]});
 assert.deepEqual(next.expenses[0].items,previous.expenses[0].items);assert.deepEqual(next.expenses[1].items,[]);assert.equal(next.shifts[0].taskId,'skins');assert.equal(next.shifts[1].taskId,null);
 // Explicit edits win, including removing every line.
 assert.deepEqual(projectPreserveFinance(previous,{expenses:[{id:'e1',items:[]}],shifts:[{id:'s',taskId:null}]}).expenses[0].items,[]);
});

test('A locked-in quote becomes the baseline; the live estimate is still reported',()=>{
 const l=labor(),p=projectCost({rows,finance:{budgetCents:569890,expenses:[],shifts:[]},tracking:null,design,labor:l,now});
 assert.equal(p.quoteCents,569890);assert.equal(p.baselineCents,569890);assert.equal(p.varianceCents,p.projectedCents-569890);assert.equal(p.estimateVarianceCents,-17500);
 assert.equal(projectCost({rows,finance:{budgetCents:null,expenses:[],shifts:[]},tracking:null,design,labor:l,now}).baselineCents,p.estimateCents);
});

test('Progress is weighted by estimated hours, not step count',()=>{
 const w=progressWeights(design),sum=Object.values(w).reduce((a,b)=>a+b,0),est=labor().tasks.filter(t=>!['All','Shopping'].includes(t.stage)).reduce((n,t)=>n+t.personHours,0);
 assert.ok(Math.abs(sum-est)<.01,'every on-site hour lands on a milestone');assert.equal(w['walls-3'],18,'building and attaching 16 jacks');
 const t=projectDefaultTracking();t.stages.find(s=>s.id==='walls').steps.find(s=>s.id==='walls-3').percent=100;
 const heavy=projectProgress(t,w).percent;const light=structuredClone(projectDefaultTracking());light.stages.find(s=>s.id==='walls').steps.find(s=>s.id==='walls-4').percent=100;
 assert.ok(heavy>projectProgress(light,w).percent,'an 18-hour step moves progress more than a 3.6-hour one');assert.equal(projectProgress(t).percent,projectProgress(light).percent,'unweighted they are equal');
 const walls=t.stages.find(s=>s.id==='walls');assert.equal(projectStagePercent(walls,w),Math.round(1800/(7.2+8+6+18+3.6+5)));
 const custom=structuredClone(t);custom.stages[0].steps.push({id:'mine',name:'Custom',percent:0,notes:[]});const avg=Object.values(w).filter(v=>v>0).reduce((a,b)=>a+b,0)/Object.values(w).filter(v=>v>0).length;assert.ok(Math.abs(projectProgress(custom,w).weight-projectProgress(t,w).weight-avg)<1e-9,'custom steps weigh an average step');
});

test('Weights use logged hours for done work and the estimate for what is left',()=>{
 let tr=projectSetAssemblyCounts(projectDefaultTracking(),{panelsCompleted:8,jacksBuilt:0,jacksAttached:0,jacksPartial:0,ballastAttached:0},design);
 const est=progressWeights(design),shift=(taskId,h)=>({id:'s'+taskId+h,personId:'person-1',start:now-h*H,end:now,rateCents:0,note:'',taskId});
 const logged=progressWeights(design,{tracking:tr,shifts:[shift('frames',30)],now});
 assert.ok(Math.abs(logged['walls-1']-30)<1e-9,'frames are done: they weigh the 30 hours it actually took, not the 8-hour estimate');
 assert.equal(logged['walls-3'],est['walls-3'],'jacks not started: still the estimate');
 const loose=progressWeights(design,{tracking:tr,shifts:[shift(null,13.2)],now});
 assert.ok(Math.abs(loose['walls-1']+loose['walls-2']-13.2)<.01,'unassigned hours stand in for the done work that has none (frames + skins)');assert.ok(Math.abs(loose['walls-1']/loose['walls-2']-8/6)<.01,'split by their estimates');
 assert.deepEqual(progressWeights(design,{tracking:tr,shifts:null}),est,'locked burn-down: estimate only');
});

test('Reported shopping does not inflate actual labor or return as future labor',()=>{
 const shifts=[{id:'actual',personId:'person-1',start:now-(20*60+38)*60000,end:now,rateCents:5000,note:'Includes shopping',taskId:null}];
 const result=projectLabor(labor(),{design,tracking:projectDefaultTracking(),shifts,now});
 assert.equal(result.actualCents,103167);
 const trip=result.tasks.find(t=>t.id==='shoppingDone');assert.equal(trip.actualCents,0);assert.equal(trip.remainingCents,0);
 assert.equal(projectLabor(labor(),{design,tracking:null,shifts:[],now}).actualCents,0);
});

test('Time entries take their stages from the work completed during them unless one is chosen',()=>{
 const l=labor(),t=projectSetAssemblyCounts(projectDefaultTracking(),{panelsCompleted:8,jacksBuilt:4,jacksAttached:2},design),day=Date.UTC(2026,9,9,14);
 t.progressLog=[{at:day+H,step:'walls-1',from:13,to:100},{at:day+2*H,step:'walls-3',from:0,to:17},{at:day+30*H,step:'walls-4',from:0,to:13}];
 const shift={id:'a',personId:'person-1',start:day,end:day+10*H,rateCents:5000,note:'',taskId:null},w=progressWeights(design);
 const st=shiftStages(shift,{log:t.progressLog,design,tasks:l.tasks,weights:w,now});
 assert.equal(st.auto,true);assert.deepEqual(Object.keys(st.shares).sort(),['boltJacks','frames','jacks'].sort(),'only work inside the hours counts');
 const frames=w['walls-1']*.87,jacks=w['walls-3']*.17;assert.ok(Math.abs(st.shares.frames-frames/(frames+jacks))<1e-9,'split by the estimated hours of the work done');
 assert.deepEqual(shiftStages({...shift,taskId:'skins'},{log:t.progressLog,design,tasks:l.tasks,weights:w,now}),{auto:false,shares:{skins:1}},'a chosen stage wins');
 assert.equal(shiftStages({...shift,start:day+40*H,end:day+41*H},{log:t.progressLog,design,tasks:l.tasks,weights:w,now}),null);
 const p=projectLabor(l,{design,tracking:t,shifts:[shift],now});assert.equal(p.unassignedHours,0);
 assert.ok(Math.abs(p.tasks.reduce((n,x)=>n+x.actual,0)-10)<.05,'all ten hours land on stages');assert.equal(p.actualCents,50000);
});
