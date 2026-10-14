import test from 'node:test';
import assert from 'node:assert/strict';
import {needsOrder,remainingOrderQuantity,fulfillmentLines,shippingQuoteNeeded,pickupUnverified} from '../public/availability.js';

const row=(pickupStatus='ship-to-store',purchaseQuantity=2,extra={})=>({purchaseQuantity,fulfillment:{pickupStatus,checkedDate:'2026-10-14',...extra}});

test('Unknown, limited, nearby and in-stock pickup do not imply an order is needed',()=>{
 for(const status of ['unknown','limited','nearby','in-stock'])assert.equal(needsOrder(row(status),null),false,status);
});

test('An order badge requires positive remaining quantity and an explicit shipping status',()=>{
 assert.equal(needsOrder(row(),null),true);
 assert.equal(needsOrder(row('delivery-only'),null),true);
 assert.equal(needsOrder(row('unavailable'),null),true);
 assert.equal(needsOrder(row('ship-to-store',0),null),false);
 assert.equal(needsOrder(row('ship-to-store',null),null),false);
 assert.equal(needsOrder(row(),{status:'partial',remainingQuantity:1}),true);
 assert.equal(remainingOrderQuantity(row(),{status:'partial',remainingQuantity:0}),0);
 assert.equal(needsOrder(row(),{status:'partial',remainingQuantity:0}),false);
 assert.equal(needsOrder(row(),{status:'bought',remainingQuantity:2}),false);
 assert.equal(remainingOrderQuantity(row(),{status:'bought',remainingQuantity:2}),0);
});

test('Shipping details distinguish free, paid and unverified cost and arrival',()=>{
 const lines=fulfillmentLines(row('ship-to-store',1,{shipToStore:{costCents:0,eta:'Oct 19–22'}}),null);
 assert.deepEqual(lines,[{label:'Ship to store',text:'Ship to store: Free · Oct 19–22',checkedDate:'2026-10-14'}]);
 assert.deepEqual(fulfillmentLines(row('delivery-only',1,{delivery:{costCents:699,eta:null}}),null),[
  {label:'Delivery',text:'Delivery: $6.99 · Arrival not verified',checkedDate:'2026-10-14'}
 ]);
 assert.deepEqual(fulfillmentLines(row('ship-to-store',1,{shipToStore:{costCents:null,eta:null}}),null),[
  {label:'Ship to store',text:'Ship to store: Cost not verified · Arrival not verified',checkedDate:'2026-10-14'}
 ]);
});

test('Bought rows have no shipping lines and shipping never creates a total fee',()=>{
 const item=row('ship-to-store',3,{shipToStore:{costCents:1200,eta:'Oct 19–22'},delivery:{costCents:1800,eta:'Oct 21'}});
 assert.deepEqual(fulfillmentLines(item,{status:'bought',remainingQuantity:0}),[]);
 assert.deepEqual(fulfillmentLines(item,{status:'partial',remainingQuantity:1}).map(x=>x.text),[
  'Ship to store: $12.00 · Oct 19–22','Delivery: $18.00 · ETA Oct 21'
 ]);
});

test('Partial purchases use only the remaining quantity for order and shipping checks',()=>{
 const item=row('ship-to-store',5,{shipToStore:{costCents:null,eta:null}});
 const partial={status:'partial',remainingQuantity:2,row:{id:'item'}};
 assert.equal(remainingOrderQuantity(item,partial),2);
 assert.equal(needsOrder(item,partial),true);
 assert.equal(pickupUnverified(row('unknown',5),partial),true);
 assert.equal(shippingQuoteNeeded([{...item,id:'item'}],[partial]),1);
 const complete={status:'bought',remainingQuantity:0,row:{id:'item'}};
 assert.equal(needsOrder(item,complete),false);
 assert.equal(shippingQuoteNeeded([{...item,id:'item'}],[complete]),0);
});

test('Unknown pickup remains unverified and requires a shipping quote until a free route is known',()=>{
 const unknown=row('unknown',2,{delivery:{costCents:null,eta:null}});
 assert.equal(pickupUnverified(unknown,null),true);
 assert.equal(needsOrder(unknown,null),false);
 assert.deepEqual(fulfillmentLines(unknown,null),[]);
 const orderOnly=row('ship-to-store',2,{delivery:{costCents:null,eta:null}});
 assert.deepEqual(fulfillmentLines(orderOnly,null).map(line=>line.text),[
  'Delivery: Cost not verified · Arrival not verified'
 ]);
 assert.equal(shippingQuoteNeeded([{...orderOnly,id:'unknown'}]),1);
 orderOnly.fulfillment.shipToStore={costCents:0,eta:'Oct 19–21'};
 assert.equal(shippingQuoteNeeded([{...orderOnly,id:'unknown'}]),0);
});

test('Zero remaining quantity is not marked as needing pickup verification',()=>{
 const item=row('unknown',3);
 assert.equal(pickupUnverified(item,{status:'partial',remainingQuantity:0}),false);
 assert.equal(pickupUnverified(item,{status:'bought',remainingQuantity:3}),false);
});

test('Historical allowances are counted once per product, excluding bought and spare-only rows',async()=>{
 const {unverifiedRetailCount}=await import('../public/availability.js');
 const rows=[{id:'floor',productUrl:'https://example.test/skim',purchaseQuantity:1,priceVerification:'historical'},{id:'deck',productUrl:'https://example.test/skim',purchaseQuantity:1,priceVerification:'historical'}];
 assert.equal(unverifiedRetailCount(rows),1);
 assert.equal(unverifiedRetailCount(rows,rows.map(r=>({row:r,status:'bought',remainingQuantity:0}))),0);
 assert.equal(unverifiedRetailCount([{...rows[0],purchaseQuantity:0}]),0);
});
