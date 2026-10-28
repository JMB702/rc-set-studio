import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {priceRows} from '../public/pricing-calc.js';
import {laborEstimate,laborCost} from '../public/labor.js';
import {projectDefaultTracking,projectDefaultFinance,projectValidate,projectPreserveFinance,projectShiftCost,projectHoursByPerson,projectEntryCost} from '../public/project-model.js';
import {projectCost,dayStart,RETURN_TAX,fixedLabor} from '../public/projection.js';

const data=JSON.parse(fs.readFileSync(new URL('../public/data/flat-shopping-list.json',import.meta.url),'utf8'));
const design={height:120,angle:90,floor:'charcoal',platformShape:'square',platformBack:18,platformSide:18,platformAngle:90,floorLip:true,seamlessCorners:true,seamlessCornerSide:'right'};
const rows=priceRows(data,{scope:'set',...design}),H=3600000,now=new Date(2026,10,3,18).getTime();
function labor(d=design){const est=laborEstimate(d,1),base=laborCost(est.hours,[5000]);return {...est,defaultHours:est.hours,hours:est.hours,rates:[5000],...base,shoppingRateCents:5000,shoppingCents:Math.round(est.shoppingHours*5000),costCents:base.costCents};}
const day=(d,h)=>dayStart(d)+h*H;
const shift=(id,d,h,hours,taskId=null)=>({id,personId:'jeff',start:day(d,h),end:day(d,h)+hours*H,rateCents:5000,note:'',taskId});
const crew=[{id:'jeff',name:'Jeff',rateCents:5000,archived:false}];
const fixedPrice={startDate:'2026-10-28',laborCents:175000,rateCents:4000,note:'Ross Creations, fixed labor to finish',agreedAt:dayStart('2026-10-27'),agreedTotalCents:null};
const line=(id,extra={})=>({id,materialId:null,description:'BEHR 880 Concrete & Masonry Bonding Primer',quantity:2,amountCents:5996,complete:false,substitute:false,note:'',...extra});
// Before Oct 28: two receipts (one with primer to return) and three time entries, one a shopping trip. After: a receipt, build time and a shopping trip.
function finance(extra={}){return {...projectDefaultFinance(),budgetCents:569890,crew,
 expenses:[{id:'e1',vendor:'Home Depot',date:'2026-10-12',amountCents:300000,note:'',receiptId:null,items:[line('l880',{returnPlanned:true})]},{id:'e2',vendor:'Home Depot',date:'2026-10-27',amountCents:12345,note:'',receiptId:null,items:[]},
  {id:'e3',vendor:'Home Depot',date:'2026-10-28',amountCents:4794,note:'Filler',receiptId:null,items:[]}],
 shifts:[shift('s1','2026-10-20',8,8),shift('s2','2026-10-27',8,6),shift('s3','2026-10-27',15,2,'shoppingRemaining'),shift('s4','2026-10-28',8,7),shift('s5','2026-10-29',9,1.5,'shoppingRemaining'),shift('s6','2026-10-30',8,5)],...extra};}
const cost=(f=finance({fixedPrice}))=>projectCost({rows,finance:f,tracking:projectDefaultTracking(design),design,labor:labor(),now});
const credit=5996+Math.round(5996*RETURN_TAX);

