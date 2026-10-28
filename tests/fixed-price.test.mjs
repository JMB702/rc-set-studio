import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {priceRows} from '../public/pricing-calc.js';
import {laborEstimate,laborCost} from '../public/labor.js';
import {customizeRows} from '../public/pricing-config.js';
import {projectDefaultTracking,projectDefaultFinance,projectValidate,projectPreserveFinance,projectShiftCost,projectHoursByPerson} from '../public/project-model.js';
import {projectCost,projectFixedPrice,dayStart} from '../public/projection.js';

const data=JSON.parse(fs.readFileSync(new URL('../public/data/flat-shopping-list.json',import.meta.url),'utf8'));
const design={height:120,angle:90,floor:'charcoal',platformShape:'square',platformBack:18,platformSide:18,platformAngle:90,floorLip:true,seamlessCorners:true,seamlessCornerSide:'right'};
const rows=priceRows(data,{scope:'set',...design}),H=3600000,now=new Date(2026,10,3,18).getTime();
function labor(d=design){const est=laborEstimate(d,1),base=laborCost(est.hours,[5000]);return {...est,defaultHours:est.hours,hours:est.hours,rates:[5000],...base,shoppingRateCents:5000,shoppingCents:Math.round(est.shoppingHours*5000),costCents:base.costCents};}
const day=(d,h)=>dayStart(d)+h*H;
const shift=(id,d,h,hours,taskId=null)=>({id,personId:'jeff',start:day(d,h),end:day(d,h)+hours*H,rateCents:5000,note:'',taskId});
const crew=[{id:'jeff',name:'Jeff',rateCents:5000,archived:false}];
const fixedPrice={startDate:'2026-10-28',laborCents:175000,rateCents:4000,note:'Ross Creations, fixed labor to finish',agreedAt:dayStart('2026-10-27'),agreedTotalCents:null};
// Before Oct 28: two receipts and three time entries, one of them a shopping trip. After: a receipt, a return, build time and a shopping trip.
function finance(extra={}){return {...projectDefaultFinance(),budgetCents:569890,crew,
 expenses:[{id:'e1',vendor:'Home Depot',date:'2026-10-09',amountCents:300000,note:'',receiptId:null,items:[]},{id:'e2',vendor:'Home Depot',date:'2026-10-27',amountCents:12345,note:'',receiptId:null,items:[]},
  {id:'e3',vendor:'Home Depot',date:'2026-10-28',amountCents:4794,note:'Filler',receiptId:null,items:[]},{id:'e4',vendor:'Home Depot',date:'2026-10-30',amountCents:-5996,note:'BEHR 880 primer return',receiptId:null,items:[]}],
 shifts:[shift('s1','2026-10-20',8,8),shift('s2','2026-10-27',8,6),shift('s3','2026-10-27',15,2,'shoppingRemaining'),shift('s4','2026-10-28',8,7),shift('s5','2026-10-29',9,1.5,'shoppingRemaining'),shift('s6','2026-10-30',8,5)],...extra};}
const cost=(f=finance({fixedPrice}))=>projectCost({rows,finance:f,tracking:projectDefaultTracking(design),design,labor:labor(),now});

