import {calculate} from './shopping-calc.js';
export const money=c=>c===null?'Price pending':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
export function floorArea(angle){const c=Math.cos(angle*Math.PI/180),s=Math.sin(angle*Math.PI/180);return 128+128*c-64*c*s;}
function extra(id,name,qty,price,url,note,group='floor'){return {id,name,purchaseQuantity:qty,unitPriceCents:price,subtotalCents:price===null||qty===null?null:price*qty,productUrl:url.startsWith('http')?url:'https://www.homedepot.com/p/'+url,availability:note,group,needed:qty,packSize:1};}
export function floorRows(data,angle,type){const area=floorArea(angle),waste=area*1.1,rows=[];
 if(type==='wood'){
 rows.push(extra('laminate','TrafficMaster Gladstone Oak · 24.24 sq ft case',Math.ceil(waste/24.24),2399,'203315038','Observed Oct 5 at #6319 · out of stock'));
 rows.push(extra('underlay','TrafficMaster 100 sq ft standard underlayment',Math.ceil(waste/100),3900,'327262533','30 rolls in stock · check substrate and manufacturer requirements'));
 rows.push(extra('vapor','Substrate-dependent vapor barrier',null,null,'https://www.homedepot.com/s/laminate%20vapor%20barrier','Required on applicable substrates; selection and quantity pending'));
 }else{
 rows.push(extra('floorPly','23/32 in sanded plywood · 4×8 sheet',Math.ceil(waste/32),null,'100000837','Area allowance with 10% waste; verify sheet layout before cutting'));
 rows.push(extra('floorPrimer','BEHR No. 436 wood-compatible primer · gallon',Math.ceil(area/250),null,'https://www.homedepot.com/s/BEHR%2043601','Planning at 250 sq ft/gallon; verify selected product coverage'));
 rows.push(extra('floorPaint','BEHR Mined Coal porch & patio paint · gallon',Math.ceil(area*2/300),null,'302055336','Two coats at 300 sq ft/gallon on smooth surfaces; local price unavailable'));
 rows.push(extra('floorSeams','Compatible plywood seam repair / stabilization',null,null,'https://www.homedepot.com/s/wood%20floor%20repair','Venue and coating-compatible seam treatment needs selection'));
 }
 rows.push(extra('trim','Wall-mounted shoe trim · 8 ft lengths',5,null,'https://www.homedepot.com/s/wood%20shoe%20moulding','32 ft along walls + 10% cutting allowance; trim profile pending'));
 rows.push(extra('floorFixings','Floor / trim fixing supplies',null,null,'https://www.homedepot.com/s/flooring%20installation%20supplies','Venue-approved attachment and pack selection pending'));
 return rows;
}
export function priceRows(data,{scope,height,angle,floor,supports=true,ballast=true,finishes=true}){
 const key=height===120?'10x4':'8x4',n=scope==='panel'?1:8;let rows=scope==='floor'?[]:calculate(data,key,n,supports,ballast);
 if(scope!=='floor'&&finishes){const area=n*4*height/12;
 rows.push(extra('wallPrimer','Wood-compatible wall primer · gallon',Math.ceil(area/250),null,'https://www.homedepot.com/s/wood%20primer','Planning allowance at 250 sq ft/gallon; product and local price pending','finish'));
 rows.push(extra('wallPaint','Charcoal interior wall paint · gallon',Math.ceil(area*2/350),null,'https://www.homedepot.com/s/charcoal%20interior%20paint','Two-coat planning allowance at 350 sq ft/gallon; color and price pending','finish'));
 rows.push(extra('wallSeams','Scenic wall seam fabric and filler',null,null,'https://www.homedepot.com/s/paintable%20seam%20tape','Finish system / quantity pending; do not bridge moving corners rigidly','finish'));}
 if(scope==='set'){
 const p=data.products.find(p=>p.id==='lapScrews'),existing=rows.find(r=>r.id==='lapScrews'),needed=6*(height===120?5:4);
 if(existing){existing.needed+=needed;existing.purchaseQuantity=Math.ceil(existing.needed/p.packSize);existing.subtotalCents=existing.purchaseQuantity*p.unitPriceCents;}else rows.push({...p,needed,purchaseQuantity:Math.ceil(needed/p.packSize),subtotalCents:Math.ceil(needed/p.packSize)*p.unitPriceCents});
 rows.push(extra('corners','Two wing-corner connection assemblies',2,null,'https://www.homedepot.com/s/gate%20hinge%20hardware','Corner connector detail remains unselected; no load rating inferred','connections'));
 }
 if(scope!=='panel')rows.push(...floorRows(data,angle,floor));
 if(height===120&&scope!=='floor'&&supports&&ballast)rows.push(extra('tallBallast','10′ panel ballast and retention supplies',null,null,'https://www.homedepot.com/p/301980932','Ballast mass and retention design pending','ballast'));
 return rows;
}
export function summary(rows){return {subtotal:rows.reduce((s,r)=>s+(r.subtotalCents??0),0),pending:rows.filter(r=>r.subtotalCents===null).length};}
export function exportList(rows,title){return `${title}\nHome Depot #6319 · 5475 University Pkwy · before tax/delivery\n\n`+rows.map(r=>`${r.purchaseQuantity??'TBD'} × ${r.name}\nUnit: ${money(r.unitPriceCents)} | Line: ${money(r.subtotalCents)}\n${r.availability}\n${r.productUrl}`).join('\n\n');}
