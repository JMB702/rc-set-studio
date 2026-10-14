import {floorSurfaceHeight} from './floor-plan.js';
import {installCanvasTap,pricingIsolationAllowed,pricingPartOpaque} from './pricing-interaction.js';
import * as T from 'three';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {panel,floorMesh,platformParts,cycloramaMesh,dispose,inch,mats,splitSkinFaces} from './model.js';
import {platformPlan} from './platform.js';
import {cycloramaGaps} from './cyclorama.js';
import {money,priceRows,summary,pricingBudget,materialTax} from './pricing-calc.js';
import {dollarsToCents,normalizeCustom,normalizeConfiguration,customizeRows,removedPart} from './pricing-config.js';
import {estimateCsv} from './pricing-review.js';
import {laborFor,laborCrewLine,laborHoursLine,laborTaskList} from './labor.js';
import {projectCost,GROUP_LABELS} from './projection.js';
import {needsOrder,fulfillmentLines,shippingQuoteNeeded,pickupUnverified,unverifiedRetailCount,retailDescription} from './availability.js';
const $=s=>document.querySelector(s);
function ids(name,height){
 if(/stile/.test(name))return [height===120?'board16':'board14','glue'];
 if(/rail|Toggle/.test(name))return [height===120?'board13':'board12','glue'];
 if(/backer/.test(name))return ['board14','glue'];
 if(/lauan/.test(name))return ['skin','wallPrimer','wallPaint','wallSeams','wallSeamTape','wallCornerCaulk'];
 if(/Frame screw|Seam backer screw/.test(name))return ['frameScrews'];
 if(/Skin staple/.test(name))return ['staples'];
 if(/jack foot/.test(name))return ['board14','glue'];
 if(/diagonal/.test(name))return [height===120?'board14long':'board14','glue'];
 if(/jack upright/.test(name))return ['board14','glue'];
 if(/gusset/.test(name))return ['shelf','glue'];
 if(/Jack attachment screw/.test(name))return ['lapScrews'];
 if(/Diagonal lap screw/.test(name))return ['lapScrews'];
 if(/Gusset screw|Shelf screw/.test(name))return ['shortScrews'];
 if(/Crossbar fixing/.test(name))return ['barScrews'];
 if(/Shelf crossbar/.test(name))return ['crossbar'];
 if(/Ballast shelf/.test(name))return ['shelf'];
 if(/Ballast bag/.test(name))return ['bags','sand','tallBallast'];
 return [];
}
function pricedPanel(height,appearance=0){const root=panel(height,{appearance}),bins=new Map();
 const add=(o,g,matches,support)=>{const key=matches.join(',')+o.material.uuid+support+JSON.stringify(o.userData.progress||{});const bin=bins.get(key)||{ids:matches,material:o.material,support,progress:o.userData.progress?.kind==='wallSkin'?{...o.userData.progress,front:matches.includes('wallPaint')}:o.userData.progress,geometries:[]};bin.geometries.push(g);bins.set(key,bin);};
 for(const o of [...root.children]){if(!o.isMesh)continue;const matches=ids(o.name,height),support=o.userData.step>=13;
 if(/lauan/.test(o.name)){const faces=splitSkinFaces(o.geometry);add(o,faces.front,matches,support);add(o,faces.back,['skin'],support);}
 else add(o,o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(),matches,support);
 root.remove(o);o.geometry.dispose();}
 for(const bin of bins.values()){const g=mergeGeometries(bin.geometries,false);bin.geometries.forEach(g=>g.dispose());if(!g)continue;const m=new T.Mesh(g,bin.material.clone());m.userData.pricingIds=bin.ids;m.userData.support=bin.support;m.userData.progress=bin.progress;m.userData.baseColor=m.material.color.clone();m.userData.baseMap=m.material.map;m.name=bin.ids[0]||'Panel part';root.add(m);}
 return root;
}
// The platform's framing, deck and fascia, merged per material and tagged with the rows they price.
function pricedPlatform(plan){const root=new T.Group(),parts=platformParts(plan),bins=new Map();
 const finish=['platformTape','platformCompound','platformPrimer','platformPaint'],tag=name=>/deck/.test(name)?['platformDeck','platformDeckScrews','platformDeckSkim','platformDeckPrimer','platformPaint']:/fascia/.test(name)?['platformSkin','platformStaples','platformGlue','platformBead',...finish]:['platformLumber','platformFrameScrews'];
 for(const o of [...parts.children]){const ids=tag(o.name),key=ids[0]+JSON.stringify(o.userData.progress),bin=bins.get(key)||{ids,material:o.material,progress:o.userData.progress,deckId:o.userData.deckId,geometries:[]};bin.geometries.push(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone());bins.set(key,bin);o.geometry.dispose();}
 for(const bin of bins.values()){const g=mergeGeometries(bin.geometries,false);bin.geometries.forEach(x=>x.dispose());if(!g)continue;const m=new T.Mesh(g,bin.material.clone());m.userData.pricingIds=bin.ids;m.userData.baseColor=m.material.color.clone();m.userData.baseMap=m.material.map;m.name=bin.ids[0];m.userData.progress=bin.progress;m.userData.deckId=bin.deckId;m.castShadow=m.receiveShadow=true;root.add(m);}
 return root;}
