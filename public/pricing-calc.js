import {calculate} from './shopping-calc.js';
import {platformPlan,PLATFORM} from './platform.js';
export const money=c=>c===null?'Price pending':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
export function floorArea(angle){const c=Math.cos(angle*Math.PI/180),s=Math.sin(angle*Math.PI/180);return 128+128*c-64*c*s;}
function extra(id,name,qty,price,url,note,group='floor'){return {id,name,purchaseQuantity:qty,unitPriceCents:price,subtotalCents:price===null||qty===null?null:price*qty,productUrl:url.startsWith('http')?url:'https://www.homedepot.com/p/'+url,availability:note,group,needed:qty,packSize:1};}
export function floorRows(data,angle,type){const area=floorArea(angle),waste=area*1.1,rows=[];
 if(type==='wood'){
 rows.push(extra('laminate','TrafficMaster Gladstone Oak · 24.24 sq ft case',Math.ceil(waste/24.24),2399,'203315038','Observed Oct 5 at #6319 · out of stock'));
 rows.push(extra('underlay','TrafficMaster 100 sq ft standard underlayment',Math.ceil(waste/100),3900,'327262533','30 rolls in stock · check substrate and manufacturer requirements'));
 rows.push(extra('vapor','Substrate-dependent vapor barrier',null,null,'https://www.homedepot.com/s/laminate%20vapor%20barrier','Required on applicable substrates; selection and quantity pending'));
 }else{
 rows.push(extra('floorPly','23/32 in plywood · two layers · 4×8 sheet',2*Math.ceil(waste/32),null,'100000837','Two layers, each with 10% area waste; offset joints both ways. Verify actual cut yield'));
 rows.push(extra('floorPrimer','Cement-skim-compatible floor primer · selection pending',null,null,'https://www.homedepot.com/s/concrete%20floor%20primer','Select with floor paint; paint-only SKIM FLOOR finish is an unverified scenic compromise'));
 rows.push(extra('floorPaint','BEHR Mined Coal porch & patio paint · gallon',Math.ceil(area*2/300),null,'302055336','Two-coat planning allowance at 300 sq ft/gallon; compatibility over selected skim/primer unverified. No epoxy or polyurethane; touch-ups expected'));
 rows.push(extra('floorSeams','Rapid Set SKIM FLOOR · full-surface cement skim',null,null,'313474246',`Plan ${Math.ceil(area*1.1/134)} × 20-lb equivalents at 1/16 inch including 10% allowance. Manufacturer TDS says 20 lb; retail listing says 35 lb—verify pack yield and price before buying`));
 rows.push(extra('floorGlue','Full-spread plywood laminating adhesive',null,null,'https://www.homedepot.com/s/plywood%20wood%20glue',`Bond ${area.toFixed(1)} sq ft between layers; select spread rate and pack quantity. Separate from wall glue`));
 rows.push(extra('floorLayerScrews','Plywood layer screws · pack selection pending',null,null,'https://www.homedepot.com/s/wood%20screws%201%201%2F4','Clamp upper layer to lower; select fastening schedule and screws that do not protrude through combined thickness'));
 }
 rows.push(extra('trim','Wall-mounted shoe trim · 8 ft lengths',5,null,'https://www.homedepot.com/s/wood%20shoe%20moulding','32 ft along walls + 10% cutting allowance; trim profile pending'));
 rows.push(extra('floorFixings','Floor / trim fixing supplies',null,null,'https://www.homedepot.com/s/flooring%20installation%20supplies','Venue-approved attachment and pack selection pending'));
 return rows;
}
// 10″ platform: every quantity comes from the module plan for this angle and these wall gaps.
export function platformRows(data,angle,back=PLATFORM.gap,side=PLATFORM.gap,platformAngle=angle){
 const plan=platformPlan(angle,back,side,platformAngle),own=id=>data.platform.products.find(p=>p.id===id),shared=id=>data.products.find(p=>p.id===id);
 const row=(id,src,name,needed,qty,note)=>({id,name,purchaseQuantity:qty,unitPriceCents:src.unitPriceCents,subtotalCents:qty*src.unitPriceCents,productUrl:src.productUrl,availability:note+' · '+src.availability,group:'platform',needed,packSize:1,observedStock:src.observedStock??null});
 const pack=(id,src,name,needed,note)=>({...row(id,src,name,needed,Math.ceil(needed/src.packSize),note),packSize:src.packSize});
 const rows=[],deckSheets=plan.deckSheets,strips=plan.fasciaStrips,finish=plan.finishArea;
 rows.push(row('platformLumber',shared('crossbar'),'2×4×96 in stud · platform rims, joists, legs and sills',plan.lumberLengths.length,plan.studs,`${plan.lumberLengths.length} cuts packed into ${plan.studs} studs with ⅛″ kerf; choose straight stock`));
 rows.push(row('platformDeck',own('platformDeck'),own('platformDeck').name,deckSheets,deckSheets,`${plan.decks.length} larger deck pieces over ${plan.counts.modules} frames (${plan.deckArea.toFixed(1)} sq ft), nested on ${deckSheets} sheets with saw kerf`));
 rows.push(pack('platformFrameScrews',own('platformFrameScrews'),own('platformFrameScrews').name,plan.frameScrews,'Build guide: 2 per rim joint, 2 per joist end, 4 per leg, 2 per sill, 2 per sill-supported leg; plus module seams'));
 rows.push(pack('platformDeckScrews',shared('barScrews'),'SPAX #8×2½ in flat-head wood screws · deck to frame · 133 box',plan.deckScrews,'Remove decks before separating frames · 6″ around each deck perimeter, 12″ on interior rims and joists'));
 rows.push(row('platformSkin',shared('skin'),'1/8 in × 4×8 ft lauan utility plywood · 10″ fascia strips',plan.fasciaSheets,plan.fasciaSheets,`${(plan.fasciaLength/12).toFixed(1)} ft of fascia: ${plan.fasciaPieces.length} fitted pieces cut from ${strips} stock strips, 4 per sheet`));
 rows.push(pack('platformStaples',shared('staples'),'Grip-Rite ½ in narrow-crown staples · fascia · 1,000 box',plan.staples,'Fascia to rims, sills and legs at about 4″'));
 rows.push(row('platformGlue',shared('glue'),'Titebond III wood glue · fascia · 16 oz bottle',Math.max(1,Math.ceil(plan.fasciaLength/720)),Math.max(1,Math.ceil(plan.fasciaLength/720)),'Planning allowance: one bottle per 60 ft of fascia'));
 const pads=Math.max(1,Math.ceil(plan.padArea*1.15/216));rows.push(row('platformPads',shared('pads'),'⅛ in neoprene sheet · leg and sill pads',pads,pads,`${plan.counts.fullLegs} leg pads + sill pads every 24″, cut from 6×36 in sheets`));
 const tape=own('platformTape'),bead=own('platformBead'),compound=Math.ceil((finish-plan.deckArea)/60),primer=Math.ceil((finish-plan.deckArea)/300),paint=Math.ceil(finish*2/300);
 rows.push(row('platformTape',tape,tape.name,Math.ceil((plan.tapeLength-plan.deckSeamLength)*1.1/tape.lengthInches),Math.ceil((plan.tapeLength-plan.deckSeamLength)*1.1/tape.lengthInches),`${((plan.tapeLength-plan.deckSeamLength)/12).toFixed(0)} ft of vertical fascia joints + 10%; no drywall tape on deck`));
 rows.push(row('platformBead',bead,bead.name,Math.ceil(plan.fasciaCorners*PLATFORM.height*1.1/bead.lengthInches),Math.ceil(plan.fasciaCorners*PLATFORM.height*1.1/bead.lengthInches),`${(plan.fasciaCorners*PLATFORM.height/12).toFixed(0)} ft of vertical fascia corners + 10%`));
 rows.push(row('platformCompound',own('platformCompound'),own('platformCompound').name+' · vertical fascia only',compound,compound,`Scenic fascia only: ${(finish-plan.deckArea).toFixed(0)} sq ft at 60 sq ft/bag; not for the walking surface`));
 rows.push(row('platformPrimer',own('platformPrimer'),own('platformPrimer').name,primer,primer,`Fascia only: ${(finish-plan.deckArea).toFixed(0)} sq ft, one coat at 300 sq ft/gallon`));
 rows.push(extra('platformDeckSkim','Rapid Set SKIM FLOOR · platform walking surface',null,null,'313474246',`Plan ${Math.ceil(plan.deckArea*1.1/134)} × 20-lb equivalents at 1/16 inch + 10%; verify retail pack size, yield and price`,'platform'));
 rows.push(extra('platformDeckPrimer','Cement-compatible deck primer · selection pending',null,null,'https://www.homedepot.com/s/concrete%20floor%20primer','Same primer selection as painted floor; paint-only cement skim wear system unverified','platform'));
 rows.push(row('platformPaint',own('platformPaint'),own('platformPaint').name,paint,paint,`Two coats over ${finish.toFixed(0)} sq ft, planned at 300 sq ft/gallon`));
 return rows.filter(r=>r.purchaseQuantity!==0);
}
// floor: 'none' | 'wood' | 'charcoal'; platformShape: 'none' | 'angled' | 'square'. Floor:'platform' is the older
// spelling of a platform with no floor under it.
export function priceRows(data,{scope,height,angle,floor,platformShape='none',supports=true,ballast=true,finishes=true,platformBack=PLATFORM.gap,platformSide=PLATFORM.gap,platformAngle=angle}){
 if(floor==='platform'){floor='none';if(platformShape==='none')platformShape='angled';}if(platformShape==='square')platformAngle=90;
 const key=height===120?'10x4':'8x4',n=scope==='panel'?1:8;let rows=scope==='floor'?[]:calculate(data,key,n,supports,ballast);
 if(scope!=='floor'&&finishes){const area=n*4*height/12;
 rows.push(extra('wallPrimer','Wood-compatible wall primer · gallon',Math.ceil(area/250),null,'https://www.homedepot.com/s/wood%20primer','Planning allowance at 250 sq ft/gallon; product and local price pending','finish'));
 const paint=data.wallPaint;rows.push(extra('wallPaint',paint.name,Math.ceil(area*2/paint.coverageSqFtPerGallon),paint.unitPriceCents,paint.productUrl,paint.availability,'finish'));
 rows.push(extra('wallSeams','Scenic wall seam fabric and filler',null,null,'https://www.homedepot.com/s/paintable%20seam%20tape','Finish system / quantity pending; do not bridge moving corners rigidly','finish'));}
 if(scope==='set'){
 const p=data.products.find(p=>p.id==='lapScrews'),existing=rows.find(r=>r.id==='lapScrews'),needed=5*(height===120?5:4);
 if(existing){existing.needed+=needed;existing.purchaseQuantity=Math.ceil(existing.needed/p.packSize);existing.subtotalCents=existing.purchaseQuantity*p.unitPriceCents;}else rows.push({...p,needed,purchaseQuantity:Math.ceil(needed/p.packSize),subtotalCents:Math.ceil(needed/p.packSize)*p.unitPriceCents});
 rows.push(extra('corners','Two screw-fixed wing-corner connection assemblies',2,null,'https://www.homedepot.com/s/wood%20corner%20brace','Screw-fixed corner detail and quantities need scenic-shop review; no threaded through-fasteners specified','connections'));
 }
 if(scope!=='panel'){if(floor!=='none')rows.push(...floorRows(data,angle,floor));if(platformShape!=='none')rows.push(...platformRows(data,angle,platformBack,platformSide,platformAngle));}
 if(height===120&&scope!=='floor'&&supports&&ballast)rows.push(extra('tallBallast','10′ panel ballast and retention supplies',null,null,'https://www.homedepot.com/p/301980932','Ballast mass and retention design pending','ballast'));
 return rows;
}
export function summary(rows){return {subtotal:rows.reduce((s,r)=>s+(r.subtotalCents??0),0),pending:rows.filter(r=>r.subtotalCents===null).length};}
export function exportList(rows,title){return `${title}\nHome Depot #6319 · 5475 University Pkwy · before tax/delivery\n\n`+rows.map(r=>`${r.purchaseQuantity??'TBD'} × ${r.name}\nUnit: ${money(r.unitPriceCents)} | Line: ${money(r.subtotalCents)}\n${r.availability}\n${r.productUrl}`).join('\n\n');}
