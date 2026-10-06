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
