import {money} from './pricing-calc.js';

const ORDER_STATUSES=new Set(['ship-to-store','delivery-only','unavailable']);

export function remainingOrderQuantity(row,purchase){
 if(purchase?.status==='bought')return 0;
 const quantity=purchase?.remainingQuantity??row?.purchaseQuantity;
 return typeof quantity==='number'&&Number.isFinite(quantity)?quantity:null;
}

export function needsOrder(row,purchase){
 return remainingOrderQuantity(row,purchase)>0&&ORDER_STATUSES.has(row?.fulfillment?.pickupStatus);
}

function optionLine(label,option={}){
 const cents=option.costCents;
 const cost=cents===0?'Free':Number.isInteger(cents)&&cents>0?money(cents):'Cost not verified';
 const arrival=typeof option.eta==='string'&&option.eta.trim()?`${label==='Delivery'?'ETA ':''}${option.eta.trim()}`:'Arrival not verified';
 return {label,text:`${label}: ${cost} · ${arrival}`};
}

export function fulfillmentLines(row,purchase){
 if(!needsOrder(row,purchase))return [];
 const fulfillment=row.fulfillment||{},status=fulfillment.pickupStatus,lines=[];
 if(fulfillment.shipToStore)lines.push(optionLine('Ship to store',fulfillment.shipToStore));
 if(fulfillment.delivery)lines.push(optionLine('Delivery',fulfillment.delivery));
 if(!lines.length&&status==='ship-to-store')lines.push(optionLine('Ship to store'));
 if(!lines.length&&status==='unavailable')lines.push(optionLine('Order'));
 if(!lines.length&&status==='delivery-only')lines.push(optionLine('Delivery'));
 return lines.map(line=>({...line,checkedDate:fulfillment.checkedDate||null}));
}

// Per-item offers are not a combined cart quote. A free viable route is sufficient;
// paid or unknown shipping remains explicitly outside the material total until quoted.
export function shippingQuoteNeeded(rows,purchases=[]){const byId=new Map(purchases.map(p=>[p.row.id,p]));return rows.filter(r=>{const p=byId.get(r.id);if(!needsOrder(r,p))return false;const f=r.fulfillment||{};return ![f.shipToStore,f.delivery].some(o=>o?.costCents===0);}).length;}

export function pickupUnverified(row,purchase){return remainingOrderQuantity(row,purchase)>0&&row?.fulfillment?.pickupStatus==='unknown';}

export function unverifiedRetailCount(rows,purchases=[]){
 const byId=new Map(purchases.map(p=>[p.row.id,p]));
 return new Set(rows.filter(r=>remainingOrderQuantity(r,byId.get(r.id))>0&&(r.priceVerification==='historical'||pickupUnverified(r,byId.get(r.id)))).map(r=>r.productUrl||r.id)).size;
}

export function retailDescription(row,purchase){
 return [row.availability||row.description||'',needsOrder(row,purchase)?'Need to order':'',...fulfillmentLines(row,purchase).map(l=>l.text)].filter(Boolean).join(' · ');
}
