import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {priceRows,materialTax,summary,pricingBudget} from '../public/pricing-calc.js';
import {normalizeCustom,customizeRows,consolidatePacks} from '../public/pricing-config.js';
import {cycloramaPlan} from '../public/cyclorama.js';
import {projectMaterials} from '../public/projection.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/flat-shopping-list.json',import.meta.url)));
const base={scope:'set',height:120,angle:90,floor:'charcoal',platformShape:'square',platformAngle:90,platformBack:12,platformSide:12};
test('Configured painted sets have priced retrofit materials from allowed stores, no fixed design or order minimum',()=>{
 for(const height of [96,120])for(const angle of [0,45,90])for(const platformShape of ['none','angled','square'])for(const seamlessCorners of [false,true])for(const seamlessPerimeter of [false,true]){
  const d={...base,height,angle,platformShape,seamlessCorners,seamlessPerimeter},p=cycloramaPlan(d),rows=priceRows(data,d);assert.deepEqual(rows.filter(r=>r.subtotalCents===null).map(r=>r.id),p.corners&&height===120?['cycRibScrews']:[],'only the unchecked 3½″ rib screw box may be pending');
  for(const row of rows)assert.match(new URL(row.productUrl).hostname,/(^|\.)(homedepot|lowes)\.com$/);
  const skin=rows.find(r=>r.id==='cycSkin');if(skin){assert.equal(skin.purchaseQuantity,p.skinSheets);assert.equal(skin.unitPriceCents,data.products.find(p=>p.id==='skin').unitPriceCents);assert.equal(skin.productUrl,data.products.find(p=>p.id==='skin').productUrl);}else assert.equal(p.skinSheets,0);
  assert.equal(rows.some(r=>r.id==='cycReinforcement'),!!(p.corners&&p.perimeter));assert.equal(rows.some(r=>r.id==='cycAdhesive'),!!p.ribCount);
  assert.equal(pricingBudget(data,{...d,excluded:[],customItems:[]},null).totalCents,summary(rows).subtotal+materialTax(rows));
 }
});
test('Lauan cut layouts fit physical sheets and do not overlap',()=>{
 for(const height of [96,120])for(const angle of [1,30,45,75,90])for(const seamlessPerimeter of [false,true]){
  const p=cycloramaPlan({...base,height,angle,seamlessCorners:true,seamlessPerimeter}),cuts=p.skinLayout.pieces;
  for(const a of cuts){assert.ok(a.x>=0&&a.y>=0&&a.x+a.width<=48+1e-8&&a.y+a.height<=96+1e-8);for(const b of cuts){if(a===b||a.sheet!==b.sheet)continue;assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,'overlapping cuts');}}
  const area=cuts.filter(c=>c.kind==='corner').reduce((n,c)=>n+c.width*c.height,0),sk=p.cornerSkin;assert.ok(area>=p.corners*p.cornerArc*(sk.rows.at(-1).top-sk.rows[0].bottom)-1e-6,'corner skin covers the curve from its base to the wall top');
 }
});
test('Hardware rounds shared packs once, and exclusions recalculate allocations',()=>{
 const r=(id,n)=>({id,productUrl:'https://www.homedepot.com/p/204275496',needed:n,packSize:100,purchaseQuantity:1,unitPriceCents:797,subtotalCents:797,availability:'Test'}),rows=consolidatePacks([r('lapScrews',60),r('cycSkinScrews',20)]);
 assert.deepEqual(rows.map(r=>r.purchaseQuantity),[1,0]);assert.equal(summary(rows).subtotal,797);
 assert.equal(customizeRows(rows,{excluded:['lapScrews'],customItems:[]})[0].purchaseQuantity,1);
 assert.deepEqual(consolidatePacks(rows),rows,'repeated rendering must not grow notes or change totals');
});
test('Taxable custom costs persist; legacy tax-inclusive items are not taxed again',()=>{
 const raw={id:'custom-12345678-1234-1234-1234-123456789abc',title:'Supplies',quantity:2,unitPriceCents:10000,taxable:true},saved=normalizeCustom(raw),rows=customizeRows([],{excluded:[],customItems:[saved]});
 assert.equal(materialTax(rows),1400);assert.equal(materialTax(rows.map(r=>({...r,taxable:false}))),0);assert.throws(()=>normalizeCustom({...raw,taxable:'true'}));
 assert.equal(materialTax([{unitPriceCents:1000000,purchaseQuantity:2,subtotalCents:2000000}]),130000,'6% state plus county capped per item');
});
test('Receipts stay tax-inclusive and only remaining purchases receive estimated tax',()=>{
 const row={id:'supplies',custom:true,taxable:true,purchaseQuantity:2,unitPriceCents:10000,subtotalCents:20000};
 const p=projectMaterials([row],[{id:'e',amountCents:10700,items:[{materialId:'supplies',quantity:1,amountCents:10700,complete:false}]}]);
 assert.equal(p.spentCents,10700);assert.equal(p.remainingCents,10000);assert.equal(p.remainingTaxCents,700);assert.equal(p.projectedCents,21400);
});

test('Rib blank yields fit actual plywood and opposed quarter profiles do not overlap',()=>{
 for(const angle of [1,30,45,75,90]){const p=cycloramaPlan({...base,angle,seamlessCorners:true,seamlessPerimeter:true}),s=p.ribStock;const fit=([w,h])=>Math.max(Math.floor((47.938+.125)/(w+.125))*Math.floor((95.938+.125)/(h+.125)),Math.floor((47.938+.125)/(h+.125))*Math.floor((95.938+.125)/(w+.125)));assert.equal(s.verticalYield,fit(s.verticalBlank)*(s.paired?2:1));assert.equal(s.floorYield,fit(s.floorBlank)*2);assert.equal(s.compoundYield,fit(s.compoundBlank));}
 for(const radius of [24,36]){const k=.125;for(let x=0;x<=radius+k;x+=.25)for(let y=0;y<=radius+k;y+=.25){const a=x<=radius&&y<=radius&&Math.hypot(x,y-radius)>radius+1e-6,b=x>=k&&y>=k&&Math.hypot(x-radius-k,y-k)>radius+1e-6;assert.ok(!(a&&b),'nested quarter ribs overlap');}}
});

test('Matching finishing containers pool fractional use, while different paints remain separate',()=>{
 const r=(id,url,n)=>({id,productUrl:url,needed:n,sharedSupply:true,packSize:1,unitPriceCents:2398,purchaseQuantity:1,subtotalCents:2398,availability:'Source'});
 const rows=consolidatePacks([r('wallPrimer','https://www.homedepot.com/p/100096395',.4),r('platformPrimer','https://www.homedepot.com/p/100096395',.2),r('cycPrimer','https://www.homedepot.com/p/100096395',.3),r('otherPaint','https://www.homedepot.com/p/other',.2)]);
 assert.deepEqual(rows.map(r=>r.purchaseQuantity),[1,0,0,1]);assert.equal(summary(rows).subtotal,2*2398);
});