test('Fixed price: time and materials before the start date, then fixed labor at $40/h and materials at cost, less returns',()=>{
 const p=cost(),f=p.fixed;
 // Before Oct 28: receipts dated before it and every time entry that started before it, at the rates captured then.
 assert.equal(f.priorMaterialsCents,312345);assert.equal(f.priorLaborCents,(8+6+2)*5000);assert.equal(f.priorLaborHours,16);
 // The widget: labor, plus still to buy with its tax, less the expected return credit.
 assert.equal(f.budgetHours,43.75);assert.equal(f.rateCents,4000);assert.equal(f.toBuyCents,p.materials.remainingCents+p.materials.remainingTaxCents);
 assert.equal(f.returnCreditCents,credit);assert.equal(f.costToFinishCents,175000+f.toBuyCents-credit);
 // Hours since the start are worked at $40/h inside the $1,750, never on top: 12 h logged = $480 spent of it.
 assert.equal(f.loggedHours,12);assert.equal(f.hoursToFinish,31.75);assert.equal(f.laborDoneCents,48000);
 assert.equal(p.spentCents,312345+80000+4794+48000);assert.equal(p.toGoCents,175000-48000+f.toBuyCents-credit);
 assert.equal(p.projectedCents,312345+80000+4794+175000+f.toBuyCents-credit);assert.equal(p.projectedCents,p.spentCents+p.toGoCents);
 assert.equal(f.effectiveRateCents,undefined,'no effective rate');assert.equal(f.remainingHours,undefined,'no pace projection');
});

test('More hours than the fixed labor covers do not raise the total; shopping is off the clock',()=>{
 const p=cost(),long=cost(finance({fixedPrice,shifts:[...finance().shifts,shift('s7','2026-10-31',7,12),shift('s8','2026-11-01',7,12),shift('s9','2026-11-02',7,12)]}));
 assert.equal(long.projectedCents,p.projectedCents);assert.equal(long.fixed.loggedHours,48);assert.equal(long.fixed.hoursToFinish,0);assert.equal(long.fixed.overHours,4.25);assert.equal(long.fixed.laborDoneCents,175000);
 assert.equal(p.fixed.shoppingHours,1.5);
 // Each entry from Oct 28 shows at $40/h (shopping $0); earlier ones keep their captured $50/h.
 const rated={since:'2026-10-28',offClock:['shoppingRemaining','shoppingDone'],fixedRateCents:4000,now};
 assert.deepEqual(projectEntryCost(shift('a','2026-10-27',8,2),rated),{hours:2,cents:10000});assert.deepEqual(projectEntryCost(shift('b','2026-10-28',8,2),rated),{hours:2,cents:8000});assert.deepEqual(projectEntryCost(shift('c','2026-10-29',8,2,'shoppingRemaining'),rated),{hours:2,cents:0});
 const by=projectHoursByPerson(finance(),rated);assert.equal(by.people[0].cents,(8+6+2)*5000+(7+5)*4000);assert.equal(by.people[0].sinceHours,12);
});

test('Planned returns: credited with tax until a refund line names them, then the refund itself counts',()=>{
 let p=cost();assert.equal(p.materials.returns.length,1);assert.equal(p.materials.returns[0].creditCents,credit);assert.equal(p.materials.returns[0].returned,false);
 const before=p.projectedCents,f=finance({fixedPrice});
 f.expenses.push({id:'r1',vendor:'Home Depot',date:'2026-10-30',amountCents:-credit,note:'Return',receiptId:null,items:[{id:'rl',materialId:null,description:'Return: BEHR 880',quantity:2,amountCents:-credit,complete:false,substitute:false,note:'',returnOf:'l880'}]});
 p=cost(f);assert.equal(p.materials.returns[0].returned,true);assert.equal(p.materials.returnCreditCents,0);assert.equal(p.fixed.returnCreditCents,0);
 assert.equal(p.projectedCents,before,'the refund replaces the expected credit; nothing counts twice');
 // Without a fixed price the credit still comes off the projection.
 const plain=finance(),tm=cost(plain);const kept=finance();kept.expenses[0].items[0].returnPlanned=false;assert.equal(cost(kept).projectedCents-tm.projectedCents,credit);
});

