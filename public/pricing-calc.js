import {customizeRows,consolidatePacks} from './pricing-config.js';
import {calculate} from './shopping-calc.js';
import {floorPlan} from './floor-plan.js';
import {platformPlan,PLATFORM} from './platform.js';
import {cycloramaPlan,cycloramaCornerSides} from './cyclorama.js';
export const money=c=>c===null?'Price pending':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
export function floorArea(angle){const c=Math.cos(angle*Math.PI/180),s=Math.sin(angle*Math.PI/180);return 128+128*c-64*c*s;}
function extra(id,name,qty,price,url,note,group='floor'){return {id,name,purchaseQuantity:qty,unitPriceCents:price,subtotalCents:price===null||qty===null?null:price*qty,productUrl:url.startsWith('http')?url:'https://www.homedepot.com/p/'+url,availability:note,group,needed:qty,packSize:1};}
// Rapid Set SKIM FLOOR: the data sheet gives about 134 sq ft at 1/16 inch per 20 lb; the 35 lb retail bag scales to ~234.
const SKIM_SQFT_PER_BAG=234;
// Prices observed for Home Depot #6319 (5475 University Pkwy) on Oct 10, 2026, with that store selected.
function stocked(row,stock){return {...row,observedStock:stock};}
// Retail checks are sourced snapshots; lack of a check must never become an in-stock claim.
export function applyRetailChecks(data,rows){return rows.map(row=>{const sku=row.productUrl?.match(/\/p\/(?:[^/]+\/)?(\d{9})(?:[/?#]|$)/)?.[1],check=data.retailChecks?.[sku];if(!check)return row;if(check.priceCents==null){
 const provisional=Number.isInteger(check.provisionalUnitPriceCents)&&check.provisionalUnitPriceCents>=0,price=provisional?check.provisionalUnitPriceCents:row.unitPriceCents;
 return {...row,unitPriceCents:price,subtotalCents:price!=null&&row.purchaseQuantity!=null?price*row.purchaseQuantity:row.subtotalCents,priceVerification:provisional?'provisional':'historical',provisionalBudgetPerPackCents:provisional?check.provisionalBudgetPerPackCents:null,checkedDate:provisional?null:check.priorPriceDate??row.checkedDate??null,observedStock:null,fulfillment:check.fulfillment,availability:[row.availability||'',provisional?check.provisionalNote:'',`Current price, pickup, shipping cost and ETA not verified on ${check.lastAttemptDate}; ${provisional?'provisional budget allowance used':'earlier price basis retained'}.`].filter(Boolean).join(' · ')};
 }
 const planning=(row.unallocatedAvailability??row.availability??'').split(' · ').filter(s=>! /^(?:Checked|Observed|checked|Catalog checked|Unavailable|out of stock|not stocked|ship to store|nearby pickup|\$.*online listing|\d[\d,]* (?:\w+ )?in stock)/i.test(s.trim())).join(' · ');
 return {...row,priceVerification:'observed',unitPriceCents:check.priceCents,subtotalCents:row.purchaseQuantity!=null?check.priceCents*row.purchaseQuantity:row.subtotalCents,checkedDate:check.checkedDate??row.checkedDate,observedStock:check.stock??null,fulfillment:check.fulfillment,availability:[`Checked ${check.checkedDate} at ${check.store} #${check.storeId||'6319'}. ${check.pickupNote||''} ${check.deliveryNote||''}`,check.productNote,planning].filter(Boolean).join(' · ')};
});}
export function floorRows(data,angle,type,cfg={}){const plan=type==='charcoal'?floorPlan(angle,cfg):null,area=floorArea(angle),waste=area*1.1,baseWaste=(plan?.baseArea??area)*1.1,rows=[];
 if(type==='wood'){
 rows.push(extra('laminate','TrafficMaster Gladstone Oak · 24.24 sq ft case',Math.ceil(waste/24.24),2399,'203315038','Observed Oct 5 at #6319 · out of stock'));
 rows.push(extra('underlay','TrafficMaster 100 sq ft standard underlayment',Math.ceil(waste/100),3900,'327262533','30 rolls in stock · check substrate and manufacturer requirements'));
 rows.push(extra('vapor','Substrate-dependent vapor barrier',null,null,'https://www.homedepot.com/s/laminate%20vapor%20barrier','Required on applicable substrates; selection and quantity pending'));
 }else{
 // Loose-laid on the concrete: a felt underlayment with attached vapor barrier keeps moisture out and adds grip.
 rows.push(extra('vapor','QuietWalk 1.4 mm felt underlayment with attached vapor barrier · 100 sq ft roll',Math.ceil(baseWaste/100),5175,'306837487',`Checked Oct 10 · ship to store #6319 · ${plan.baseArea.toFixed(1)} sq ft including any joining lip + 10% for overlaps; dense felt under the plywood, built-in tape strip at seams`));
 const sheets=plan.sheetCount;rows.push(stocked(extra('floorPly','Plytanium 23/32 in BC sanded pine plywood · two layers · 4×8 sheet',sheets,5288,'100061386',`Checked Oct 10 at #6319 · 18 in stock · ${plan.upper.pieces.length} top pieces, ${plan.lower.pieces.length} lower pieces, packed into ${sheets} sheets with ⅛″ kerf; ${plan.cutCount} planned edge cuts. No crosswise top seams; lower joints offset 24″${plan.lip?`; lower layer extends ${plan.lip}″ forward`:""}. No blanket waste uplift; measure actual sheets and gaps before cutting`),18));
 rows.push(stocked(extra('floorPrimer','BEHR PREMIUM Concrete & Masonry Bonding Primer · gallon',Math.ceil(area/250),2998,'100129649','Checked Oct 10 at #6319 · 19 in stock · one coat over the cured skim at 250 sq ft/gallon; paint-only SKIM FLOOR finish is an unverified scenic compromise'),19));
 rows.push(stocked(extra('floorPaint','BEHR PREMIUM Porch & Patio floor paint, low-lustre · tinted Carbon N520-7 · 1 gal',Math.ceil(area*2/300),3998,'206454767','Two coats at 300 sq ft/gallon. Same product and color as the platform paint and the same color code as the walls; buy floor and platform gallons together so they are tinted as one batch. No epoxy or polyurethane; touch-ups expected'),26));
 rows.push(extra('floorSeams','Rapid Set SKIM FLOOR · 35 lb bag · full-surface cement skim',Math.ceil(area*1.1/SKIM_SQFT_PER_BAG),3897,'313474246',`Checked Oct 10 · not stocked at #6319 (order online) · about ${SKIM_SQFT_PER_BAG} sq ft per 35 lb bag at 1/16 inch, scaled from the data sheet's 20 lb figure; 10% allowance`));
 rows.push(stocked(extra('floorGlue','Loctite PL 400 Subfloor construction adhesive · 28 oz',Math.ceil(area*2*1.1/86),898,'300751977',`Checked Oct 10 at #6319 · 204 in stock · ¼″ serpentine beads 6″ apart across ${area.toFixed(1)} sq ft between layers (~86 ft of bead per tube) + 10%. Separate from wall glue`),204));
 const screw=data.products.find(p=>p.id==='lapScrews');rows.push(stocked(extra('floorLayerScrews','Everbilt #8×1¼ in flat-head wood screws · plywood layers · 100 pack',Math.ceil(area*2.25*1.05/screw.packSize),797,'204275496','Checked Oct 10 at #6319 · 4 packs in stock · 8″ grid through the top layer; 1¼″ stays inside the 1 13/32″ combined thickness'),4));
 }
 const layer=rows.find(r=>r.id==='floorLayerScrews');if(layer){layer.needed=Math.ceil(area*2.25*1.05);layer.packSize=data.products.find(p=>p.id==='lapScrews').packSize;}
 return rows.map(r=>['floorPrimer','floorPaint','floorSeams','trim'].includes(r.id)?{...r,group:'floorFinish'}:r);
}
// 10″ platform: every quantity comes from the module plan for this angle and these wall gaps.
export function platformRows(data,angle,back=PLATFORM.gap,side=PLATFORM.gap,platformAngle=angle,configuration={}){
 const plan=platformPlan(angle,back,side,platformAngle,configuration),own=id=>data.platform.products.find(p=>p.id===id),shared=id=>data.products.find(p=>p.id===id);
 const row=(id,src,name,needed,qty,note)=>({id,name,purchaseQuantity:qty,unitPriceCents:src.unitPriceCents,subtotalCents:qty*src.unitPriceCents,productUrl:src.productUrl,availability:note+' · '+src.availability,group:'platform',needed,packSize:1,observedStock:src.observedStock??null});
 const pack=(id,src,name,needed,note)=>({...row(id,src,name,needed,Math.ceil(needed/src.packSize),note),packSize:src.packSize});
 const rows=[],deckSheets=plan.deckSheets,strips=plan.fasciaStrips,finish=plan.finishArea;
 rows.push(row('platformLumber',shared('crossbar'),'2×4×96 in stud · platform rims, bottom rims, joists and legs',plan.lumberLengths.length,plan.studs,`${plan.lumberLengths.length} cuts packed into ${plan.studs} studs with ⅛″ kerf; choose straight stock`));
 rows.push(row('platformDeck',own('platformDeck'),own('platformDeck').name,deckSheets,deckSheets,`${plan.decks.length} larger deck pieces over ${plan.counts.modules} frames (${plan.deckArea.toFixed(1)} sq ft), nested on ${deckSheets} sheets with saw kerf`));
 rows.push(pack('platformFrameScrews',own('platformFrameScrews'),own('platformFrameScrews').name,plan.frameScrews,'Build guide: 2 per rim joint (top and bottom rings), 2 per joist end, 4 per leg; plus module seams on both rings'));
 rows.push(pack('platformDeckScrews',shared('barScrews'),'SPAX #8×2½ in flat-head wood screws · deck to frame · 133 box',plan.deckScrews,'Remove decks before separating frames · 6″ around each deck perimeter, 12″ on interior rims and joists'));
 rows.push(row('platformSkin',shared('skin'),'1/8 in × 4×8 ft lauan utility plywood · 10″ fascia strips',plan.fasciaSheets,plan.fasciaSheets,`${(plan.fasciaLength/12).toFixed(1)} ft of fascia: ${plan.fasciaPieces.length} fitted pieces cut from ${strips} stock strips, 4 per sheet`));
 rows.push(pack('platformStaples',shared('staples'),'Grip-Rite ½ in narrow-crown staples · fascia · 1,000 box',plan.staples,'Fascia to top and bottom rims at about 4″'));
 rows.push(row('platformGlue',shared('glue'),'Titebond III wood glue · fascia · 16 oz bottle',Math.max(1,Math.ceil(plan.fasciaLength/720)),Math.max(1,Math.ceil(plan.fasciaLength/720)),'Planning allowance: one bottle per 60 ft of fascia'));
 const pads=Math.max(1,Math.ceil(plan.padArea*1.15/216));rows.push(row('platformPads',shared('pads'),'⅛ in neoprene sheet · leg and bottom-rim pads',pads,pads,`${plan.counts.legs} leg pads + bottom-rim pads every 24″, 1½×3½ in each, cut from 6×36 in sheets`));
 const tape=own('platformTape'),bead=own('platformBead'),compound=Math.ceil((finish-plan.deckArea)/150),primer=Math.ceil((finish-plan.deckArea)/300),paint=Math.ceil(finish*2/300);
 rows.push(row('platformTape',tape,tape.name,Math.ceil((plan.tapeLength-plan.deckSeamLength)*1.1/tape.lengthInches),Math.ceil((plan.tapeLength-plan.deckSeamLength)*1.1/tape.lengthInches),`${((plan.tapeLength-plan.deckSeamLength)/12).toFixed(0)} ft of vertical fascia joints + 10%; no drywall tape on deck`));
 rows.push(row('platformBead',bead,bead.name,Math.ceil(plan.fasciaCorners*PLATFORM.height*1.1/bead.lengthInches),Math.ceil(plan.fasciaCorners*PLATFORM.height*1.1/bead.lengthInches),`${(plan.fasciaCorners*PLATFORM.height/12).toFixed(0)} ft of vertical fascia corners + 10%`));
 rows.push(row('platformCompound',own('platformCompound'),own('platformCompound').name+' · vertical fascia only',compound,compound,`Scenic fascia only: ${(finish-plan.deckArea).toFixed(0)} sq ft; planning 150 sq ft per 4.5-gal premixed pail; not for the walking surface`));
 rows.push(row('platformPrimer',own('platformPrimer'),own('platformPrimer').name,primer,primer,`Fascia only: ${(finish-plan.deckArea).toFixed(0)} sq ft, one coat at 300 sq ft/gallon`));
 rows.push(extra('platformDeckSkim','Rapid Set SKIM FLOOR · 35 lb bag · platform walking surface',Math.ceil(plan.deckArea*1.1/SKIM_SQFT_PER_BAG),3897,'313474246',`Checked Oct 10 · not stocked at #6319 (order online) · ${plan.deckArea.toFixed(0)} sq ft + 10% at about ${SKIM_SQFT_PER_BAG} sq ft per bag, 1/16 inch`,'platform'));
 rows.push(stocked(extra('platformDeckPrimer','BEHR PREMIUM Concrete & Masonry Bonding Primer · deck · gallon',Math.ceil(plan.deckArea/250),2998,'100129649','Checked Oct 10 at #6319 · 19 in stock (shared with the floor) · one coat over the cured skim at 250 sq ft/gallon; paint-only wear system unverified','platform'),19));
 rows.push(row('platformPaint',own('platformPaint'),own('platformPaint').name,paint,paint,`Two coats over ${finish.toFixed(0)} sq ft, planned at 300 sq ft/gallon`));
 return rows.filter(r=>r.purchaseQuantity!==0).map(r=>['platformTape','platformBead','platformCompound','platformPrimer','platformDeckSkim','platformDeckPrimer','platformPaint'].includes(r.id)?{...r,group:'platformFinish'}:r);
}
// Retrofit quantities come from the same plan as geometry and the Build guide. Prices here reuse
// dated catalog observations; unknown sheet specifications and compatible adhesive remain pending.
export function cycloramaRows(data,d,{finishes=true}={}){
 const p=cycloramaPlan(d);if(!p.corners&&!p.perimeter)return [];const cyc=id=>data.cyclorama.products.find(p=>p.id===id);
 const shared=id=>data.products.find(r=>r.id===id),own=id=>data.platform.products.find(r=>r.id===id);
 const sourced=(id,src,name,needed,quantity,note,group='cyclorama')=>({...extra(id,name,quantity,src.unitPriceCents,src.productUrl,`${note} · Catalog checked ${src.checkedDate}: ${src.availability}`,group),needed,packSize:src.packSize||1});
 const pending=(id,name,quantity,note)=>extra(id,name,quantity,null,'https://www.homedepot.com/s/'+encodeURIComponent(name),note,'cyclorama');
 // SPAX anchors: floor-cove and junction ribs, plus corner ribs screwed from behind through a flat crossbar.
 // Corner ribs on the existing on-edge rails and toggles take the longer cycRibScrews.
 const anchors=(p.floorRibs+p.compoundRibs)*4+p.ribFlatScrews,skinScrews=Math.max(0,p.fasteners-p.ribCount*4),anchor=shared('barScrews'),skin=shared('lapScrews');
 const rows=[
  sourced('cycRibPly',cyc('cycRibPly'),cyc('cycRibPly').name,p.ribSheets,p.ribSheets,`${p.ribCount} ribs including ${p.compoundRibs} compound ribs; conservative stock envelopes, verify template nesting`),
  sourced('cycSkin',shared('skin'),'Wall-panel utility plywood · curved skins · ⅛ nominal / .106 actual · 4×8 sheet',p.skinSheets,p.skinSheets,`${p.skinLayout.sheets} sheets packed with grain fixed + ${p.goreSheets} gore/mockup sheets. Same product as the wall skins; split wide corner arcs into supported strips and perform the bend test first`),
  sourced('cycBacking',shared('crossbar'),'2×4×96 in stud · cyclorama backing and cleats',p.blockingFeet,Math.ceil(p.blockingFeet*1.1/8),`${p.blockingFeet.toFixed(1)} linear ft + 10%; locate existing framing and add rear blocking where needed; no fastening into facing alone`),
  sourced('cycAnchorScrews',anchor,'SPAX #8×2½ in screws · cyc ribs and backing · 133 box',anchors,Math.ceil(anchors/anchor.packSize),`${anchors} planning fasteners: ${p.ribFlatScrews?`${p.ribFlatScrews} from behind through the flat crossbars into corner rib edges (about 1⅝″ bite), `:''}four per floor-cove or junction rib; confirm cleat direction, timber penetration and existing frame locations before fixing`),
  sourced('cycSkinScrews',skin,'#8×1¼ in screws · flexible cyc skin · 100 pack',skinScrews,Math.ceil(skinScrews/skin.packSize),`${skinScrews} skin fasteners; pilot, keep every joint supported and check pull-through on the sample`),
  // Added wall crossbars match the panel's own toggles: 1×3 on 10′ flats, 1×2 on 8′; two 46½″ pieces per 8 ft board.
  ...(p.addedCrossbars?[(()=>{const board=shared(d.height===120?'board13':'board12');return sourced('cycCrossbars',board,`${board.name} · added wall crossbars behind the rounded corner`,p.addedCrossbars,Math.ceil(p.addedCrossbars/2),`${p.addedCrossbars} crossbars at 46½″ (${p.crossbarPanels} panels × ${p.addedCrossbarLevels.length}), laid flat against the skin, two per 8 ft board; same stock as the panel toggles so every corner rib lands on a crossbar`);})(),
   sourced('cycCrossbarScrews',shared('lapScrews'),'#8×1¼ in screws · added crossbars toe-screwed into the stiles',p.crossbarScrews,Math.ceil(p.crossbarScrews/shared('lapScrews').packSize),`${p.crossbarScrews} screws, two at each end; predrill at an angle from behind`),
   sourced('cycCrossbarStaples',shared('staples'),'18 ga ¼ in crown staples · skin to added crossbars',p.crossbarStaples,Math.ceil(p.crossbarStaples/shared('staples').packSize),`${p.crossbarStaples} staples, about one every 3″ through the existing face into each glued crossbar`),
   ...(p.ribBackScrews?[p.backScrew.length===3?sourced('cycRibScrews',own('platformFrameScrews'),'DECKMATE #9×3 in screws · corner ribs from behind the wall',p.ribBackScrews,Math.ceil(p.ribBackScrews/own('platformFrameScrews').packSize),`${p.ribBackScrews} screws for the ribs on the existing on-edge rails and toggles, two per wall per rib, through the 1×2 and skin into the rib edge (about 1⅜″ bite); predrill`)
    :{...extra('cycRibScrews','DECKMATE #9×3½ in star flat-head wood screws · 5 lb box, 280 pieces · corner ribs from behind the wall',1,null,'https://www.homedepot.com/p/306587948',`${p.ribBackScrews} screws for the ribs on the existing on-edge rails and toggles, two per wall per rib, through the 1×3 and skin into the rib edge (about ⅞″ bite); predrill. Price pending: Home Depot model 115974, not yet checked at #6319`,'cyclorama'),needed:p.ribBackScrews,packSize:280}]:[])]:[]),
  sourced('cycAdhesive',shared('glue'),'Titebond III · rib-to-plywood skin contacts · 16 oz',p.adhesiveBottles,p.adhesiveBottles,`${p.glueContactSqFt.toFixed(1)} sq ft tight bare-wood contact + 25%, manufacturer spread 250 sq ft/gallon. Clamp firmly; not for gluing to paint, concrete or bridging gaps`),
 ];
 if(p.perimeter&&d.floor!=='charcoal')rows.push(pending('cycTransition','Stable paintable cove-to-floor transition substrate',null,'Floor-dependent substrate, preparation, expansion joint and price pending inspection; do not bridge or fasten to floating laminate'));
 if(p.corners&&p.perimeter)rows.push(sourced('cycReinforcement',cyc('cycReinforcement'),cyc('cycReinforcement').name,Math.ceil(p.compoundRibs*p.floorRadius*Math.PI/2/12*1.25/250),Math.ceil(p.compoundRibs*p.floorRadius*Math.PI/2/12*1.25/250),'Gore seams plus 25%; cut reliefs and trial on the curved plywood mockup with premixed compound'));
 if(finishes){const tape=own('platformTape'),compound=own('platformCompound'),primer=own('platformPrimer'),paint=data.wallPaint;
  rows.push(sourced('cycTape',tape,'USG paper joint tape · cyclorama seams · 250 ft roll',p.tapeFeet,Math.ceil(p.tapeFeet*1.1/250),`${p.tapeFeet.toFixed(1)} ft + 10%; embed in thin wet compound on compatible supported seams`,'cycloramaFinish'));
  rows.push(sourced('cycCompound',compound,'USG premixed joint compound · cyclorama · 4.5 gal pail',p.compoundPails,p.compoundPails,'Planning thin skim and repeated fills, with extra allowance for compound corners; decorative non-walking cove only, no thick unsupported plaster bridge','cycloramaFinish'));
  rows.push(sourced('cycPrimer',primer,'KILZ 2 primer · cyclorama · gallon',Math.ceil(p.skinArea/250),Math.ceil(p.skinArea/250),'One coat, planning 250 sq ft/gallon; adhesion on selected flexible skin must be tested','cycloramaFinish'));
  rows.push(sourced('cycPaint',paint,'BEHR flat wall paint · cyclorama · gallon',Math.ceil(p.skinArea*2/paint.coverageSqFtPerGallon),Math.ceil(p.skinArea*2/paint.coverageSqFtPerGallon),'Two coats on decorative cove; allow drying and match wall color','cycloramaFinish'));
 }
 return rows.filter(r=>r.purchaseQuantity!==0);
}
// floor: 'none' | 'wood' | 'charcoal'; platformShape: 'none' | 'angled' | 'square'. Floor:'platform' is the older
// spelling of a platform with no floor under it.
export function priceRows(data,{scope,height,angle,floor,platformShape='none',supports=true,ballast=true,finishes=true,platformBack=PLATFORM.gap,platformSide=PLATFORM.gap,platformAngle=angle,platformFront=0,floorLip=false,seamlessCorners=false,seamlessCornerSide='both',seamlessPerimeter=false}){
 if(floor==='platform'){floor='none';if(platformShape==='none')platformShape='angled';}if(platformShape==='square')platformAngle=90;
 const key=height===120?'10x4':'8x4',n=scope==='panel'?1:8;let rows=scope==='floor'?[]:calculate(data,key,n,supports,ballast);
 if(scope!=='floor'&&finishes){const area=n*4*height/12;
 rows.push(stocked(extra('wallPrimer','KILZ 2 All Purpose primer · walls · gallon',Math.ceil(area/250),2398,'100096395','Checked Oct 10 at #6319 · 152 in stock · one coat at 250 sq ft/gallon','finish'),152));
 const paint=data.wallPaint;rows.push(extra('wallPaint',paint.name,Math.ceil(area*2/paint.coverageSqFtPerGallon),paint.unitPriceCents,paint.productUrl,paint.availability,'finish'));
 // Walls stay assembled: paper tape and premixed compound on every flat seam and the 8′ sheet joint on 10′ flats;
 // the two wing corners can move, so they get paintable caulk instead.
 const seamFt=(scope==='set'?5*height/12:0)+(height===120?n*4:0),own=id=>data.platform.products.find(p=>p.id===id);
 if(seamFt){const compound=own('platformCompound'),tape=own('platformTape'),bags=Math.max(1,Math.ceil(seamFt*10/12/150));
  rows.push(stocked(extra('wallSeams','USG Sheetrock All Purpose premixed compound · wall seams · 4.5 gal pail',bags,compound.unitPriceCents,compound.productUrl,`Checked Oct 12 at #6319 · 184 in stock · ${seamFt} ft of seams feathered about 10″ wide; planning 150 sq ft/pail for thin coats, not a manufacturer coverage rating`,'finish'),184));
  rows.push(stocked(extra('wallSeamTape','USG Sheetrock paper joint tape · wall seams · 250 ft roll',Math.ceil(seamFt*1.1/250),tape.unitPriceCents,tape.productUrl,`Checked Oct 12 at #6319 · 107 in stock · ${seamFt} ft of seams + 10%; embed paper in wet compound`,'finish'),107));}
 const sharpCorners=2-cycloramaCornerSides({angle,seamlessCorners,seamlessCornerSide}).length;
 if(scope==='set'&&sharpCorners)rows.push(stocked(extra('wallCornerCaulk','BEHR Multi-Purpose paintable siliconized acrylic caulk · 10.1 oz',Math.ceil(sharpCorners*height/12*1.1/25),548,'316993414',`Checked Oct 10 at #6319 · 282 in stock · ${sharpCorners===2?'the two wing corners':'the one sharp wing corner'}, about 25 ft of ¼″ bead per tube; flexible, not taped`,'finish'),282));}
 if(scope==='set'){
 const p=data.products.find(p=>p.id==='lapScrews'),existing=rows.find(r=>r.id==='lapScrews'),needed=5*(height===120?5:4);
 if(existing){existing.needed+=needed;existing.purchaseQuantity=Math.ceil(existing.needed/p.packSize);existing.subtotalCents=existing.purchaseQuantity*p.unitPriceCents;}else rows.push({...p,needed,purchaseQuantity:Math.ceil(needed/p.packSize),subtotalCents:Math.ceil(needed/p.packSize)*p.unitPriceCents});
 // Each wing corner: a 2×4 drop stood in the inside corner, screwed to both flats with the jack box's SPAX screws.
 const stud=data.products.find(p=>p.id==='crossbar');rows.push({...extra('corners','2×4×96 in stud · wing-corner drop',2,stud.unitPriceCents,stud.productUrl,`One per wing corner, screwed to both flats · ${stud.availability} · checked ${stud.checkedDate}`,'connections'),observedStock:stud.observedStock});
 const bar=rows.find(r=>r.id==='barScrews'),cornerScrews=16;if(bar){bar.needed+=cornerScrews;bar.purchaseQuantity=Math.ceil(bar.needed/bar.packSize);bar.subtotalCents=bar.purchaseQuantity*bar.unitPriceCents;}
 }
 if(scope!=='panel'){if(floor!=='none')rows.push(...floorRows(data,angle,floor,{floorLip}));if(platformShape!=='none')rows.push(...platformRows(data,angle,platformBack,platformSide,platformAngle,{platformFront,seamlessCorners,seamlessCornerSide,seamlessPerimeter}));}
 if(scope==='set')rows.push(...cycloramaRows(data,{height,angle,floor,seamlessCorners,seamlessCornerSide,seamlessPerimeter},{finishes}));
 // Pool identical consumable products by their measured use before rounding whole containers.
 // Paint colors are not pooled across different product URLs or wall/floor product families;
 // floor and platform share one tinted Porch & Patio product, so their gallons pool.
 const wallArea=n*4*height/12,seamFt=(scope==='set'?5*height/12:0)+(height===120?n*4:0),pl=platformShape==='none'?null:platformPlan(angle,platformBack,platformSide,platformAngle,{platformFront,seamlessCorners,seamlessCornerSide,seamlessPerimeter}),cy=cycloramaPlan({height,angle,seamlessCorners,seamlessCornerSide,seamlessPerimeter});
 const use={wallPrimer:wallArea/250,wallPaint:wallArea*2/data.wallPaint.coverageSqFtPerGallon,wallSeams:seamFt*10/12/150,wallSeamTape:seamFt*1.1,platformPrimer:pl?(pl.finishArea-pl.deckArea)/300:0,platformCompound:pl?(pl.finishArea-pl.deckArea)/150:0,platformTape:pl?(pl.tapeLength-pl.deckSeamLength)*1.1/12:0,floorPrimer:floorArea(angle)/250,floorPaint:floorArea(angle)*2/300,platformPaint:pl?pl.finishArea*2/300:0,platformDeckPrimer:pl?pl.deckArea/250:0,cycPrimer:cy.skinArea/250,cycPaint:cy.skinArea*2/data.wallPaint.coverageSqFtPerGallon,cycCompound:cy.skinArea/150+(cy.perimeter?cy.corners:0),cycTape:cy.tapeFeet*1.1};
 for(const row of rows)if(use[row.id]!==undefined){row.needed=use[row.id];row.packSize=['wallSeamTape','platformTape','cycTape'].includes(row.id)?250:1;row.sharedSupply=true;}
 return consolidatePacks(applyRetailChecks(data,rows));
}
export function summary(rows){return {subtotal:rows.reduce((s,r)=>s+(r.subtotalCents??0),0),pending:rows.filter(r=>r.subtotalCents===null).length};}

// Finance uses the same full-set estimate, regardless of which pricing scope is being viewed.
export function pricingBudget(data,configuration,labor){
 const rows=customizeRows(priceRows(data,{...configuration,scope:'set'}),configuration),totals=summary(rows),taxCents=materialTax(rows);
 return {taxCents,totalCents:totals.subtotal+taxCents+(labor?.costCents??0),materialsCents:totals.subtotal,laborCents:labor?.costCents??null,pending:totals.pending,unrated:labor?.unrated??0};
}

// Florida 6% + Manatee 1%; county surtax caps at $5,000 per tangible item.
// Custom entries retain historical tax-as-entered behavior unless explicitly marked taxable.
export function materialTax(rows){let state=0,county=0;for(const r of rows){if(r.custom&&r.taxable!==true)continue;const subtotal=r.subtotalCents??0;state+=subtotal;const q=r.purchaseQuantity,u=r.unitPriceCents;county+=Number.isFinite(q)&&q>=0&&Number.isFinite(u)&&Math.abs(q*u-subtotal)<1?Math.min(u,500000)*q:subtotal;}return Math.round(state*.06+county*.01);}
