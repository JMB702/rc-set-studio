import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {priceRows} from '../public/pricing-calc.js';
import {laborEstimate,laborCost} from '../public/labor.js';
import {customizeRows} from '../public/pricing-config.js';
import {projectDefaultTracking,projectValidate,projectPreserveFinance,projectSetGuideStage} from '../public/project-model.js';
import {projectMaterials,projectLabor,projectCost,laborStageNumbers,laborTaskProgress,supplyProgress,WALL_GROUPS} from '../public/projection.js';

const data=JSON.parse(fs.readFileSync(new URL('../public/data/flat-shopping-list.json',import.meta.url),'utf8'));
const design={height:120,angle:90,floor:'charcoal',platformShape:'square',platformBack:12,platformSide:12,platformAngle:90};
const rows=priceRows(data,{scope:'set',...design});
const H=3600000,now=Date.UTC(2026,9,10,18);
// What laborFor() returns, without the browser's saved settings.
function labor(d=design,{rates=[5000,null],crew=2,hours=null}={}){const est=laborEstimate(d,crew),used=hours??est.hours,base=laborCost(used,rates),shoppingRateCents=rates[0],shoppingCents=shoppingRateCents==null?null:Math.round(est.shoppingHours*shoppingRateCents);return {...est,defaultHours:est.hours,hours:used,adjusted:hours!=null,rates,...base,shoppingRateCents,shoppingCents,costCents:base.costCents===null&&shoppingCents===null?null:(base.costCents??0)+(shoppingCents??0)};}
const item=(materialId,extra={})=>({id:'i-'+materialId+(extra.id||''),materialId,description:'',quantity:null,amountCents:null,complete:materialId!==null,substitute:false,note:'',...extra});
const expense=(items,amountCents=10000,id='e1')=>({id,vendor:'Home Depot',date:'2026-10-09',amountCents,note:'',receiptId:null,items});

test('A fresh projection equals the estimate to the cent, for any design, crew, rates or adjusted hours',()=>{
 for(const d of [design,{...design,height:96,platformShape:'none',floor:'wood',angle:45},{...design,platformShape:'angled',platformAngle:60,angle:45,floor:'none'}])
  for(const options of [{},{rates:[5000,3000]},{rates:[null,null]},{rates:[2500,null,1000],crew:3},{hours:71.5}]){
   const l=labor(d,options),r=priceRows(data,{scope:'set',...d}),p=projectCost({rows:r,finance:{expenses:[],shifts:[]},tracking:projectDefaultTracking(),design:d,labor:l,now});
   assert.equal(p.projectedCents,p.estimateCents,JSON.stringify({d,options}));assert.equal(p.varianceCents,0);
   assert.ok(Math.abs(p.labor.projectedHours-((l.personHours-l.shoppingHours)*l.hours/l.defaultHours+l.shoppingHours))<.01);
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
 const jacks=labor().tasks.find(x=>x.id==='jacks');assert.equal(laborTaskProgress(jacks,{design,tracking:t}),50);
 assert.equal(laborTaskProgress(labor().tasks.find(x=>x.id==='shoppingDone'),{design,tracking:null}),100);
 assert.equal(laborTaskProgress(jacks,{design,tracking:null}),0);
});

test('Hours: logged time is actual, the tracker sets what is left, unassigned time still counts',()=>{
 let t=projectDefaultTracking();for(const stage of [13,14,15,16])t=projectSetGuideStage(t,stage,50,design);
 const l=labor(),shifts=[{id:'a',personId:'person-1',start:now-6*H,end:now,rateCents:5000,note:'',taskId:'jacks'},{id:'b',personId:'person-2',start:now-2*H,end:now,rateCents:0,note:'',taskId:null}];
 const p=projectLabor(l,{design,tracking:t,shifts,now}),jacks=p.tasks.find(x=>x.id==='jacks'),estimate=l.tasks.find(x=>x.id==='jacks').personHours;
 assert.equal(jacks.actual,6);assert.equal(jacks.progress,50);assert.equal(jacks.remaining,estimate/2);assert.equal(jacks.projected,6+estimate/2);assert.equal(jacks.actualCents,30000);
 assert.equal(p.unassignedHours,2);assert.equal(p.unassignedCount,1);assert.equal(p.actualCents,30000+17500);
 // The reported wall-panel shopping trip stops being assumed once time is logged against it.
 assert.equal(p.tasks.find(x=>x.id==='shoppingDone').actual,3.5);
 const logged=projectLabor(l,{design,tracking:t,shifts:[{...shifts[0],taskId:'shoppingDone',start:now-2*H}],now}).tasks.find(x=>x.id==='shoppingDone');assert.equal(logged.actual,2);assert.equal(logged.reported,false);
 // A finished stage has nothing left, however long it took.
 let done=projectDefaultTracking();for(const stage of [13,14,15,16])done=projectSetGuideStage(done,stage,100,design);assert.equal(projectLabor(l,{design,tracking:done,shifts,now}).tasks.find(x=>x.id==='jacks').projected,6);
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
 assert.equal(p.quoteCents,569890);assert.equal(p.baselineCents,569890);assert.equal(p.varianceCents,p.projectedCents-569890);assert.equal(p.estimateVarianceCents,0);
 assert.equal(projectCost({rows,finance:{budgetCents:null,expenses:[],shifts:[]},tracking:null,design,labor:l,now}).baselineCents,p.estimateCents);
});
