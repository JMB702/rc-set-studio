import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculate} from '../public/shopping-calc.js';
import {floorArea,priceRows,summary} from '../public/pricing-calc.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/flat-shopping-list.json',import.meta.url)));
test('Floor quantities follow actual outline, including angled wings',()=>{
 for(const angle of [0,15,45,75,90]){
  const c=Math.cos(angle*Math.PI/180)*96,s=Math.sin(angle*Math.PI/180)*96;
  const p=[[-96,0],[96,0],[96+c,s],[96+c,96],[-96-c,96],[-96-c,s]];
  const area=Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-b[0]*a[1]},0))/288;
  assert.ok(Math.abs(floorArea(angle)-area)<1e-8);
 }
});
test('Ten-foot sheets retain saw-kerf allowance in a batch',()=>{
 assert.equal(calculate(data,'10x4',8,false,false).find(r=>r.id==='skin').purchaseQuantity,11);
});
test('Straight seam screws share the support screw pack',()=>{
 const rows=priceRows(data,{scope:'set',height:96,angle:45,floor:'wood',supports:true,ballast:true});
 const screws=rows.filter(r=>r.id==='lapScrews');assert.equal(screws.length,1);assert.equal(screws[0].needed,88);assert.equal(screws[0].purchaseQuantity,1);
});
test('Floor-only excludes panel stock and preserves unresolved costs',()=>{
 const rows=priceRows(data,{scope:'floor',height:120,angle:90,floor:'charcoal'});
 assert.ok(!rows.some(r=>r.id==='board16'));assert.equal(rows.find(r=>r.id==='floorPly').purchaseQuantity,5);
 assert.ok(summary(rows).pending>0);assert.ok(rows.every(r=>r.subtotalCents===null));
});
test('All scopes and variants use integer packs and Home Depot links',()=>{
 for(const height of [96,120])for(const scope of ['set','panel','floor'])for(const floor of ['wood','charcoal']){
  const rows=priceRows(data,{scope,height,angle:45,floor});
  for(const r of rows){assert.ok(r.purchaseQuantity===null||Number.isInteger(r.purchaseQuantity));assert.ok(r.subtotalCents===null||Number.isInteger(r.subtotalCents));assert.ok(r.productUrl.startsWith('https://www.homedepot.com/'));}
 }
});
test('Wall paint is included once, rounded by coated face area, and removable',()=>{
 for(const height of [96,120]){
  const config={scope:'set',height,angle:45,floor:'wood'};
  const rows=priceRows(data,config),paint=rows.filter(r=>r.id==='wallPaint');
  assert.equal(paint.length,1);assert.equal(paint[0].purchaseQuantity,2);assert.equal(paint[0].subtotalCents,6996);
  assert.ok(!priceRows(data,{...config,finishes:false}).some(r=>r.id==='wallPaint'));
  assert.equal(priceRows(data,{...config,scope:'panel'}).find(r=>r.id==='wallPaint').purchaseQuantity,1);
  assert.ok(!priceRows(data,{...config,scope:'floor'}).some(r=>r.id==='wallPaint'));
 }
});
import {platformPlan,platformCuts,studCount,PLATFORM,legLength,sillLegLength} from '../public/platform.js';
import {platformRows} from '../public/pricing-calc.js';
test('Platform keeps its gaps from the back and side walls at every angle',()=>{
 for(const angle of [0,30,45,60,90])for(const [back,side] of [[12,12],[0,0],[48,48],[6,30]]){
  const plan=platformPlan(angle,back,side),r=angle*Math.PI/180,s=Math.sin(r),c=Math.cos(r);
  for(const [x,z] of plan.outline){
   assert.ok(z>=back-1e-6,`back gap at ${angle}°`);
   assert.ok(-s*(x-96)+c*z>=side-1e-6&&s*(x+96)+c*z>=side-1e-6,`side gap at ${angle}°`);
   assert.ok(z<=96+1e-6,'front edge stays on the 8′ floor line');
  }
  assert.ok(plan.deckArea>0);
 }
});
test('Platform modules tile the outline and none is larger than a half sheet',()=>{
 for(const angle of [0,45,90]){const plan=platformPlan(angle,12,12);
  assert.ok(Math.abs(plan.modules.reduce((s,m)=>s+m.area,0)/144-plan.deckArea)<1e-6);
  const outline=Math.abs(plan.outline.reduce((s,p,i)=>{const q=plan.outline[(i+1)%plan.outline.length];return s+p[0]*q[1]-q[0]*p[1]},0))/2/144;
  assert.ok(Math.abs(outline-plan.deckArea)<1e-6);
  for(const m of plan.modules){assert.ok(m.depth<=PLATFORM.module+1e-6);assert.ok(m.legs.length>=3);assert.equal(m.rims.length,m.edges.length);}
 }
});
test('Platform framing uses actual 2×4 sizes and a 10″ finished height',()=>{
 assert.equal(PLATFORM.lumber.join('×'),'1.5×3.5');
 assert.ok(Math.abs(legLength+PLATFORM.deck-10)<1e-9);assert.ok(Math.abs(sillLegLength+PLATFORM.sill+PLATFORM.deck-10)<1e-9);
 const plan=platformPlan(45,12,12);for(const l of plan.lumberLengths)assert.ok(l>0&&l<=96,`cut ${l} fits a 96″ stud`);
 assert.equal(platformCuts(plan).reduce((s,c)=>s+c.qty,0),plan.lumberLengths.length);
 assert.equal(studCount([48,48]),2);assert.equal(studCount([47.875,47.875]),1);
});
test('Flush gaps drop the fascia on the wall side; a 90° flush platform is four by two full modules',()=>{
 const plan=platformPlan(90,0,0);assert.equal(plan.counts.modules,8);assert.equal(plan.counts.fullModules,8);
 assert.equal(Math.round(plan.fasciaLength),192,'only the open front is skinned; both wings and the back wall hide the other sides');
 assert.equal(Math.round(platformPlan(90,12,12).fasciaLength),2*168+2*84);
});
test('Platform pricing follows angle and gaps, uses observed prices only, and replaces the floor rows',()=>{
 const rows=priceRows(data,{scope:'set',height:96,angle:45,floor:'platform'}),ids=rows.map(r=>r.id);
 for(const id of ['laminate','floorPly','trim','floorFixings'])assert.ok(!ids.includes(id),id);
 for(const id of ['platformLumber','platformDeck','platformFrameScrews','platformDeckScrews','platformSkin','platformCompound','platformPrimer','platformPaint'])assert.ok(ids.includes(id),id);
 const platform=platformRows(data,45);assert.ok(platform.every(r=>Number.isInteger(r.subtotalCents)&&r.purchaseQuantity>0&&r.productUrl.startsWith('https://www.homedepot.com/')));
 const total=a=>summary(platformRows(data,a,12,12)).subtotal;assert.ok(total(0)>total(45)&&total(45)>total(90));
 assert.ok(summary(platformRows(data,45,48,48)).subtotal<summary(platformRows(data,45,0,0)).subtotal);
 assert.equal(platformRows(data,45).find(r=>r.id==='platformLumber').unitPriceCents,data.products.find(p=>p.id==='crossbar').unitPriceCents);
});
test('Platform angle turns the sides in independently but never opens wider than the walls',()=>{
 const square=platformPlan(45,12,12,90);assert.equal(square.platformAngle,90);
 for(const [x,z] of square.outline){assert.ok(Math.abs(Math.abs(x)-84)<1e-6||Math.abs(z-12)<1e-6||Math.abs(z-96)<1e-6,`square corner ${x},${z}`);}
 assert.ok(Math.abs(square.deckArea-168*84/144)<1e-6);
 assert.equal(platformPlan(45,12,12,30).platformAngle,45,'clamped to the wall angle');
 assert.deepEqual(platformPlan(45,12,12,30).outline,platformPlan(45,12,12).outline);
 for(const pa of [45,60,75,90]){const plan=platformPlan(45,12,12,pa),s=Math.sin(Math.PI/4),c=Math.cos(Math.PI/4);for(const [x,z] of plan.outline)assert.ok(-s*(x-96)+c*z>=12-1e-6&&s*(x+96)+c*z>=12-1e-6,`keeps the gap from the real wings at ${pa}°`);}
 assert.ok(summary(platformRows(data,45,12,12,90)).subtotal<summary(platformRows(data,45,12,12,45)).subtotal);
 assert.equal(priceRows(data,{scope:'floor',height:96,angle:45,floor:'platform',platformAngle:90}).find(r=>r.id==='platformDeck').purchaseQuantity,platformPlan(45,12,12,90).deckSheets);
});
