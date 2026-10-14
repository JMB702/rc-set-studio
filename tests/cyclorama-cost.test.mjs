import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {priceRows,summary,pricingBudget} from '../public/pricing-calc.js';
import {laborTasks,laborEstimate,laborFor,setLaborCrew,costSummary} from '../public/labor.js';
import {cycloramaPlan} from '../public/cyclorama.js';
import {platformPlan} from '../public/platform.js';
import {estimateCsv} from '../public/pricing-review.js';
import {projectCost,projectLabor,progressWeights} from '../public/projection.js';
import {projectDefaultTracking,projectSetGuideStage} from '../public/project-model.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/flat-shopping-list.json',import.meta.url),'utf8'));
const base={scope:'set',height:96,angle:90,floor:'none',platformShape:'angled',platformAngle:90,platformBack:12,platformSide:12};

test('All seamless combinations price matching plan quantities and preserve existing structural connectors',()=>{
 for(const height of [96,120])for(const angle of [0,45,90])for(const seamlessCorners of [false,true])for(const seamlessPerimeter of [false,true]){
  const d={...base,height,angle,platformAngle:angle,seamlessCorners,seamlessPerimeter},p=cycloramaPlan(d),r=priceRows(data,d),cyc=r.filter(x=>x.id.startsWith('cyc'));
  assert.equal(new Set(r.map(x=>x.id)).size,r.length);
  assert.equal(cyc.length>0,p.corners>0||p.perimeter);
  assert.ok(r.some(x=>x.id==='corners'),'structural corner connections retained');
  assert.equal(r.some(x=>x.id==='wallCornerCaulk'),!p.corners);
  if(cyc.length){
   assert.equal(r.find(x=>x.id==='cycRibPly').purchaseQuantity,p.ribSheets);
   assert.equal(r.find(x=>x.id==='cycSkin').purchaseQuantity,p.skinSheets);
   assert.equal(r.find(x=>x.id==='cycAnchorScrews').needed+r.find(x=>x.id==='cycSkinScrews').needed,p.fasteners);
   const compounds=r.filter(x=>x.productUrl==='https://www.homedepot.com/p/100321605');assert.equal(compounds.reduce((n,x)=>n+x.purchaseQuantity,0),Math.ceil(compounds.reduce((n,x)=>n+x.needed,0)));
   assert.ok(cyc.filter(x=>['cycRibPly','cycSkin','cycAdhesive','cycReinforcement'].includes(x.id)).every(x=>Number.isInteger(x.subtotalCents)&&x.subtotalCents>0));
  }
  const platform=platformPlan(angle,12,12,angle,d);assert.equal(r.find(x=>x.id==='platformDeck').purchaseQuantity,platform.deckSheets);
  const tasks=laborTasks(d);assert.equal(tasks.some(x=>x.id==='cycJunctions'),!!(p.corners&&p.perimeter));
  assert.equal(tasks.some(x=>x.id==='cycCornerSkin'),!!p.corners);assert.equal(tasks.some(x=>x.id==='cycFloorSweep'),p.perimeter);
 }
});

test('Turning both options off restores original price rows and labor exactly',()=>{
 const original=priceRows(data,base),enabled=priceRows(data,{...base,seamlessCorners:true,seamlessPerimeter:true});
 assert.ok(summary(enabled).subtotal>summary(original).subtotal);
 assert.deepEqual(priceRows(data,{...base,seamlessCorners:false,seamlessPerimeter:false}),original);
 assert.deepEqual(laborTasks({...base,seamlessCorners:false,seamlessPerimeter:false}),laborTasks(base));
 for(const scope of ['panel','floor'])assert.ok(!priceRows(data,{...base,scope,seamlessCorners:true,seamlessPerimeter:true}).some(x=>x.id.startsWith('cyc')));
});