test('The fixed price splits at its start date: time and materials before it, fixed labor and materials at cost after',()=>{
 const p=cost(),f=p.fixed,t=cost(finance());
 // Before: both receipts dated before Oct 28 and every time entry that started before it, the shopping trip included.
 assert.equal(f.priorMaterialsCents,312345);assert.equal(f.priorLaborCents,(8+6+2)*5000);assert.equal(f.priorLaborHours,16);assert.equal(f.priorCents,312345+80000);
 // After: receipts at cost (the return is a credit), the fixed labor, and still to buy with its tax.
 assert.equal(f.laterMaterialsCents,4794-5996);assert.equal(f.toBuyCents,p.materials.remainingCents+p.materials.remainingTaxCents);
 assert.equal(p.projectedCents,312345+80000+175000+(4794-5996)+f.toBuyCents);
 assert.equal(p.spentCents+p.toGoCents,p.projectedCents);assert.equal(p.toGoCents,175000+f.toBuyCents);
 // Time after the start adds nothing to the client total, however many hours: doubling it changes nothing.
 const longer=cost(finance({fixedPrice,shifts:[...finance().shifts,shift('s7','2026-11-01',8,9)]}));assert.equal(longer.projectedCents,p.projectedCents);assert.ok(longer.fixed.loggedHours>f.loggedHours);
 // Without the fixed price the same records price every hour at the crew rate.
 assert.equal(t.fixed,null);assert.notEqual(t.projectedCents,p.projectedCents);assert.equal(t.spentCents,finance().expenses.reduce((n,e)=>n+e.amountCents,0)+finance().shifts.reduce((n,s)=>n+projectShiftCost(s,now).cents,0));
});

test('Shopping after the start is off the clock; Jeff\'s check compares hours with the fixed labor budget',()=>{
 const f=cost().fixed;
 assert.equal(f.loggedHours,7+5,'build time since Oct 28; the shopping trip is not counted');assert.equal(f.shoppingHours,1.5);
 assert.equal(f.budgetHours,43.75);assert.equal(f.projectedHours,Math.round((12+f.remainingHours)*100)/100);
 assert.equal(f.effectiveRateCents,Math.round(175000/(12+f.remainingHours)));assert.equal(f.overBudget,12+f.remainingHours>43.75);
 const small=cost(finance({fixedPrice:{...fixedPrice,laborCents:40000}})).fixed;assert.equal(small.budgetHours,10);assert.equal(small.overBudget,true);assert.ok(small.overHours>0);
});

test('The agreed total is frozen when the fixed price is saved; later changes show as variance against it, the quote stays secondary',()=>{
 const agreed=cost().projectedCents,saved=finance({fixedPrice:{...fixedPrice,agreedTotalCents:agreed}});
 let p=cost(saved);assert.equal(p.agreedCents,agreed);assert.equal(p.baselineCents,agreed);assert.equal(p.varianceCents,0);assert.equal(p.quoteCents,569890);assert.equal(p.quoteVarianceCents,agreed-569890);
 // A later receipt above plan moves the projection but not the agreement.
 saved.expenses.push({id:'e5',vendor:'Home Depot',date:'2026-11-02',amountCents:2500,note:'',receiptId:null,items:[]});p=cost(saved);
 assert.equal(p.agreedCents,agreed);assert.equal(p.varianceCents,2500);
});

test('Extra items to buy count in still to buy and tax, and a linked receipt marks them bought',()=>{
 const extra={id:'extra-0f5b7a7e-1a2b-4c3d-9e8f-0123456789ab',title:'DAP Plastic Wood Latex 32 oz',description:'',link:'',quantity:3,unitPriceCents:1598,taxable:true};
 const f=finance({fixedPrice,extraItems:[extra]}),withExtra=customizeRows(rows,{excluded:[],customItems:f.extraItems});
 const p=projectCost({rows:withExtra,finance:f,tracking:projectDefaultTracking(design),design,labor:labor(),now}),base=cost();
 assert.equal(p.materials.remainingCents-base.materials.remainingCents,4794);assert.equal(p.materials.remainingTaxCents-base.materials.remainingTaxCents,Math.round(4794*.07));
 assert.equal(p.materials.plan.find(x=>x.row.id===extra.id).status,'remaining');
 f.expenses.push({id:'e6',vendor:'Home Depot',date:'2026-11-01',amountCents:5130,note:'',receiptId:null,items:[{id:'i1',materialId:extra.id,description:'',quantity:3,amountCents:5130,complete:true,substitute:false,note:''}]});
 const bought=projectCost({rows:withExtra,finance:f,tracking:projectDefaultTracking(design),design,labor:labor(),now});assert.equal(bought.materials.plan.find(x=>x.row.id===extra.id).status,'bought');
});

