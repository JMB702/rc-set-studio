import * as T from 'three';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {panel,floorMesh,dispose,inch,mats} from './model.js';
import {money,priceRows,summary,floorArea,exportList} from './pricing-calc.js';
const $=s=>document.querySelector(s);
function ids(name,height){
 if(/stile/.test(name))return [height===120?'board16':'board14','glue'];
 if(/rail|Toggle/.test(name))return [height===120?'board13':'board12','glue'];
 if(/backer/.test(name))return ['board14','glue'];
 if(/lauan/.test(name))return ['skin','wallPrimer','wallPaint','wallSeams'];
 if(/Frame screw|Seam backer screw/.test(name))return ['frameScrews'];
 if(/Skin staple/.test(name))return ['staples'];
 if(/jack foot|diagonal/.test(name))return [height===120?'board14long':'board14','glue'];
 if(/jack upright/.test(name))return ['board14','glue'];
 if(/gusset/.test(name))return ['shelf','glue'];
 if(/support bolt/.test(name))return ['mount','washers'];
 if(/nut/.test(name))return ['nuts'];
 if(/Diagonal lap screw/.test(name))return ['lapScrews'];
 if(/Gusset screw|Shelf screw/.test(name))return ['shortScrews'];
 if(/Crossbar fixing/.test(name))return ['barScrews'];
 if(/Shelf crossbar/.test(name))return ['crossbar'];
 if(/Ballast shelf/.test(name))return ['shelf'];
 if(/Ballast bag/.test(name))return ['bags','sand','tallBallast'];
 if(/strap|Strap/.test(name))return ['straps','tallBallast'];
 return [];
}
function pricedPanel(height){const root=panel(height),bins=new Map();
 for(const o of [...root.children]){if(!o.isMesh)continue;const matches=ids(o.name,height),support=o.userData.step>=13,key=matches.join(',')+o.material.uuid+support;
 const bin=bins.get(key)||{ids:matches,material:o.material,support,geometries:[]};bin.geometries.push(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone());bins.set(key,bin);root.remove(o);o.geometry.dispose();}
 for(const bin of bins.values()){const g=mergeGeometries(bin.geometries,false);bin.geometries.forEach(g=>g.dispose());if(!g)continue;const m=new T.Mesh(g,bin.material.clone());m.userData.pricingIds=bin.ids;m.userData.support=bin.support;m.userData.baseColor=m.material.color.clone();m.name=bin.ids[0]||'Panel part';root.add(m);}
 return root;
}
export function installPricing(api){
 const host=$('#pricing-controls'),baseMode=api.setMode,S=api.state;
 let data,model,rows=[],selected=null,scope='set',pricingCamera='front',floor=S.floor;
 host.innerHTML=`<span class="eyebrow">PRICING / HOME DEPOT #6319</span><h2>See what goes into it.</h2><p class="hint">Choose a material to isolate it in 3D. Click it again to show everything.</p><div class="price-scopes" role="group" aria-label="Pricing scope"><button data-price-scope="set" aria-pressed="true">Full set</button><button data-price-scope="panel" aria-pressed="false">One panel</button><button data-price-scope="floor" aria-pressed="false">Floor only</button></div><div class="price-floor-switch" role="group" aria-label="Priced floor finish"><button data-price-floor="wood">Oak laminate</button><button data-price-floor="charcoal">Painted plywood</button></div><div class="price-inclusions"><label><input id="price-supports" type="checkbox" checked> Jacks and shelf</label><label><input id="price-ballast" type="checkbox" checked> Ballast supplies</label><label><input id="price-finishes" type="checkbox" checked> Wall finish supplies</label></div><div class="price-summary"><span id="price-area"></span><strong id="pricing-total" aria-live="polite">Loading prices…</strong><span id="pricing-pending"></span></div><p id="price-selection" role="status">All materials visible</p><button id="price-clear" hidden>Show all materials</button><div id="pricing-rows"></div><p class="hint">Buy quantities are whole retail packs, combined before rounding. Cut requirements and supplied pack quantities appear in each item. Prices dated Oct 5, 2026; tax, delivery, labor and tools excluded. Floor sheets use 10% area allowance; verify cut layout.</p><div class="price-export"><button id="price-download">Download this list</button><button id="price-copy">Copy this list</button><a href="https://www.homedepot.com/cart" target="_blank" rel="noopener">Open Home Depot cart ↗</a><a href="https://www.homedepot.com/c/share-a-cart" target="_blank" rel="noopener">Home Depot cart sharing ↗</a></div><details><summary>Shared Home Depot cart <span>+</span></summary><p class="hint">Home Depot creates its share link from a populated cart. Product links and this list supply the quantities; this website cannot populate a Home Depot cart directly. A saved cart reflects its original configuration.</p><label for="price-cart-link">Paste an existing Home Depot shared cart URL</label><input id="price-cart-link" type="url" placeholder="https://www.homedepot.com/…"><button id="price-save-cart">Save cart link</button><a id="price-open-cart" hidden target="_blank" rel="noopener">Open saved shared cart ↗</a><p id="price-cart-status" role="status"></p></details>`;
 const q=s=>host.querySelector(s);
 function clear(){dispose(model);model=null;}
 function create(){clear();model=new T.Group();model.name='Pricing materials';api.scene.add(model);
  const h=S.height,a=S.angle*Math.PI/180;
  if(scope==='panel'){const p=pricedPanel(h);p.position.x=-24*inch;model.add(p);}else{
   const back=new T.Group(),left=new T.Group(),right=new T.Group();back.position.x=left.position.x=-96*inch;right.position.x=96*inch;left.rotation.y=a;right.rotation.y=-a;model.add(back,left,right);
   for(let i=0;i<4;i++){const p=pricedPanel(h);p.position.x=i*48*inch;back.add(p);}for(let i=0;i<2;i++){const l=pricedPanel(h),r=pricedPanel(h);l.position.x=-(i+1)*48*inch;r.position.x=i*48*inch;left.add(l);right.add(r);}
   const f=floorMesh(S.angle,floor);f.traverse(o=>{if(o.isMesh){o.userData.pricingIds=['laminate','underlay','vapor','floorPly','floorPrimer','floorPaint','floorSeams','floorFixings'];o.userData.baseColor=o.material.color.clone();}});model.add(f);
  }
  apply();api.invalidate();
 }
 function apply(){if(!model)return;const available=new Set(rows.map(r=>r.id));model.traverse(o=>{if(!o.isMesh)return;
  const tags=o.userData.pricingIds||[],inScope=(tags[0]==='laminate'?tags.some(id=>available.has(id)):available.has(tags[0]))&&(!o.userData.support||q('#price-supports').checked),hit=selected?tags.includes(selected)&&inScope:inScope;
  const m=o.material;const wall=tags.includes('wallPaint'),painted=wall&&q('#price-finishes').checked&&selected!=='skin';const map=painted?null:(wall?mats.ply.map:m.map);if(m.map!==map){m.map=map;m.needsUpdate=true;}if(m.transparent!==!hit)m.needsUpdate=true;m.transparent=!hit;m.opacity=hit?1:.075;m.depthWrite=hit;m.color.copy(painted?(selected==='wallPrimer'?new T.Color(0xe3e0d8):mats.charcoal.color):o.userData.baseColor);o.renderOrder=hit?2:0;o.castShadow=hit;o.receiveShadow=hit;
 });q('#price-clear').hidden=!selected;
 const row=rows.find(r=>r.id===selected);q('#price-selection').textContent=row?`${row.name} · ${row.purchaseQuantity??'TBD'} to buy · ${money(row.subtotalCents)}`:'All materials visible';
 host.querySelectorAll('[data-price-item]').forEach(b=>{const on=b.dataset.priceItem===selected;b.setAttribute('aria-pressed',on);b.closest('.price-item').classList.toggle('selected',on)});
 const hasGeometry=selected&&[...model.children].length&&(()=>{let found=false;model.traverse(o=>{if(o.isMesh&&o.userData.pricingIds?.includes(selected))found=true});return found})();
 if(selected&&!hasGeometry)q('#price-selection').textContent+=' · Supply or connection detail has no separate modeled geometry.';
 api.invalidate();}
 function fit(v=pricingCamera){pricingCamera=v==='reset'?'front':v;if(scope!=='panel'){api.view(pricingCamera);return;}
 const target=new T.Vector3(0,S.height*inch*.48,-.25),d=Math.max(4.3,S.height*inch*1.7/api.camera.aspect);
 api.orbit.enableDamping=false;api.orbit.target.copy(target);const pos=pricingCamera==='back'?[-d*.35,d*.35,-d*.85]:pricingCamera==='top'?[0,d,-.24]:[d*.22,d*.35,d*.85];api.camera.position.set(...pos);api.camera.lookAt(target);api.orbit.update();api.orbit.enableDamping=true;api.invalidate();}
 function render(rebuild=true){if(!data)return;
 rows=priceRows(data,{scope,height:S.height,angle:S.angle,floor,supports:q('#price-supports').checked,ballast:q('#price-ballast').checked,finishes:q('#price-finishes').checked});
 if(!rows.some(r=>r.id===selected))selected=null;
 const totals=summary(rows);q('#pricing-total').textContent=rows.some(r=>r.subtotalCents!==null)?`${totals.pending?'Priced subtotal':'Materials total'} ${money(totals.subtotal)}`:'Pricing pending';q('#pricing-pending').textContent=totals.pending?`${totals.pending} items need pricing or specification. This is not a complete purchase total.`:'Before tax and delivery';
 q('#price-area').textContent=scope==='panel'?`One ${S.height/12}′ × 4′ panel`:`${scope==='set'?'8 panels + ':''}${floorArea(S.angle).toFixed(1)} sq ft floor · 10% waste allowance`;
 q('.price-inclusions').hidden=scope==='floor';q('.price-floor-switch').hidden=scope==='panel';q('#price-ballast').disabled=!q('#price-supports').checked;
 host.querySelectorAll('[data-price-scope]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.priceScope===scope));host.querySelectorAll('[data-price-floor]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.priceFloor===floor));
 q('#pricing-rows').replaceChildren(...rows.map(r=>{const article=document.createElement('article');article.className='price-item';const button=document.createElement('button');button.dataset.priceItem=r.id;button.setAttribute('aria-pressed','false');const name=document.createElement('strong'),cost=document.createElement('span');name.textContent=r.name;cost.textContent=money(r.subtotalCents);button.append(name,cost);const detail=document.createElement('p');detail.textContent=`Buy ${r.purchaseQuantity??'TBD'} ${r.packSize>1?'packs':'units'} · ${money(r.unitPriceCents)} each${r.packSize>1?` · ${r.needed} needed / ${r.packSize} per pack`:''}`;const note=document.createElement('small');note.textContent=r.availability+(r.observedStock!==undefined&&r.observedStock!==null&&r.purchaseQuantity>r.observedStock?` · Need ${r.purchaseQuantity-r.observedStock} more than observed store stock`: '');const a=document.createElement('a');a.textContent='Home Depot ↗';a.href=r.productUrl;a.target='_blank';a.rel='noopener';button.onclick=()=>{selected=selected===r.id?null:r.id;apply()};article.append(button,detail,note,a);return article;}));
 if(S.mode==='pricing'){api.getSet().visible=api.getFloor().visible=false;if(rebuild)create();else apply();}else clear();
 }
 function mode(m){clear();baseMode(m==='pricing'?'finished':m);S.mode=m;host.hidden=m!=='pricing';document.body.classList.toggle('pricing',m==='pricing');if(m==='pricing'){
 $('#explore-controls').hidden=true;$('#guide-controls').hidden=true;$('#scene-tag').textContent='PRICING GUIDE';$('#scene-title').textContent='See what goes into it.';$('#scene-sub').textContent='Click a material to isolate its cost.';$('#view-hint').textContent='Select a price item · drag to orbit';render();fit();
 }document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===m;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active)});}
 api.setMode=mode;api.pricingView=fit;document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>mode(b.dataset.mode));
 host.querySelectorAll('[data-price-scope]').forEach(b=>b.onclick=()=>{scope=b.dataset.priceScope;selected=null;$('#panel-count').textContent=scope==='panel'?'1 panel':scope==='floor'?'Floor only':'8 panels';render();fit();});
 host.querySelectorAll('[data-price-floor]').forEach(b=>b.onclick=()=>{floor=b.dataset.priceFloor;selected=null;api.configure({floor});});
 host.querySelectorAll('.price-inclusions input').forEach(i=>i.onchange=()=>render());q('#price-clear').onclick=()=>{selected=null;apply()};
 window.addEventListener('set-configured',()=>{floor=S.floor;render();if(S.mode==='pricing')fit()});
 q('#price-download').onclick=()=>{const blob=new Blob([exportList(rows,`RC Set · ${scope} · ${S.height/12} ft · ${floor}`)],{type:'text/plain'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`rc-set-${scope}-${S.height/12}ft-${floor}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 q('#price-copy').onclick=async()=>{try{await navigator.clipboard.writeText(exportList(rows,`RC Set · ${scope}`));q('#price-copy').textContent='Copied'}catch{q('#price-copy').textContent='Use Download instead'}};
 function saveCart(save=true){try{const url=new URL(q('#price-cart-link').value);if(url.protocol!=='https:'||!['homedepot.com','www.homedepot.com'].includes(url.hostname)||url.pathname==='/cart'||url.pathname==='/')throw Error();q('#price-open-cart').href=url.href;q('#price-open-cart').hidden=false;q('#price-cart-status').textContent='Home Depot URL saved on this browser. Verify that it opens the intended shared cart.';if(save)localStorage.setItem('rc-shared-hd-cart',url.href);}catch{q('#price-cart-status').textContent='Enter a Home Depot shared-cart URL, not the generic cart page.';q('#price-open-cart').hidden=true;}}
 q('#price-save-cart').onclick=()=>saveCart();try{const link=localStorage.getItem('rc-shared-hd-cart');if(link){q('#price-cart-link').value=link;saveCart(false)}}catch{}
 let down;const canvas=$('#scene');canvas.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);canvas.addEventListener('pointerup',e=>{if(S.mode!=='pricing'||!model||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5||document.body.classList.contains('picking-comment'))return;const r=canvas.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),api.camera);const hits=ray.intersectObject(model,true).filter(h=>h.object.userData.pricingIds?.some(id=>rows.some(r=>r.id===id)));const hit=hits.find(h=>h.object.material.opacity===1)||hits[0];if(hit){selected=hit.object.userData.pricingIds.find(id=>rows.some(r=>r.id===id));apply();host.querySelector(`[data-price-item="${selected}"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'});}});
 api.pricingStats=()=>{let opaque=0,ghost=0;model?.traverse(o=>{if(o.isMesh)o.material.opacity===1?opaque++:ghost++});return {scope,floor,selected,opaque,ghost,rows:rows.length,...summary(rows)}};
 fetch('./data/flat-shopping-list.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{data=d;render()}).catch(()=>{q('#pricing-total').textContent='Could not load prices. Reload to retry.'});
}