test('The two compound corners have a separate conservative 48 person-hour allowance and serialized scheduling',()=>{
 const d={...base,seamlessCorners:true,seamlessPerimeter:true},two=laborEstimate(d,2),many=laborEstimate(d,12),junction=two.tasks.find(t=>t.id==='cycJunctions');
 assert.equal(junction.personHours,48);assert.match(junction.note,/not a published benchmark/);
 assert.deepEqual(two.dryingDays,{min:3,max:5});assert.equal(many.junctionHours,48);assert.ok(many.hours>=24);
 assert.equal(two.hours,Math.ceil((two.personHours-two.shoppingHours)/2*2)/2);
 assert.equal(laborEstimate(base).dryingDays,null);
});

test('Pricing budget, approval summary and fresh projection preserve both feature flags',()=>{
 setLaborCrew([{name:'Builder',rateCents:5000},{name:'Helper',rateCents:3000}]);
 try{for(const height of [96,120])for(const angle of [45,90])for(const seamlessCorners of [false,true])for(const seamlessPerimeter of [false,true]){
  const d={...base,height,angle,platformAngle:angle,seamlessCorners,seamlessPerimeter},rows=priceRows(data,d),l=laborFor(d),budget=pricingBudget(data,{...d,excluded:[],customItems:[]},l),approval=costSummary(data,d),p=projectCost({rows,finance:{expenses:[],shifts:[]},tracking:projectDefaultTracking(),design:d,labor:l});
  assert.equal(budget.totalCents,approval.totalCents);assert.equal(budget.pending,approval.pending);
  assert.equal(p.estimateCents,budget.totalCents);assert.equal(p.projectedCents,p.estimateCents-3.5*l.shoppingRateCents,'existing completed shopping is not synthesized as future spend');
 }}finally{setLaborCrew(null);}
});

test('Disabled seamless milestones carry zero weight without erasing recorded work',()=>{
 const d={...base,seamlessCorners:true,seamlessPerimeter:true},enabled=progressWeights(d),off=progressWeights(base);
 assert.equal(enabled['cyc-junctions'],48);
 for(const id of ['cyc-backing','cyc-ribs','cyc-skin','cyc-perimeter','cyc-junctions','cyc-finish'])assert.equal(off[id],0);
 const tr=projectSetGuideStage(projectDefaultTracking(),47,100,d);assert.equal(tr.stages.flatMap(s=>s.steps).find(s=>s.id==='cyc-junctions').percent,100);
 assert.ok(progressWeights(d,{tracking:tr,shifts:[]})['cyc-junctions']>0);
});

test('The exported estimate includes the junction allowance and separates drying from labor',()=>{
 const d={...base,seamlessCorners:true,seamlessPerimeter:true},csv=estimateCsv(priceRows(data,d),'Both seamless options',laborFor(d));
 assert.match(csv,/Form and finish the two compound floor corners.*47.*48/);
 assert.match(csv,/not a published benchmark/);assert.match(csv,/Additional drying calendar days/);assert.match(csv,/excluded from labor/);
});

test('Completing the serialized corner task removes its own crew cost, not an average task rate',()=>{
 const d={...base,seamlessCorners:true,seamlessPerimeter:true};setLaborCrew(Array.from({length:6},(_,i)=>({name:`Worker ${i}`,rateCents:2000})));
 try{const l=laborFor(d),tr=projectDefaultTracking(d),before=projectLabor(l,{design:d,tracking:tr}),done=projectSetGuideStage(tr,47,100,d),after=projectLabor(l,{design:d,tracking:done});
  const corner=before.tasks.find(t=>t.id==='cycJunctions');assert.equal(corner.remainingCents,Math.round(l.taskOnSiteHours.cycJunctions*l.crewRateCents));
  const setupDelta=before.tasks.find(t=>t.id==='setup').remainingCents-after.tasks.find(t=>t.id==='setup').remainingCents;assert.ok(Math.abs(before.remainingCents-after.remainingCents-corner.remainingCents-setupDelta)<=2);assert.equal(before.tasks.find(t=>t.id==='frames').remainingCents,after.tasks.find(t=>t.id==='frames').remainingCents);
  assert.ok(l.taskOnSiteHours.cycJunctions>=24);assert.equal(after.tasks.find(t=>t.id==='cycJunctions').remainingCents,0);
  assert.equal(before.remainingCents,l.costCents-3.5*l.shoppingRateCents);
 }finally{setLaborCrew(null);}
});