test('Finance validation keeps the fixed price and extra items, rejects bad ones, and older saves cannot drop them',()=>{
 const validate=input=>projectValidate('finance',input,now);
 const extra={id:'extra-0f5b7a7e-1a2b-4c3d-9e8f-0123456789ab',title:' Filler ',description:'',link:'',quantity:3,unitPriceCents:1598,taxable:true};
 const ok=validate({...finance({fixedPrice:{...fixedPrice,agreedTotalCents:1124900}}),extraItems:[extra]});
 assert.deepEqual(ok.fixedPrice,{...fixedPrice,agreedTotalCents:1124900});assert.equal(ok.extraItems[0].title,'Filler');
 assert.equal(validate(projectDefaultFinance()).fixedPrice,null);
 for(const bad of [{startDate:'Oct 28'},{laborCents:0},{laborCents:-1},{rateCents:0},{agreedAt:'today'},{agreedTotalCents:-5},{note:'x'.repeat(1001)}])assert.throws(()=>validate(finance({fixedPrice:{...fixedPrice,...bad}})),/fixed price/,JSON.stringify(bad));
 for(const bad of [{id:'custom-1'},{title:''},{quantity:0},{quantity:1.5},{unitPriceCents:-1},{taxable:'yes'},{link:'javascript:alert(1)'}])assert.throws(()=>validate(finance({extraItems:[{...extra,...bad}]})),/extra item/,JSON.stringify(bad));
 // A browser that predates the fixed price saves without the keys; the server keeps what was there.
 const previous=ok,older={...finance()};delete older.fixedPrice;delete older.extraItems;
 const merged=validate(projectPreserveFinance(previous,older));assert.deepEqual(merged.fixedPrice,previous.fixedPrice);assert.deepEqual(merged.extraItems,previous.extraItems);
 // Clearing it explicitly works.
 assert.equal(validate(projectPreserveFinance(previous,{...older,fixedPrice:null})).fixedPrice,null);
});

test('Time entries total by person, merging a person re-added under the same name, and add up to a grand total',()=>{
 const people=[{id:'jeff',name:'Jeff',rateCents:5000,archived:false},{id:'b1',name:'Bryson',rateCents:0,archived:true},{id:'b2',name:'Bryson ',rateCents:0,archived:false},{id:'tom',name:'Tom',rateCents:0,archived:true}];
 const f={...finance(),crew:people,shifts:[...finance().shifts,{...shift('b1a','2026-10-16',9,2.5),personId:'b1',rateCents:0},{...shift('b2a','2026-10-29',9,3),personId:'b2',rateCents:0},{...shift('t1','2026-10-16',14,.25),personId:'tom',rateCents:0}]};
 const by=projectHoursByPerson(f,{now,since:'2026-10-28',offClock:['shoppingRemaining','shoppingDone']});
 assert.deepEqual(by.people.map(g=>[g.name,g.hours,g.shifts.length]),[['Jeff',29.5,6],['Bryson',5.5,2],['Tom',.25,1]]);
 assert.deepEqual(by.people.find(g=>g.name==='Bryson').personIds,['b1','b2']);assert.equal(by.people.find(g=>g.name==='Tom').archived,true);
 // Since Oct 28, shopping off the clock: Jeff's 7 h + 5 h (not the 1.5 h trip), Bryson's 3 h.
 assert.deepEqual(by.people.map(g=>g.sinceHours),[12,3,0]);assert.equal(by.sinceHours,15);
 assert.equal(by.hours,Math.round(by.people.reduce((n,g)=>n+g.hours,0)*100)/100);assert.equal(by.hours,35.25);
 assert.equal(by.cents,f.shifts.reduce((n,s)=>n+projectShiftCost(s,now).cents,0));
 assert.ok(by.people.every(g=>g.shifts.every((s,i,a)=>!i||a[i-1].start>=s.start)),'newest entry first inside each person');
 assert.deepEqual(projectHoursByPerson({crew:people,shifts:[]}),{people:[],hours:0,cents:0,sinceHours:0});
});