test('Time entries total by person at the fixed rate, merging a person re-added under the same name, with a grand total',()=>{
 const people=[{id:'jeff',name:'Jeff',rateCents:5000,archived:false},{id:'b1',name:'Bryson',rateCents:0,archived:true},{id:'b2',name:'Bryson ',rateCents:0,archived:false},{id:'tom',name:'Tom',rateCents:0,archived:true}];
 const f={...finance(),crew:people,shifts:[...finance().shifts,{...shift('b1a','2026-10-16',9,2.5),personId:'b1',rateCents:0},{...shift('b2a','2026-10-29',9,3),personId:'b2',rateCents:0},{...shift('t1','2026-10-16',14,.25),personId:'tom',rateCents:0}]};
 const by=projectHoursByPerson(f,{now,since:'2026-10-28',offClock:['shoppingRemaining','shoppingDone']});
 assert.deepEqual(by.people.map(g=>[g.name,g.hours,g.shifts.length]),[['Jeff',29.5,6],['Bryson',5.5,2],['Tom',.25,1]]);
 assert.deepEqual(by.people.find(g=>g.name==='Bryson').personIds,['b1','b2']);assert.equal(by.people.find(g=>g.name==='Tom').archived,true);
 assert.deepEqual(by.people.map(g=>g.sinceHours),[12,3,0]);assert.equal(by.sinceHours,15);assert.equal(by.hours,35.25);
 assert.equal(by.cents,f.shifts.reduce((n,s)=>n+projectShiftCost(s,now).cents,0),'without a fixed rate, the captured rates');
 assert.deepEqual(projectHoursByPerson({crew:people,shifts:[]}),{people:[],hours:0,cents:0,sinceHours:0});
});

test('Finance validation keeps the fixed price and return flags, rejects bad ones, and older saves cannot drop them',()=>{
 const validate=input=>projectValidate('finance',input,now);
 const ok=validate(finance({fixedPrice:{...fixedPrice,agreedTotalCents:1117010}}));
 assert.deepEqual(ok.fixedPrice,{...fixedPrice,agreedTotalCents:1117010});assert.equal(ok.expenses[0].items[0].returnPlanned,true);
 assert.equal(validate(projectDefaultFinance()).fixedPrice,null);assert.equal(Object.hasOwn(validate(finance()),'extraItems'),false,'no extra items list');
 for(const bad of [{startDate:'Oct 28'},{laborCents:0},{rateCents:0},{agreedAt:'today'},{agreedTotalCents:-5},{note:'x'.repeat(1001)}])assert.throws(()=>validate(finance({fixedPrice:{...fixedPrice,...bad}})),/fixed price/,JSON.stringify(bad));
 for(const bad of [{returnPlanned:'yes'},{returnOf:'bad id!'}]){const f=finance();Object.assign(f.expenses[0].items[0],bad);assert.throws(()=>validate(f),/line items/,JSON.stringify(bad));}
 // A browser that predates these keys saves without them; the server keeps what was there.
 const older=finance();delete older.fixedPrice;delete older.expenses[0].items[0].returnPlanned;
 const merged=validate(projectPreserveFinance(ok,older));assert.deepEqual(merged.fixedPrice,ok.fixedPrice);assert.equal(merged.expenses[0].items[0].returnPlanned,true);
 // Explicit choices win: clearing the fixed price, or unchecking a return.
 assert.equal(validate(projectPreserveFinance(ok,{...older,fixedPrice:null})).fixedPrice,null);
 const kept=finance();kept.expenses[0].items[0].returnPlanned=false;assert.equal(validate(projectPreserveFinance(ok,kept)).expenses[0].items[0].returnPlanned,undefined);
});

