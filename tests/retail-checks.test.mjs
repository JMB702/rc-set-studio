import test from 'node:test';
import assert from 'node:assert/strict';
import {applyRetailChecks} from '../public/pricing-calc.js';
import {consolidatePacks} from '../public/pricing-config.js';

test('Retail lookup uses the nine-digit product ID in both Home Depot URL forms',()=>{
 const data={retailChecks:{
  '123456789':{priceCents:456,checkedDate:'verified-date',store:'verified-store',pickupNote:'pickup',deliveryNote:'delivery',stock:7,fulfillment:{pickupStatus:'in-stock'}}
 }};
 const rows=[
  {id:'short',productUrl:'https://www.homedepot.com/p/123456789',availability:'old note',unitPriceCents:100,subtotalCents:200,purchaseQuantity:2},
  {id:'long',productUrl:'https://www.homedepot.com/p/product-slug/123456789?color=blue',availability:'old note',unitPriceCents:100,subtotalCents:200,purchaseQuantity:2},
  {id:'other',productUrl:'https://www.homedepot.com/p/987654321',availability:'keep this',unitPriceCents:100,subtotalCents:200,purchaseQuantity:2}
 ];
 const checked=applyRetailChecks(data,rows);
 for(const row of checked.slice(0,2)){
  assert.equal(row.unitPriceCents,456);
  assert.equal(row.subtotalCents,912);
  assert.equal(row.checkedDate,'verified-date');
  assert.equal(row.observedStock,7);
  assert.equal(row.fulfillment,data.retailChecks['123456789'].fulfillment);
 }
 assert.equal(checked[2].unitPriceCents,100);
 assert.equal(checked[2].availability,'keep this');
});

test('Unknown retail price preserves the previous price and never turns unknown fulfillment into free stock',()=>{
 const fulfillment={pickupStatus:'unknown',delivery:{costCents:null,eta:null}};
 const row={id:'pending',productUrl:'https://www.homedepot.com/p/123456789',availability:'earlier price basis',unitPriceCents:789,subtotalCents:1578,purchaseQuantity:2};
 const [checked]=applyRetailChecks({retailChecks:{'123456789':{priceCents:null,lastAttemptDate:'attempt-date',fulfillment}}},[row]);
 assert.equal(checked.unitPriceCents,789);
 assert.equal(checked.subtotalCents,1578);
 assert.equal(checked.fulfillment,fulfillment);
 assert.match(checked.availability,/earlier price basis/);
 assert.match(checked.availability,/not verified/);
 assert.doesNotMatch(checked.availability,/\bFree\b|in stock/i);
});

test('Retail price updates are applied before identical SKU packs are pooled',()=>{
 const check={priceCents:325,checkedDate:'verified-date',store:'verified-store',pickupNote:'pickup',deliveryNote:'delivery',fulfillment:{pickupStatus:'in-stock'}};
 const rows=[
  {id:'first-use',productUrl:'https://www.homedepot.com/p/123456789',packSize:50,needed:20,sharedSupply:true,unitPriceCents:999,subtotalCents:999,availability:'first'},
  {id:'second-use',productUrl:'https://www.homedepot.com/p/123456789',packSize:50,needed:20,sharedSupply:true,unitPriceCents:999,subtotalCents:999,availability:'second'}
 ];
 const pooled=consolidatePacks(applyRetailChecks({retailChecks:{'123456789':check}},rows));
 assert.deepEqual(pooled.map(row=>row.purchaseQuantity),[1,0]);
 assert.deepEqual(pooled.map(row=>row.subtotalCents),[325,0]);
 assert.deepEqual(pooled.map(row=>row.unitPriceCents),[325,325]);
 assert.equal(pooled[0].availability.includes('Shared packs across first-use, second-use'),true);
 assert.equal(pooled[1].availability.includes('this row adds 0 pack(s)'),true);
});

test('User-approved provisional budget scales with bags and yields to a verified quote',async()=>{
 const {materialTax}=await import('../public/pricing-calc.js');
 const check={priceCents:null,provisionalUnitPriceCents:4673,provisionalBudgetPerPackCents:5000,provisionalNote:'Provisional budget; quote pending',lastAttemptDate:'2026-10-14',fulfillment:{pickupStatus:'unknown'}};
 const rows=['floor','deck'].map(id=>({id,productUrl:'https://www.homedepot.com/p/313474246',purchaseQuantity:1,unitPriceCents:3897,subtotalCents:3897}));
 const provisional=applyRetailChecks({retailChecks:{'313474246':check}},rows);
 assert.equal(provisional.reduce((n,r)=>n+r.subtotalCents,0)+materialTax(provisional),10000);
 assert.ok(provisional.every(r=>r.priceVerification==='provisional'&&r.checkedDate===null));
 const one=applyRetailChecks({retailChecks:{'313474246':check}},rows.slice(0,1));
 assert.equal(one[0].subtotalCents+materialTax(one),5000);
 const quoted=applyRetailChecks({retailChecks:{'313474246':{...check,priceCents:4000,checkedDate:'2026-10-15',store:'E Bradenton'}}},rows);
 assert.ok(quoted.every(r=>r.unitPriceCents===4000&&r.priceVerification==='observed'));
});
