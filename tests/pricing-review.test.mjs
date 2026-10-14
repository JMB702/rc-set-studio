import test from 'node:test';import assert from 'node:assert/strict';
import {reviewTotals,costCategory,estimateCsv} from '../public/pricing-review.js';
const rows=[{id:'board14',name:'Lumber',subtotalCents:10000,purchaseQuantity:2,unitPriceCents:5000},{id:'floorPly',name:'Plywood',subtotalCents:null,purchaseQuantity:4,unitPriceCents:null},{id:'custom-1',custom:true,name:'Labor',subtotalCents:2500,purchaseQuantity:1,unitPriceCents:2500}];
test('Category totals reconcile exactly and preserve unknown costs',()=>{const r=reviewTotals(rows);assert.equal(r.total,12500);assert.equal(r.groups.reduce((n,g)=>n+g.total,0),r.total);assert.equal(r.pending,1);assert.equal(r.groups.find(g=>g.name==='Sheet goods').priced,0);assert.equal(r.priced,2);assert.equal(costCategory(rows[2]),'Additional costs');});
test('Removed and added amounts reconcile to the current known subtotal',()=>{const baseline=[rows[0],rows[1],{id:'retired-item',subtotalCents:397}];const r=reviewTotals(rows,baseline);assert.equal(r.removedKnown,397);assert.equal(r.added,2500);assert.equal(10397-r.removedKnown+r.added,r.total);});
test('CSV keeps missing prices empty, includes sources, and neutralizes formulas',()=>{const csv=estimateCsv([...rows,{id:'custom-2',custom:true,name:'=HYPERLINK("bad")',purchaseQuantity:1,unitPriceCents:0,subtotalCents:0,productUrl:'https://example.com'}],'45° estimate');assert.ok(csv.includes('"Sheet goods","Plywood",4,,,"Pending"'));assert.ok(csv.includes('"\'=HYPERLINK'));assert.ok(csv.includes('https://example.com'));assert.ok(csv.includes('"Priced subtotal",125'));});

test('CSV includes order cost and arrival evidence without adding delivery to material totals',()=>{
 const csv=estimateCsv([{id:'pads',name:'Pads',purchaseQuantity:3,unitPriceCents:601,subtotalCents:1803,fulfillment:{pickupStatus:'ship-to-store',shipToStore:{costCents:0,eta:'Oct 19–22, 2026'},delivery:{costCents:null,eta:null}}}],'Example');
 assert.match(csv,/Need to order/);assert.match(csv,/Ship to store: Free · Oct 19–22, 2026/);assert.match(csv,/Delivery: Cost not verified · Arrival not verified/);assert.match(csv,/"Priced subtotal",18.03/);
});