test('One more bag of Easy Sand 45 for the platform fascia and bead edges is on the list to buy and in the cost to finish',()=>{
 const row=rows.find(r=>r.id==='platformEdgeCompound');
 assert.deepEqual([row.purchaseQuantity,row.unitPriceCents,row.productUrl,row.group],[1,1298,'https://www.homedepot.com/p/100321610','platformFinish']);
 assert.equal(rows.find(r=>r.id==='wallTouchup').purchaseQuantity,1,'the wall touch-up bag is separate');
 // Without the row the fixed cost to finish is $12.98 plus 7% tax lower.
 const p=cost(),without=projectCost({rows:rows.filter(r=>r.id!=='platformEdgeCompound'),finance:finance({fixedPrice}),tracking:projectDefaultTracking(design),design,labor:labor(),now});
 assert.equal(p.materials.plan.find(x=>x.row.id==='platformEdgeCompound').status,'remaining');
 // Tax is rounded over the whole list, so the bag adds $13.88 or $13.89.
 const delta=p.fixed.toBuyCents-without.fixed.toBuyCents;assert.ok(Math.abs(delta-1389)<=1,String(delta));assert.equal(p.fixed.costToFinishCents-without.fixed.costToFinishCents,delta);assert.equal(p.projectedCents-without.projectedCents,delta);
 // A different row from the platformCompound pail: receipts linked there do not mark this bag bought.
 const linked=finance({fixedPrice});linked.expenses.push({id:'e9',vendor:'Home Depot',date:'2026-10-20',amountCents:5192,note:'',receiptId:null,items:[{id:'i9',materialId:'platformCompound',description:'Easy Sand 45',quantity:4,amountCents:5192,complete:true,substitute:true,note:''}]});
 assert.equal(projectCost({rows,finance:linked,tracking:projectDefaultTracking(design),design,labor:labor(),now}).materials.plan.find(x=>x.row.id==='platformEdgeCompound').status,'remaining');
});

test('Under a fixed price the labor still to come is the fixed budget, spread over the steps in their own proportions',()=>{
 const tm=cost(finance()),p=cost(),w=p.labor,f=p.fixed,build=t=>t.stage!=='Shopping';
 // The hours to go equal the widget's: 43.75 h less the 12 build hours logged since Oct 28, at $40/h.
 assert.equal(w.remainingHours,31.75);assert.equal(f.hoursToFinish,31.75);assert.ok(Math.abs(w.tasks.filter(build).reduce((n,t)=>n+t.remainingExact,0)-31.75)<1e-9);
 assert.equal(w.remainingCents,175000-48000);assert.equal(w.remainingCents,Math.round(f.hoursToFinish*4000));
 // One factor for every step: the shares of what is left are the pace model's shares.
 const share=(work,id)=>work.tasks.find(t=>t.id===id).remainingExact/work.tasks.filter(build).reduce((n,t)=>n+t.remainingExact,0);
 for(const t of tm.labor.tasks.filter(t=>build(t)&&t.remainingExact>0))assert.ok(Math.abs(share(w,t.id)-share(tm.labor,t.id))<1e-9,t.id);
 assert.ok(w.tasks.filter(t=>t.stage==='Shopping').every(t=>t.remainingExact===0&&t.remainingCents===0),'shopping is off the clock');
 // Logged labor is what the client pays for it, so the card's labor and total match the widget and the projection.
 assert.equal(w.actualCents,f.priorLaborCents+f.laborDoneCents);assert.equal(w.projectedCents,f.priorLaborCents+175000);
 const m=p.materials;assert.equal(m.spentCents+m.remainingCents+m.remainingTaxCents-m.returnCreditCents+w.projectedCents,p.projectedCents);
 assert.equal(w.pace,null);assert.equal(w.actualHours,tm.labor.actualHours,'hours logged are the same hours');
 // Past the budget: nothing to go, and labor stays at the fixed amount.
 const over=cost(finance({fixedPrice,shifts:[...finance().shifts,shift('o1','2026-10-31',7,12),shift('o2','2026-11-01',7,12),shift('o3','2026-11-02',7,12)]})).labor;
 assert.equal(over.remainingHours,0);assert.equal(over.remainingCents,0);assert.ok(over.tasks.every(t=>t.remainingExact===0));assert.equal(over.projectedCents,f.priorLaborCents+175000);
 // Without a fixed price nothing changes.
 assert.ok(tm.labor.pace!==undefined&&tm.fixed===null);assert.notEqual(tm.labor.remainingHours,31.75);
 assert.equal(fixedLabor({tasks:[],actualHours:0},{budgetHours:43.75,loggedHours:0,rateCents:4000,priorLaborCents:0,laborDoneCents:0,laborCents:175000}).remainingHours,43.75,'the budget stands even with no step left to spread it over');
});