export function installPricing(api){
 // The Pricing guide is the plan: what the set costs to build, materials and labor, item by item. Actual spending,
 // the quote and the projection live in Cost projection; only a Bought tag on purchased rows crosses over.
 const host=$('#pricing-controls'),baseMode=api.setMode,S=api.state,scope='set',excluded=[];
 let data,model,rows=[],selected=null,pricingCamera='front',customItems=[],restoring=false;
 const canIsolate=()=>pricingIsolationAllowed(S.mode,document.body.dataset.projectTab,api.constructionView?.completed===true);
 const canPick=()=>canIsolate()&&!api.constructionView?.completed&&!document.body.classList.contains('picking-comment');
 // Shared project records: finance is null while the burn-down PIN is locked.
 let finance=null,tracking=null;
 host.classList.add('compact-pricing');
 host.innerHTML=`<p class="price-design"><span id="price-design-line"></span><button type="button" class="link-button" id="price-design-edit">Edit in Explore ↗</button></p>
<div class="pj-sticky"><section id="price-estimate-card" aria-labelledby="price-estimate-title"><h3 id="price-estimate-title">Estimate</h3><dl id="price-estimate-rows" aria-live="polite"><div><dt>Loading prices…</dt></div></dl></section></div>
<section id="price-materials" aria-labelledby="price-materials-title"><div class="group-head"><h3 id="price-materials-title">Materials</h3><span id="price-materials-total"></span></div><div id="pricing-rows"></div>
<button id="price-add-open" type="button" aria-label="Add pricing item"><span aria-hidden="true">+</span> Add item</button><section id="price-add" hidden><div class="price-add-heading"><h3>Add a cost item</h3><button id="price-add-close" type="button" aria-label="Close add item">×</button></div><form id="price-add-form"><label for="price-title">Title *</label><input id="price-title" maxlength="160" required><label for="price-description">Description</label><textarea id="price-description" maxlength="2000"></textarea><label for="price-link">Link</label><input id="price-link" placeholder="https://…"><div class="price-form-pair"><div><label for="price-amount">Unit price ($)</label><input id="price-amount" inputmode="decimal" placeholder="0.00"></div><div><label for="price-quantity">Quantity</label><input id="price-quantity" type="number" min="1" max="10000" step="1" value="1"></div></div><label class="price-tax-choice"><input id="price-taxable" type="checkbox"> Add estimated sales tax (materials)</label><p class="hint">Leave unchecked if tax is already included or the cost is not taxable.</p><button type="submit">Add item</button><p id="price-add-status" role="status"></p></form></section></section>
<section id="price-labor" aria-labelledby="price-labor-title"><div class="group-head"><h3 id="price-labor-title">Labor</h3><span id="price-labor-total"></span></div><p class="price-labor-crew" id="price-labor-crew"></p><p class="price-labor-hours" id="price-labor-hours"></p><details class="price-group"><summary><span>Hours by stage</span><span class="price-group-total" id="price-labor-person-hours"></span></summary><ol class="price-labor-tasks" id="price-labor-tasks"></ol></details></section>
<div class="price-export"><button id="price-csv">Download spreadsheet (CSV)</button><button id="price-print">Print / save PDF</button></div>`;
 const q=s=>host.querySelector(s);
 const previewToggle=document.createElement('button');previewToggle.id='price-preview-toggle';previewToggle.type='button';previewToggle.textContent='Hide 3D preview';previewToggle.setAttribute('aria-expanded','true');document.querySelector('.viewport').append(previewToggle);previewToggle.onclick=()=>{const hidden=document.body.classList.toggle('price-preview-hidden');previewToggle.textContent=hidden?'Show 3D preview':'Hide 3D preview';previewToggle.setAttribute('aria-expanded',String(!hidden));if(!hidden)requestAnimationFrame(()=>requestAnimationFrame(()=>fit()));};
 const report=document.createElement('section');report.id='price-print-report';document.body.append(report);
 q('#price-design-edit').onclick=()=>api.setMode('finished');
 const designText=()=>[`${S.height/12}′ walls`,`${S.angle}° wings`,S.platformShape==='none'?'no platform':`${S.platformShape} platform`,S.floor==='none'?'no floor':S.floor==='wood'?'oak floor':'painted floor',...(S.floor==='charcoal'&&S.floorLip?['12″ front joining lip']:[]),...(S.seamlessCorners?['seamless corners']:[]),...(S.seamlessPerimeter?['seamless perimeter']:[]),...((S.seamlessCorners||S.seamlessPerimeter)&&S.platformShape!=='none'?[`platform gaps ${cycloramaGaps(S).back}″ back / ${cycloramaGaps(S).side}″ sides`]:[])].join(' · ');
 const groupOf=r=>r.custom?'custom':r.group||'other',groupOrder=Object.keys(GROUP_LABELS);
 function estimate(){const sub=summary(rows).subtotal,tax=materialTax(rows),labor=laborFor(S);return {sub,tax,materials:sub+tax,labor,total:sub+tax+(labor.costCents??0)};}
 // With burn-down unlocked the breakdown itemizes the projected total: what was paid and logged, plus the estimate for
 // what is left. Locked, there are no actuals, so it shows the plain estimate.
 function showReview(){if(!data)return;const e=estimate(),l=e.labor,p=api.projection(),shippingPending=shippingQuoteNeeded(rows,p?.materials.plan||[]),unverified=unverifiedRetailCount(rows,p?.materials.plan||[]),shippingNote=[shippingPending?`Shipping total not confirmed for ${shippingPending} order item(s).`:'',unverified?`${unverified} product(s) need a current price or fulfillment check; provisional or historical allowances remain in the estimate.`:''].filter(Boolean).join(' '),hrs=h=>`${Math.round(h*10)/10} hrs`;
  const row=(k,note,v,cls)=>{const div=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');if(cls)div.className=cls;dt.textContent=k;if(note){const small=document.createElement('small');small.textContent=note;dt.append(small);}dd.textContent=v;div.append(dt,dd);return div;};
  if(p){const m=p.materials,w=p.labor;q('#price-estimate-title').textContent='Projected cost';
   q('#price-estimate-rows').replaceChildren(row('Materials',`${money(m.spentCents)} bought + ${money(m.remainingCents+m.remainingTaxCents)} to buy`,money(m.spentCents+m.remainingCents+m.remainingTaxCents)),row('Labor',`${hrs(w.actualHours)} logged + ${hrs(w.remainingHours)} to go`,money(w.actualCents+w.remainingCents)),row('Projected total',[m.pending?`${m.pending} material items pending; excluded from total`:'',shippingNote].filter(Boolean).join(' '),money(p.projectedCents),'estimate-total'));
   q('#price-materials-total').textContent=money(m.spentCents+m.remainingCents+m.remainingTaxCents);
   q('#price-labor-total').textContent=money(w.actualCents+w.remainingCents);q('#price-labor-crew').textContent=laborCrewLine(l);
   q('#price-labor-hours').textContent=`Logged so far ${hrs(w.actualHours)} · ${money(w.actualCents)}  ·  Still to come ${hrs(w.remainingHours)} · ${money(w.remainingCents)}${l.dryingDays?` · allow ${l.dryingDays.min}–${l.dryingDays.max} additional drying days`:''}`;
   q('#price-labor-person-hours').textContent=hrs(w.projectedHours);
   q('#price-labor-tasks').replaceChildren(...w.tasks.map(t=>{const li=document.createElement('li'),name=document.createElement('span'),h=document.createElement('strong'),small=document.createElement('small');name.textContent=t.name;small.textContent=`estimate ${t.estimate} · logged ${Math.round(t.actual*10)/10} · left ${Math.round(t.remaining*10)/10}${t.id.startsWith('cyc')?' · '+(l.tasks.find(x=>x.id===t.id)?.note||''):''}`;name.append(small);h.textContent=`${Math.round(t.projected*10)/10} h`;li.append(name,h);return li;}),...(w.unassignedHours?[(()=>{const li=document.createElement('li'),name=document.createElement('span'),h=document.createElement('strong');name.textContent='Logged with no stage';h.textContent=`${Math.round(w.unassignedHours*10)/10} h`;li.append(name,h);return li;})()]:[]));
  }else{q('#price-estimate-title').textContent='Estimate';
   q('#price-estimate-rows').replaceChildren(row('Materials',`${money(e.sub)} + ${money(e.tax)} est. sales tax`,money(e.materials)),row('Labor',`${Math.round(l.personHours*10)/10} person-hours`,l.costCents==null?'Not priced':money(l.costCents)),row('Total estimate',[summary(rows).pending?`${summary(rows).pending} material items pending; excluded from total`:'Unlock Cost projection to include what has been spent',shippingNote].filter(Boolean).join(' '),money(e.total),'estimate-total'));
   q('#price-materials-total').textContent=`${money(e.sub)} + tax`;
   q('#price-labor-total').textContent=l.costCents==null?'Not priced':money(l.costCents);q('#price-labor-crew').textContent=laborCrewLine(l);q('#price-labor-hours').textContent=laborHoursLine(l);q('#price-labor-person-hours').textContent=`${Math.round(l.personHours*10)/10} h`;q('#price-labor-tasks').replaceChildren(...laborTaskList(l));}
  window.dispatchEvent(new CustomEvent('pricing-reviewed',{detail:{scope,materialsCents:e.sub,taxCents:e.tax,priced:rows.filter(r=>r.subtotalCents!==null).length,pending:rows.filter(r=>r.subtotalCents===null).length}}));
 }
 function purchaseNote(status){if(!status||status.status==='remaining')return '';const sub=status.substitute?' · substitute':'';
  if(status.status==='bought')return `Bought${sub}`;
  return `Partly bought${status.boughtQuantity!==null?` · ${status.boughtQuantity} of ${status.row.purchaseQuantity??'?'}`:''}${sub}`;}
 function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 q('#price-csv').onclick=()=>download(estimateCsv(rows,designText(),laborFor(S)),`rc-estimate-${S.angle}deg.csv`,'text/csv;charset=utf-8');
 q('#price-print').onclick=()=>{report.replaceChildren();const e=estimate(),h=document.createElement('h1'),sub=document.createElement('p'),total=document.createElement('h2'),terms=document.createElement('p');h.textContent='RC Set — Cost estimate';sub.textContent=designText();total.textContent=`Total estimate: ${money(e.total)} (materials ${money(e.materials)} incl. est. tax${e.labor.costCents==null?'; labor not priced':` + labor ${money(e.labor.costCents)}`})`;terms.textContent=`USD including estimated material tax; delivery excluded. Dated supplier observations appear with each item; historical allowances may remain. Shipping offers are estimates, not a combined checkout quote. ${summary(rows).pending} material items pending and excluded. ${laborHoursLine(e.labor)}.`;report.append(h,sub,total,terms);
  const table=document.createElement('table'),head=document.createElement('tr');for(const text of ['Item','Buy','Unit price','Line total']){const th=document.createElement('th');th.textContent=text;head.append(th)}const thead=document.createElement('thead');thead.append(head);table.append(thead);const tbody=document.createElement('tbody');for(const r of rows){const tr=document.createElement('tr');for(const text of [r.name+' / '+(GROUP_LABELS[groupOf(r)]||'Other')+' — '+retailDescription(r),r.purchaseQuantity??'TBD',money(r.unitPriceCents),money(r.subtotalCents)]){const td=document.createElement('td');td.textContent=text;tr.append(td)}tbody.append(tr);}table.append(tbody);report.append(table);window.print();};

 function clear(){dispose(model);model=null;}
 function create(){clear();model=new T.Group();model.name='Pricing materials';api.scene.add(model);
  const h=S.height,a=S.angle*Math.PI/180;
  if(scope==='panel'){const p=pricedPanel(h);p.position.x=-24*inch;model.add(p);}else{
   const back=new T.Group(),left=new T.Group(),right=new T.Group();back.position.x=left.position.x=-96*inch;right.position.x=96*inch;left.rotation.y=a;right.rotation.y=-a;model.add(back,left,right);
   for(let i=0;i<4;i++){const p=pricedPanel(h,i);p.position.x=i*48*inch;p.userData.progressPanel=i;back.add(p);}for(let i=0;i<2;i++){const l=pricedPanel(h,5-i),r=pricedPanel(h,6+i);l.position.x=-(i+1)*48*inch;r.position.x=i*48*inch;l.userData.progressPanel=4+i;r.userData.progressPanel=6+i;left.add(l);right.add(r);}
   if(S.floor!=='none'){const f=floorMesh(S.angle,S.floor,99,S);f.traverse(o=>{if(o.isMesh){o.userData.pricingIds=o.userData.floorPriceIds||(o.userData.progress?.rawOnly?['floorPly','vapor']:['laminate','underlay','vapor','floorPly','floorPrimer','floorPaint','floorSeams','floorGlue','floorLayerScrews','floorFixings']);o.userData.baseColor=o.material.color.clone();o.userData.baseMap=o.material.map;}});model.add(f);}
   if(S.seamlessCorners||S.seamlessPerimeter){const cyc=cycloramaMesh(S,{construction:true});cyc.traverse(o=>{if(o.isMesh){const kind=o.userData.pricingIds?.[0]||'cycSkin';o.userData.pricingIds=kind==='cycRibPly'?['cycRibPly','cycAnchorScrews']:kind==='cycBacking'?['cycBacking','cycAnchorScrews']:['cycSkin','cycSkinScrews','cycAdhesive','cycTape','cycReinforcement','cycCompound','cycPrimer','cycPaint'];o.userData.baseColor=o.material.color.clone();o.userData.baseMap=o.material.map;}});model.add(cyc);}
   if(S.platformShape!=='none'){const p=pricedPlatform(platformPlan(S.angle,S.platformBack,S.platformSide,S.platformAngle,S));p.position.y=floorSurfaceHeight(S)*inch;model.add(p);}
  }
  apply();api.invalidate();
 }
 function apply(){if(!canIsolate())selected=null;if(!model)return;if(S.mode==='pricing')$('#view-hint').textContent=canPick()?'Select a price item · drag to orbit':'Drag to orbit';const available=new Set(rows.map(r=>r.id));model.traverse(o=>{if(!o.isMesh)return;
  const tags=o.userData.pricingIds||[];o.visible=!removedPart(tags,S.floor,excluded);const hit=pricingPartOpaque(tags,available,selected,api.constructionView?.completed===true);
  const m=o.material;const wall=tags.includes('wallPaint'),floorSurface=tags.includes('laminate'),seamed=wall&&['wallSeams','wallSeamTape','wallCornerCaulk'].includes(selected),painted=wall&&!seamed&&available.has('wallPaint')&&selected!=='skin',primed=wall&&!seamed&&available.has('wallPrimer')&&!painted&&selected!=='skin',rawFloor=floorSurface&&S.floor==='charcoal'&&!available.has('floorPaint'),primedFloor=rawFloor&&available.has('floorPrimer');const plat=tags.includes('platformPaint')&&!['platformDeck','platformSkin'].includes(selected),platSkim=plat&&['platformDeckSkim','platformCompound'].includes(selected),platPainted=plat&&!platSkim&&available.has('platformPaint')&&!['platformPrimer','platformDeckPrimer'].includes(selected),platPrimed=plat&&!platSkim&&!platPainted&&(available.has('platformPrimer')||available.has('platformDeckPrimer'));o.userData.wallFinishPreview=seamed?'seams':undefined;const map=painted||primed||primedFloor||platPainted||platPrimed?null:(platSkim?mats.compound.map:seamed?(S.height===120?mats.wallSeams10:mats.wallSeams8).map:wall?mats.wallRaw.map:rawFloor?mats.ply.map:o.userData.baseMap);if(m.map!==map){m.map=map;m.needsUpdate=true;}if(m.transparent!==!hit)m.needsUpdate=true;m.transparent=!hit;m.opacity=hit?1:.075;m.depthWrite=hit;m.color.copy(platSkim?new T.Color('#ddddcf'):primed||primedFloor||platPrimed||painted&&selected==='wallPrimer'?new T.Color(0xe3e0d8):platPainted?mats.platform.color:painted?mats.charcoal.color:rawFloor?mats.ply.color:floorSurface&&S.floor==='charcoal'?mats.floorGray.color:o.userData.baseColor);o.renderOrder=hit?2:0;o.castShadow=hit;o.receiveShadow=hit;
 });
 host.querySelectorAll('[data-price-item]').forEach(b=>{const on=b.dataset.priceItem===selected;b.setAttribute('aria-pressed',on);b.closest('.price-item').classList.toggle('selected',on)});
 api.invalidate();}
 function fit(v=pricingCamera){pricingCamera=v==='reset'?'front':v;api.view(pricingCamera);}
 function itemRow(r,purchase,lineCents=r.subtotalCents){const article=document.createElement('article');article.className='price-item';if(purchase)article.dataset.purchase=purchase.status;
  const content=document.createElement('div');content.className='price-item-inner';const button=document.createElement('button');button.type='button';button.dataset.priceItem=r.id;button.setAttribute('aria-pressed','false');const name=document.createElement('strong'),cost=document.createElement('span');name.textContent=r.name;cost.textContent=money(lineCents);button.append(name,cost);
  const detail=document.createElement('p');detail.className='price-line-math';const qty=purchase?.status==='partial'&&purchase.remainingQuantity!=null?purchase.remainingQuantity:r.purchaseQuantity;detail.textContent=r.subtotalCents===null?`${r.purchaseQuantity===null?'Quantity pending':r.purchaseQuantity} · ${r.unitPriceCents===null?'price pending':money(r.unitPriceCents)+' each'}`:`${qty}${purchase?.status==='partial'?' left':''} ${r.packSize>1?(qty===1?'pack':'packs'):''} × ${money(r.unitPriceCents)}`.replace('  ',' ');
  const note=document.createElement('small');note.className='price-row-note';note.textContent=(r.packSize>1?`${r.needed} needed, ${r.packSize} per pack. `:'')+(r.availability||'');
  button.onclick=()=>{if(r.custom||!canIsolate())return;selected=selected===r.id?null:r.id;apply();};
  const details=document.createElement('button');details.className='price-line-details';details.type='button';details.textContent='Details';details.setAttribute('aria-expanded','false');details.onclick=()=>{const open=article.classList.toggle('show-details');details.setAttribute('aria-expanded',open);details.textContent=open?'Less':'Details';};
  // Two lines: name and price; then quantity × unit, status tags and Details. Cut needs and links open below.
  const meta=document.createElement('div');meta.className='price-item-meta';meta.append(detail);const bought=purchaseNote(purchase);if(bought){const tag=document.createElement('small');tag.className='price-purchase';tag.dataset.status=purchase.status;tag.textContent=bought;meta.append(tag);}if(needsOrder(r,purchase)){const tag=document.createElement('small');tag.className='price-order-needed';tag.textContent='Need to order';meta.append(tag);}else if(pickupUnverified(r,purchase)){const tag=document.createElement('small');tag.className='price-pickup-unknown';tag.textContent='Pickup not verified';meta.append(tag);}if(r.priceVerification==='provisional'){const tag=document.createElement('small');tag.className='price-order-needed';tag.textContent='Provisional estimate';meta.append(tag);}meta.append(details);
  const shipping=document.createElement('div');shipping.className='price-fulfillment';for(const line of fulfillmentLines(r,purchase)){const item=document.createElement('small');item.textContent=line.text;if(line.checkedDate)item.title=`Availability checked ${line.checkedDate}`;shipping.append(item);}
  const more=document.createElement('div');more.className='price-item-more';more.append(note);
  if(r.productUrl){const a=document.createElement('a');a.textContent=r.custom?'View link ↗':new URL(r.productUrl).hostname.endsWith('lowes.com')?'Lowe’s ↗':'Home Depot ↗';a.href=r.productUrl;a.target='_blank';a.rel='noopener';more.append(a);}
  if(r.custom){const remove=document.createElement('button');remove.type='button';remove.className='price-remove-custom';remove.textContent='Remove item';remove.onclick=()=>{customItems=customItems.filter(i=>i.id!==r.id);render(false);};more.append(remove);}
  content.append(button,meta);if(shipping.childElementCount)content.append(shipping);content.append(more);article.append(content);return article;}
 const openGroups=new Set();
 function render(rebuild=true){if(!data)return;
  rows=customizeRows(priceRows(data,{scope,height:S.height,angle:S.angle,floor:S.floor,platformShape:S.platformShape,platformBack:S.platformBack,platformSide:S.platformSide,platformAngle:S.platformAngle,floorLip:S.floorLip===true,seamlessCorners:S.seamlessCorners,seamlessPerimeter:S.seamlessPerimeter,supports:true,ballast:true,finishes:true}),{excluded,customItems});
  if(!rows.some(r=>r.id===selected))selected=null;
  q('#price-design-line').textContent=designText();
  const projection=api.projection(),purchases=new Map(projection?.materials.plan.map(p=>[p.row.id,p])||[]),groups=new Map(),toBuy=projection?rows.filter(r=>purchases.get(r.id)?.status!=='bought'):rows;
  const lineCost=r=>projection?purchases.get(r.id)?.remainingCents??r.subtotalCents:r.subtotalCents,sum=items=>items.reduce((n,r)=>n+(lineCost(r)??0),0);
  for(const r of toBuy){const g=groupOf(r);if(!groups.has(g))groups.set(g,[]);groups.get(g).push(r);}
  const group=(key,title,count,total,children)=>{const box=document.createElement('details');box.className='price-group';box.dataset.group=key;box.open=openGroups.has(key);box.ontoggle=()=>box.open?openGroups.add(key):openGroups.delete(key);const summaryEl=document.createElement('summary'),label=document.createElement('span'),amount=document.createElement('span'),small=document.createElement('small');label.textContent=title;small.textContent=count;label.append(small);amount.className='price-group-total';amount.textContent=total;summaryEl.append(label,amount);box.append(summaryEl,...children);return box;};
  const blocks=[];
  if(projection){const m=projection.materials,expenses=finance.expenses.slice().sort((a,b)=>a.date.localeCompare(b.date));
   blocks.push(group('bought','Bought',`${expenses.length} ${expenses.length===1?'purchase':'purchases'} · tax included`,money(m.spentCents),expenses.map(x=>{const article=document.createElement('article');article.className='price-item';const inner=document.createElement('div');inner.className='price-item-inner';const head=document.createElement('button');head.type='button';const name=document.createElement('strong'),cost=document.createElement('span');name.textContent=`${x.vendor} · ${x.date}`;cost.textContent=money(x.amountCents);head.append(name,cost);const linked=(x.items||[]).filter(i=>i.materialId).map(i=>rows.find(r=>r.id===i.materialId)?.name||i.description||i.materialId),extra=(x.items||[]).filter(i=>!i.materialId).map(i=>i.description);const meta=document.createElement('div');meta.className='price-item-meta';const math=document.createElement('p');math.className='price-line-math';math.textContent=linked.length?`${linked.length} shopping-list ${linked.length===1?'item':'items'}${extra.length?` + ${extra.length} other`:''}`:'Not linked to the shopping list';const details=document.createElement('button');details.className='price-line-details';details.type='button';details.textContent='Details';details.onclick=()=>{const open=article.classList.toggle('show-details');details.textContent=open?'Less':'Details';};meta.append(math,details);const more=document.createElement('div');more.className='price-item-more';more.textContent=[...linked,...extra].join(' · ')||x.note;head.onclick=()=>details.click();inner.append(head,meta,more);article.append(inner);return article;})));
   const label=document.createElement('p');label.className='price-subhead';label.textContent=`Still to buy · ${money(m.remainingCents)} + ${money(m.remainingTaxCents)} est. tax`;blocks.push(label);}
  blocks.push(...[...groups].sort(([a],[b])=>groupOrder.indexOf(a)-groupOrder.indexOf(b)).map(([g,items])=>{const partly=items.filter(r=>purchases.get(r.id)?.status==='partial').length;return group(g,GROUP_LABELS[g]||'Other',`${items.length} ${items.length===1?'item':'items'}${partly?` · ${partly} partly bought`:''}`,money(sum(items)),items.map(r=>itemRow(r,purchases.get(r.id),lineCost(r))));}));
  for(const b of blocks)if(b.querySelector?.(`[data-price-item="${selected}"]`))b.open=true;
  q('#pricing-rows').replaceChildren(...blocks);
  showReview();persistDraft();
  if(S.mode==='pricing'){api.getSet().visible=api.getFloor().visible=false;if(rebuild)create();else apply();}else clear();
 }
 function mode(m){clear();baseMode(m==='pricing'?'finished':m);S.mode=m;api.refreshConfigLabel?.();host.hidden=m!=='pricing';document.body.classList.toggle('pricing',m==='pricing');if(m==='pricing'){
  $('#explore-controls').hidden=true;$('#guide-controls').hidden=true;$('#scene-tag').textContent='PRICING GUIDE';$('#scene-title').textContent='See what goes into it.';$('#scene-sub').textContent='Click a material to isolate its cost.';$('#view-hint').textContent='Select a price item · drag to orbit';render();fit();
 }document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===m;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active)});}
 // The draft keeps added items in this browser; saved pricing configurations are gone.
 function snapshot(){return normalizeConfiguration({version:1,scope,height:S.height,angle:S.angle,floor:S.floor,platformShape:S.platformShape,platformColor:S.platformColor||'#34383b',platformBack:S.platformBack,platformSide:S.platformSide,platformAngle:S.platformAngle,floorLip:S.floorLip===true,seamlessCorners:S.seamlessCorners,seamlessPerimeter:S.seamlessPerimeter,wallColor:S.wallColor||'#34383b',floorColor:S.floorColor||'#34383b',supports:true,ballast:true,finishes:true,excluded,customItems});}
 function persistDraft(){if(restoring)return;try{localStorage.setItem('rc-pricing-draft-v1',JSON.stringify(snapshot()));}catch{}}
 q('#price-add-open').onclick=()=>{q('#price-add').hidden=false;q('#price-add-open').hidden=true;q('#price-add').scrollIntoView({block:'nearest',behavior:'smooth'});q('#price-title').focus();};q('#price-add-close').onclick=()=>{q('#price-add').hidden=true;q('#price-add-open').hidden=false;q('#price-add-open').focus();};
 q('#price-add-form').onsubmit=e=>{e.preventDefault();try{const item=normalizeCustom({id:'custom-'+crypto.randomUUID(),title:q('#price-title').value,description:q('#price-description').value,link:q('#price-link').value,taxable:q('#price-taxable').checked,unitPriceCents:dollarsToCents(q('#price-amount').value),quantity:Number(q('#price-quantity').value||1)});if(customItems.length>=100)throw Error('Maximum 100 added items.');customItems.push(item);openGroups.add('custom');q('#price-add-form').reset();q('#price-add-status').textContent='';q('#price-add').hidden=true;q('#price-add-open').hidden=false;render(false);q('#price-add-open').focus();}catch(error){q('#price-add-status').textContent=error.message;}};
 api.setMode=mode;api.pricingView=fit;document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>mode(b.dataset.mode));
 window.addEventListener('surface-color-changed',()=>{persistDraft();if(S.mode==='pricing')apply()});
 window.addEventListener('set-configured',()=>{render();if(S.mode==='pricing')fit()});
 window.addEventListener('labor-changed',()=>{if(data)showReview();});
 const canvas=$('#scene'),tap=installCanvasTap(canvas,{enabled:canPick,onTap:e=>{if(!model)return;const r=canvas.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),api.camera);const hits=ray.intersectObject(model,true).filter(h=>h.object.visible&&h.object.userData.pricingIds?.some(id=>rows.some(r=>r.id===id)));const hit=hits.find(h=>h.object.material.opacity===1)||hits[0];if(hit){selected=hit.object.userData.pricingIds.find(id=>rows.some(r=>r.id===id));const box=host.querySelector(`[data-price-item="${selected}"]`)?.closest('details');if(box)box.open=true;apply();host.querySelector(`[data-price-item="${selected}"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'});}}});
 // Never carry a hidden material selection into a different project tab or preview.
 const clearIsolation=()=>{tap.reset();selected=null;apply();};
 window.addEventListener('project-tab-changed',clearIsolation);
 window.addEventListener('studio-view-changed',clearIsolation);
 window.addEventListener('pagehide',()=>tap.dispose(),{once:true});
 api.showProjectPricing=()=>render();
 api.projectBudget=()=>data?pricingBudget(data,snapshot(),laborFor(S)):null;
 // The full-set shopping list as priced here, with added costs.
 api.agentConfiguration=()=>snapshot();
 api.projectRows=()=>{if(!data)return [];const c=snapshot();return customizeRows(priceRows(data,{...c,scope:'set'}),c);};
 api.projection=()=>data&&finance?projectCost({rows:api.projectRows(),finance,tracking,design:S,labor:laborFor(S)}):null;
 window.addEventListener('project-finance-changed',e=>{finance=e.detail;if(data)render(false);});
 for(const type of ['project-tracking-loaded','project-tracking-changed'])window.addEventListener(type,e=>{tracking=e.detail;if(data&&finance)showReview();});
 api.pricingStats=()=>{let opaque=0,ghost=0;model?.traverse(o=>{if(o.isMesh)o.material.opacity===1?opaque++:ghost++});return {scope,floor:S.floor,platformShape:S.platformShape,selected,opaque,ghost,rows:rows.length,...summary(rows)}};
 api.pricingReady=fetch('./data/flat-shopping-list.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{data=d;try{const draft=normalizeConfiguration(JSON.parse(localStorage.getItem('rc-pricing-draft-v1')));customItems=draft.customItems;}catch{}restoring=true;render();restoring=false;}).catch(()=>{q('#price-estimate-rows').textContent='Could not load prices. Reload to retry.'});
}
