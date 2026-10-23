import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../public/vendor/three.module.js';
import {projectDefaultTracking,projectPartStatus,projectUpgradeTracking,projectSetStepCount} from '../public/project-model.js';
import {CYC,cycloramaPlan} from '../public/cyclorama.js';
const url=name=>new URL('../public/'+name,import.meta.url).href;
const moduleURL=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const utils=fs.readFileSync(new URL('../public/vendor/BufferGeometryUtils.js',import.meta.url),'utf8').replaceAll("'three'",JSON.stringify(url('vendor/three.module.js')));
let source=fs.readFileSync(new URL('../public/model.js',import.meta.url),'utf8').replaceAll("'three'",JSON.stringify(url('vendor/three.module.js'))).replace("'./vendor/BufferGeometryUtils.js'",JSON.stringify(moduleURL(utils)));
for(const name of ['floor-plan.js','cyclorama.js','platform.js','jack-attachment.js','jack-layout.js','wall-appearance.js','platform-finish.js'])source=source.replace("'./"+name+"'",JSON.stringify(url(name)));
source=source.replace(JSON.stringify(url('platform-finish.js')),JSON.stringify(moduleURL(fs.readFileSync(new URL('../public/platform-finish.js',import.meta.url),'utf8').replace("'three'",JSON.stringify(url('vendor/three.module.js'))))));
const modelURL=moduleURL(source),load=T.TextureLoader.prototype.load;T.TextureLoader.prototype.load=()=>new T.Texture();const model=await import(modelURL);T.TextureLoader.prototype.load=load;
const finishSource=fs.readFileSync(new URL('../public/platform-finish.js',import.meta.url),'utf8').replace("'three'",JSON.stringify(url('vendor/three.module.js')));
const viewSource=fs.readFileSync(new URL('../public/construction-view.js',import.meta.url),'utf8').replace("'three'",JSON.stringify(url('vendor/three.module.js'))).replace("'./model.js'",JSON.stringify(modelURL)).replace("'./project-model.js'",JSON.stringify(url('project-model.js'))).replace("'./platform-finish.js'",JSON.stringify(moduleURL(finishSource))).replace("'./cyclorama.js'",JSON.stringify(url('cyclorama.js')));
const {installConstructionView}=await import(moduleURL(viewSource));
const data={...projectDefaultTracking(),assembly:{panelsCompleted:8,jacksBuilt:4,jacksAttached:2,jacksPartial:2}};
function panelIndex(o){for(let p=o;p;p=p.parent)if(p.userData.progressPanel!==undefined)return p.userData.progressPanel;return 0;}
test('Generated full-set geometry retains separate panels and all 16 independently attachable jacks',()=>{
 for(const height of [96,120]){const root=model.finishedSet(height,45),panels=new Set(),jacks=new Set(),attached=new Set();root.traverse(o=>{if(o.userData.progressPanel!==undefined)panels.add(o.userData.progressPanel);const part=o.userData.progress;if(part?.kind==='jack'){const p=panelIndex(o),j=p*2+part.side;jacks.add(j);if(projectPartStatus({...part,panel:p},data).assembled)attached.add(j);}});assert.equal(panels.size,8);assert.equal(jacks.size,16);assert.deepEqual([...attached].sort(),[14,15]);model.dispose(root);}
});
test('Progress materials are temporary, the toggle restores the model, and camera positions always bypass shading',async()=>{
 const originals={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch};const nodes=[];
 const element=()=>({hidden:false,classList:{add(){},remove(){},toggle(){}},attributes:{},setAttribute(k,v){this.attributes[k]=v;},append(o){nodes.push(o);}});
 globalThis.document={querySelector:()=>element(),querySelectorAll:()=>[],addEventListener(){},hidden:false,createElement:element};globalThis.window=new EventTarget();globalThis.fetch=async()=>({ok:true,json:async()=>({data,revision:1})});
 const scene=new T.Scene(),root=model.finishedSet(120,45),platform=model.platformFloor(45,12,12,90);scene.add(root,platform);const api={scene,state:{mode:'pricing',floor:'charcoal'},invalidate(){}};
 try{installConstructionView(api);await new Promise(setImmediate);const before=new Map();scene.traverse(o=>{if(o.isMesh)before.set(o,{material:o.material,visible:o.visible,castShadow:o.castShadow});});
 scene.onBeforeRender();let coloredJacks=0,ghostJacks=0,visibleProgress=0;scene.traverseVisible(o=>{if(o.userData.progressOnly)visibleProgress++;if(o.userData.progress?.kind==='jack'){if(o.material.opacity===1)coloredJacks++;else{ghostJacks++;assert.equal(o.material.opacity,.26);assert.equal(o.material.depthWrite,false);}}});assert.ok(coloredJacks>0&&ghostJacks>coloredJacks);assert.ok(visibleProgress>0);scene.onAfterRender();
 for(const [o,base] of before){assert.equal(o.material,base.material);assert.equal(o.visible,base.visible);assert.equal(o.castShadow,base.castShadow);}
 const toggle=nodes.find(n=>n.id==='construction-view-toggle');toggle.onclick();assert.equal(api.constructionView.completed,true);scene.onBeforeRender();for(const [o,base] of before)assert.equal(o.material,base.material);scene.onAfterRender();
 toggle.onclick();assert.equal(api.constructionView.completed,true,'Lighting preview shows the finished set');toggle.onclick();assert.equal(api.constructionView.completed,false,'and the cycle returns to build progress');const woodData=structuredClone(data);woodData.stages.filter(s=>s.id==='floor'||s.id==='floor-finishing').flatMap(s=>s.steps).forEach(s=>s.percent=100);window.dispatchEvent(new CustomEvent('project-tracking-changed',{detail:woodData}));api.state.floor='wood';const floor=model.floorMesh(45,'wood');scene.add(floor);scene.onBeforeRender();assert.equal(floor.children[0].material.map,model.mats.floor.map);scene.onAfterRender();model.dispose(floor);
 const seamData=structuredClone(data);seamData.stages.find(s=>s.id==='wall-finishing').steps.forEach(s=>s.percent=['wall-finishing-1','wall-finishing-2'].includes(s.id)?100:0);seamData.stages.filter(s=>s.id==='platform'||s.id==='platform-finishing').flatMap(s=>s.steps).forEach(s=>s.percent=['platform-skim','platform-prime','platform-paint'].includes(s.id)?0:100);api.state.height=120;window.dispatchEvent(new CustomEvent('project-tracking-changed',{detail:seamData}));scene.onBeforeRender();let wallSeams=0,platformSeams=0;scene.traverseVisible(o=>{if(o.userData.progress?.kind==='wallSkin'&&o.userData.progress.front){wallSeams++;assert.equal(o.material.map,model.mats.wallSeams10.map);assert.notEqual(o.material.customProgramCacheKey(),'platform-seam-compound-v1','Wall seams must not acquire the platform-height plaster band');}if(o.userData.progress?.kind==='platform'&&o.userData.progress.stage>=34){platformSeams++;assert.equal(o.material.customProgramCacheKey(),o.userData.progress.stage===35?'platform-fascia-compound-v1':'wood-fill-v1','the deck gets wood filler; fascia joints use the wall seam compound');}});assert.ok(wallSeams>0&&platformSeams>0);scene.onAfterRender();
 api.state.mode='finished';assert.equal(api.constructionView.completed,true,'Explore opens on the finished set');api.state.mode='pricing';
 api.state.mode='build';assert.equal(api.constructionView.completed,true,'Build guide starts on the step in real materials');scene.onBeforeRender();for(const [o,base] of before)assert.equal(o.material,base.material);scene.onAfterRender();toggle.onclick();assert.equal(api.constructionView.completed,false);api.state.mode='pricing';assert.equal(api.constructionView.completed,false,'Cost & Tracking keeps its own progress preference');api.state.mode='finished';assert.equal(api.constructionView.completed,true,'and Explore keeps the finished set');api.state.mode='cameras';assert.equal(api.constructionView.completed,true);scene.onBeforeRender();for(const [o,base] of before)assert.equal(o.material,base.material);scene.onAfterRender();
 }finally{window.dispatchEvent(new Event('pagehide'));model.dispose(root);model.dispose(platform);Object.assign(globalThis,originals);}
});
test('Deck seams follow larger plywood pieces while fascia follows long strip joints',()=>{
 for(const angle of [30,45,90]){const platform=model.platformFloor(angle,12,12,angle),parts=platform.children.find(o=>o.userData.progressOnly),plan=platform.userData.plan;
  for(const o of parts.children){if(o.userData.step<34)continue;const part=o.userData.progress;assert.equal(part.seamEdges.length,o.userData.step===34?plan.decks[part.deckIndex].edges.length:1);assert.ok(part.seamEdges.length<=8);for(const edge of part.seamEdges)assert.ok(edge.every(Number.isFinite));if(o.userData.step===34)assert.equal(o.material.map,model.mats.platformWood.map);assert.ok(Number.isInteger(o.material.userData.sheetColor),'each sheet keeps its own tone');}
  const tone=new Map(parts.children.filter(o=>o.userData.step===34).map(o=>[o.userData.progress.deckIndex,o.material.userData.sheetColor]));
  const touches=(a,b)=>a.edges.some(e=>{const m=[(e.A[0]+e.B[0])/2,(e.A[1]+e.B[1])/2];return b.edges.some(f=>{const dx=f.B[0]-f.A[0],dz=f.B[1]-f.A[1],l=Math.hypot(dx,dz),t=((m[0]-f.A[0])*dx+(m[1]-f.A[1])*dz)/l/l;return t>0&&t<1&&Math.abs((m[0]-f.A[0])*dz-(m[1]-f.A[1])*dx)/l<1e-3;});});
  for(let i=0;i<plan.decks.length;i++)for(let j=i+1;j<plan.decks.length;j++)if(plan.modules[plan.decks[i].moduleIndices[0]].row===plan.modules[plan.decks[j].moduleIndices[0]].row&&touches(plan.decks[i],plan.decks[j]))assert.notEqual(tone.get(i),tone.get(j),`decks ${i} and ${j} share a joint and read as separate sheets`);
  model.dispose(platform);
 }
});

test('Retrofit meshes have finite geometry, inward corner normals, and floor-height corners without perimeter',()=>{
 for(const height of [96,120])for(const angle of [0,45,90])for(const seamlessCorners of [false,true])for(const seamlessPerimeter of [false,true]){
  const d={height,angle,seamlessCorners,seamlessPerimeter},root=model.cycloramaMesh(d,{construction:true});
  root.traverse(o=>{if(!o.isMesh)return;for(const key of ['position','normal'])assert.ok([...o.geometry.attributes[key].array].every(Number.isFinite),o.name);assert.equal(o.userData.progress.kind,'cyclorama');
   if(o.name.startsWith('Rounded wall corner')){o.geometry.computeBoundingBox();const sk=root.userData.plan.cornerSkin,lift=root.userData.plan.floorBase;assert.ok(Math.abs(o.geometry.boundingBox.min.y-(o.name.endsWith('upper')?sk.seams[0]-lift:(seamlessPerimeter?24:0))*model.inch)<1e-6,'lower piece from the curve base, upper piece from the skin joint');assert.ok(o.geometry.attributes.normal.getZ(o.geometry.userData.skinVertexCount)>0,'corner faces the room, preventing inverted shadow bias');}
  });if(!seamlessPerimeter&&(!seamlessCorners||angle===0))assert.equal(root.children.length,0);model.dispose(root);
 }
});

test('Cost preview retains physical cyclorama framing in progress, finished, lighting and guide views',async()=>{
 const originals={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch},nodes=[];
 const element=()=>({hidden:false,classList:{add(){},remove(){},toggle(){}},setAttribute(){},append(o){nodes.push(o);}});
 globalThis.document={querySelector:()=>element(),querySelectorAll:()=>[],addEventListener(){},hidden:false,createElement:element};globalThis.window=new EventTarget();globalThis.fetch=async()=>({ok:true,json:async()=>({data,revision:1})});
 const d={height:120,angle:90,seamlessCorners:true,seamlessPerimeter:true},scene=new T.Scene(),cyc=model.cycloramaMesh(d,{construction:true}),guide=model.cycloramaMesh(d,{construction:true,stage:44});scene.add(cyc);
 const api={scene,state:{...d,mode:'pricing',floor:'charcoal'},invalidate(){}};
 const framing=()=>{let count=0;scene.traverseVisible(o=>{if(o.isMesh&&['cycRibPly','cycBacking'].includes(o.userData.pricingIds?.[0]))count++;});return count;};
 try{installConstructionView(api);await new Promise(setImmediate);const toggle=nodes.find(n=>n.id==='construction-view-toggle');
 scene.onBeforeRender();assert.ok(framing()>0);scene.onAfterRender();
 for(let i=0;i<2;i++){toggle.onclick();scene.onBeforeRender();assert.ok(framing()>0);let skins=0;scene.traverseVisible(o=>{if(o.userData.pricingIds?.[0]==='cycSkin')skins++;});assert.ok(skins>0);scene.onAfterRender();}
 toggle.onclick();scene.onBeforeRender();assert.ok(framing()>0);scene.onAfterRender();
 let guideRibs=0;guide.traverseVisible(o=>{if(o.userData.pricingIds?.[0]==='cycRibPly')guideRibs++;});assert.ok(guideRibs>0);
 }finally{window.dispatchEvent(new Event('pagehide'));model.dispose(cyc);model.dispose(guide);Object.assign(globalThis,originals);}
});


test('Opaque skin covers rib faces from the room while ribs remain real solid geometry',()=>{
 for(const angle of [45,90])for(const seamlessPerimeter of [false,true]){
  const d={height:120,angle,seamlessCorners:true,seamlessPerimeter},root=model.cycloramaMesh(d),rib=[];root.updateMatrixWorld(true);root.traverse(o=>{if(o.name.startsWith('Corner rib'))rib.push(o);});assert.ok(rib.length>0,'finished model must include framing');
  const a=angle*Math.PI/360,R=36,t=R*Math.tan(a),center=new T.Vector3((96-t)*model.inch,0,R*model.inch),outward=new T.Vector3(Math.sin(a),0,-Math.cos(a));
  for(const mesh of rib.filter(o=>o.name.startsWith('Corner rib 1 '))){mesh.geometry.computeBoundingBox();const y=mesh.geometry.boundingBox.getCenter(new T.Vector3()).y,origin=center.clone().addScaledVector(outward,20*model.inch);origin.y=y;
   const hits=new T.Raycaster(origin,outward).intersectObject(root,true);assert.ok(hits.length);assert.equal(hits[0].object.userData.pricingIds[0],'cycSkin','skin must physically occlude rib from front');assert.ok(hits.some(h=>h.object===mesh),'rib remains behind skin, not hidden');}
  const solids=[];root.traverse(o=>{if(o.name.startsWith('Compound corner rib'))solids.push(o);});for(const o of solids){assert.ok(o.geometry.attributes.position.count>100);assert.ok(!o.userData.progressOnly);}
  model.dispose(root);
 }
});

test('Cyclorama skin matches the wall plywood actual .106-inch thickness',()=>{
 const g=new T.PlaneGeometry(1,1),shell=model.cycloramaSkin(g),p=shell.attributes.position,c=shell.userData.skinVertexCount;
 for(let i=0;i<c;i++)assert.ok(Math.abs(new T.Vector3().fromBufferAttribute(p,i).distanceTo(new T.Vector3().fromBufferAttribute(p,i+c))-.106*model.inch)<1e-7);
 shell.dispose();
});

test('Floor and compound skins physically occlude their solid ribs',()=>{
 for(const angle of [45,90]){
  const d={height:120,angle,seamlessCorners:true,seamlessPerimeter:true},root=model.cycloramaMesh(d);root.updateMatrixWorld(true);
  const n=cycloramaPlan(d).compoundRibs/2,u=angle*Math.PI/180*Math.floor((n-1)/2)/(n-1),t=Math.PI/4,R=CYC.cornerRadius,r=24,cx=96-R*Math.tan(angle*Math.PI/360),rho=R-r+r*Math.cos(t);
  const point=new T.Vector3(cx+rho*Math.sin(u),r*(1-Math.sin(t)),R-rho*Math.cos(u)).multiplyScalar(model.inch),normal=new T.Vector3(-Math.sin(u)*Math.cos(t),Math.sin(t),Math.cos(u)*Math.cos(t));
  const hits=new T.Raycaster(point.clone().addScaledVector(normal,4*model.inch),normal.clone().negate()).intersectObject(root,true);
  assert.equal(hits[0].object.userData.pricingIds[0],'cycSkin');assert.ok(hits.some(h=>h.object.name.startsWith('Compound corner rib')),'compound rib must remain behind the sheet');
  model.dispose(root);
 }
});

test('Above-corner view hits the top plywood rib rather than an empty hidden cavity',()=>{
 for(const angle of [45,90]){const root=model.cycloramaMesh({height:120,angle,seamlessCorners:true,seamlessPerimeter:false}),u=angle*Math.PI/360,inset=18*(1/Math.cos(u)-1);root.updateMatrixWorld(true);
  const origin=new T.Vector3((96-inset*Math.sin(u))*model.inch,130*model.inch,inset*Math.cos(u)*model.inch),hits=new T.Raycaster(origin,new T.Vector3(0,-1,0)).intersectObject(root,true);
  assert.ok(hits[0].object.name.startsWith('Corner rib'),'top support must remain physically present and visible');model.dispose(root);
 }
});

test('Left and right floor ribs mirror inward at square and angled walls',()=>{
 for(const angle of [45,89,90]){
  const root=model.cycloramaMesh({height:120,angle,seamlessCorners:true,seamlessPerimeter:true});
  const left=[],right=[];root.traverse(o=>{if(o.name.startsWith('Floor rib left'))left.push(o);if(o.name.startsWith('Floor rib right'))right.push(o);});
  assert.equal(left.length,right.length);
  for(let i=0;i<left.length;i++){
   left[i].geometry.computeBoundingBox();right[i].geometry.computeBoundingBox();
   const l=left[i].geometry.boundingBox,r=right[i].geometry.boundingBox;
   assert.ok(Math.abs(l.min.x+r.max.x)<1e-6,`angle ${angle}, rib ${i}: mirrored min`);
   assert.ok(Math.abs(l.max.x+r.min.x)<1e-6,`angle ${angle}, rib ${i}: mirrored max`);
   if(angle===90)assert.ok(l.min.x>=-96*model.inch-1e-6,'left rib stays inside wall');
  }
 }
});

test('Finished floor has physical layers and a 12-inch lower-plywood ledge above the support floor',async()=>{
 const {floorSection,FLOOR}=await import('../public/floor-plan.js');const s=floorSection('charcoal'),I=model.inch,close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
 for(const angle of [0,45,90])for(const floorLip of [false,true]){
  const root=model.floorMesh(angle,'charcoal',99,{floorLip});root.updateMatrixWorld(true);
  const bounds=o=>new T.Box3().setFromObject(o),felt=bounds(root.getObjectByName('Felt underlayment')),lower=bounds(root.getObjectByName(floorLip?'Front joining lip — exposed lower plywood':'Lower plywood layer')),upper=bounds(root.getObjectByName('Upper plywood layer')),paint=bounds(root.getObjectByName('Floor'));
  close(felt.min.y,0);close(felt.max.y,s.underlay*I);close(lower.min.y,felt.max.y);close(lower.max.y,s.lower*I);close(upper.min.y,lower.max.y);close(upper.max.y,s.upper*I);close(paint.min.y,s.top*I);close(paint.max.y,s.top*I);
  close(upper.max.z,96*I);close(lower.max.z,(floorLip?108:96)*I);assert.ok(lower.max.y<paint.min.y);model.dispose(root);
 }
 close(s.top-s.lipTop,FLOOR.thickness+1/16);
});
test('Platforms and floor curves meet the raised floor without lifting wall tops',async()=>{
 const {floorSurfaceHeight}=await import('../public/floor-plan.js'),I=model.inch,close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
 for(const floor of ['none','wood','charcoal']){const d={height:120,angle:90,floor,seamlessCorners:true,seamlessPerimeter:true},top=floorSurfaceHeight(d),platform=model.platformFloor(90,12,12,90,d),cyc=model.cycloramaMesh(d);platform.updateMatrixWorld(true);cyc.updateMatrixWorld(true);
  const bead=platform.getObjectByName('Corner bead'),beadBox=new T.Box3().setFromObject(bead);bead.removeFromParent();const b=new T.Box3().setFromObject(platform);close(b.min.y,top*I);close(b.max.y,(top+10)*I);assert.ok(beadBox.max.y<=(top+10.1)*I&&beadBox.min.y>=top*I,'vinyl bead sits on the platform edge, a hair proud of the deck');
  const corner=cyc.getObjectByName('Rounded wall corner -1'),skin=new T.Box3().setFromObject(corner);close(skin.max.y,120*I);assert.ok(skin.min.y>=top*I);close(cyc.position.y,top*I);model.dispose(platform);model.dispose(cyc);
 }
});

test('Every retrofit mesh carries its exact component, and guide steps reveal ribs before skin',()=>{
 const d={height:120,angle:90,seamlessCorners:true,seamlessPerimeter:true},expected=new Set(Array.from({length:14},(_,i)=>i+49)),all=model.cycloramaMesh(d);
 const actual=new Set();all.traverse(o=>{if(o.userData.progress?.component){actual.add(o.userData.guideStage);assert.ok(['ribs','skin'].includes(o.userData.progress.phase));}});assert.deepEqual(actual,expected);
 const first=model.cycloramaMesh(d,{stage:49}),seen=[];first.traverseVisible(o=>{if(o.isMesh&&o.userData.progress?.component)seen.push(o.userData.progress);});
 assert.ok(seen.length);assert.ok(seen.every(p=>p.component==='corner-1'&&p.phase==='ribs'));
 const skin=model.cycloramaMesh(d,{stage:51});let firstSkin=0,secondSkin=0;skin.traverseVisible(o=>{if(o.userData.progress?.phase==='skin'){if(o.userData.progress.component==='corner-1')firstSkin++;if(o.userData.progress.component==='corner-2')secondSkin++;}});assert.ok(firstSkin>0);assert.equal(secondSkin,0);
 for(const root of [all,first,skin])model.dispose(root);
});

test('Built corner ribs and crossbars keep their pine in build progress instead of taking the skin texture',async()=>{
 const originals={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch},nodes=[];
 const element=()=>({hidden:false,classList:{add(){},remove(){},toggle(){}},setAttribute(){},append(o){nodes.push(o);}});
 // Jeff's state on 2026-10-16: right corner ribs done, backing survey not marked, skin not started.
 const built=projectUpgradeTracking({...structuredClone(data),design:{floorLip:true,seamlessCorners:true,seamlessCornerSide:'right',seamlessPerimeter:false,height:120,angle:90,floor:'charcoal',platformShape:'square',platformAngle:90,platformBack:18,platformSide:18,wallColor:'#34383b',platformColor:'#34383b',floorColor:'#34383b'}});const ribStep=built.stages.flatMap(s=>s.steps).find(s=>s.id==='cyc-corner-2-ribs');assert.ok(ribStep,'the right corner has a rib step');ribStep.percent=100;
 globalThis.document={querySelector:()=>element(),querySelectorAll:()=>[],addEventListener(){},hidden:false,createElement:element};globalThis.window=new EventTarget();globalThis.fetch=async()=>({ok:true,json:async()=>({data:built,revision:1})});
 const d={height:120,angle:90,seamlessCorners:true,seamlessCornerSide:'right',seamlessPerimeter:false},scene=new T.Scene(),cyc=model.cycloramaMesh(d,{construction:true});scene.add(cyc);
 const api={scene,state:{...d,mode:'pricing',floor:'charcoal'},invalidate(){}};
 try{installConstructionView(api);await new Promise(setImmediate);window.dispatchEvent(new CustomEvent('project-tracking-changed',{detail:built}));
  scene.onBeforeRender();let ribs=0,crossbars=0,skins=0;
  scene.traverseVisible(o=>{if(!o.isMesh)return;const id=o.userData.pricingIds?.[0];
   if(id==='cycRibPly'&&o.material.opacity===1){ribs++;assert.equal(o.material.map,model.mats.wood.map,o.name+' keeps pine');}
   if(id==='cycCrossbars'&&o.material.opacity===1){crossbars++;assert.equal(o.material.map,model.mats.wood.map,o.name+' keeps pine');}
   if(id==='cycSkin'){skins++;assert.ok(o.material.opacity<1,'the skin is not built yet');}
   if(['cycRibPly','cycCrossbars','cycBacking'].includes(id))assert.equal(o.userData.progress.framing,true);if(id==='cycSkin')assert.notEqual(o.userData.progress.framing,true);});
  assert.ok(ribs>0,'built ribs are drawn solid');assert.ok(crossbars>0,'their crossbars are drawn solid');assert.ok(skins>0);scene.onAfterRender();
 }finally{window.dispatchEvent(new Event('pagehide'));model.dispose(cyc);Object.assign(globalThis,originals);}
});

test('Survey step renders the corner with backboards hidden but tagged to their corner',()=>{
 const d={height:120,angle:90,floor:'charcoal',seamlessCorners:true,seamlessCornerSide:'right',seamlessPerimeter:false},boards=[];
 const root=model.cycloramaMesh(d,{stage:43,construction:true});root.traverse(o=>{if(o.isMesh&&o.name.startsWith('Added crossbar'))boards.push(o);});
 assert.ok(boards.length>0);assert.ok(boards.every(o=>!o.visible),'backboards go in after the survey');assert.ok(boards.every(o=>o.userData.progress.corner==='corner-2'));
 const later=model.cycloramaMesh(d,{stage:64,construction:true});let shown=0;later.traverse(o=>{if(o.isMesh&&o.name.startsWith('Added crossbar')&&o.visible)shown++;});assert.equal(shown,boards.length);
 model.dispose(root);model.dispose(later);
});

test('A built but unpainted painted-floor reads as pine plywood, not the lauan skin texture',async()=>{
 const originals={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch},nodes=[];
 const element=()=>({hidden:false,classList:{add(){},remove(){},toggle(){}},setAttribute(){},append(o){nodes.push(o);}});
  const built=structuredClone(data);// Jeff's state on 2026-10-17: both plywood layers down, skim and paint not started.
 const pct={'floor-0':100,'floor-2':100,'floor-upper':100,'floor-1':0,'floor-3':0};built.stages.filter(s=>s.id==='floor'||s.id==='floor-finishing').flatMap(s=>s.steps).forEach(s=>s.percent=pct[s.id]??0);assert.equal(projectPartStatus({kind:'floor'},projectUpgradeTracking(built)).finish,'raw');
 globalThis.document={querySelector:()=>element(),querySelectorAll:()=>[],addEventListener(){},hidden:false,createElement:element};globalThis.window=new EventTarget();globalThis.fetch=async()=>({ok:true,json:async()=>({data:built,revision:1})});
 const scene=new T.Scene(),floor=model.floorMesh(90,'charcoal');scene.add(floor);const api={scene,state:{mode:'pricing',floor:'charcoal',height:120,angle:90},invalidate(){}};
 try{installConstructionView(api);await new Promise(setImmediate);window.dispatchEvent(new CustomEvent('project-tracking-changed',{detail:built}));
  scene.onBeforeRender();let top=null;scene.traverseVisible(o=>{if(o.isMesh&&o.name==='Floor')top=o;});
  assert.ok(top,'the floor surface is drawn');assert.equal(top.material.opacity,1,'built');assert.equal(top.material.map,model.mats.platformWood.map,'raw painted floor shows the pine plywood');assert.notEqual(top.material.map,model.mats.ply.map);scene.onAfterRender();
 }finally{window.dispatchEvent(new Event('pagehide'));model.dispose(floor);Object.assign(globalThis,originals);}
});

test('With a plaster coat on, the rounded corner shows the same seam plaster as the walls',async()=>{
 const originals={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch},nodes=[];
 const element=()=>({hidden:false,classList:{add(){},remove(){},toggle(){}},setAttribute(){},append(o){nodes.push(o);}});
 const d={floorLip:true,seamlessCorners:true,seamlessCornerSide:'right',seamlessPerimeter:false,height:120,angle:90,floor:'charcoal',platformShape:'square',platformAngle:90,platformBack:18,platformSide:18,wallColor:'#34383b',platformColor:'#34383b',floorColor:'#34383b'};
 let built=projectUpgradeTracking({...structuredClone(data),design:d});for(const s of built.stages.flatMap(s=>s.steps))if(['cyc-corner-2-ribs','cyc-corner-2-skin'].includes(s.id))s.percent=100;
 built=projectSetStepCount(built,'wall-finishing-1',{done:1});
 globalThis.document={querySelector:()=>element(),querySelectorAll:()=>[],addEventListener(){},hidden:false,createElement:element};globalThis.window=new EventTarget();globalThis.fetch=async()=>({ok:true,json:async()=>({data:built,revision:1})});
 const scene=new T.Scene(),cyc=model.cycloramaMesh(d,{construction:true});scene.add(cyc);const api={scene,state:{...d,mode:'pricing'},invalidate(){}};
 try{installConstructionView(api);await new Promise(setImmediate);window.dispatchEvent(new CustomEvent('project-tracking-changed',{detail:built}));
  scene.onBeforeRender();let skins=0;scene.traverseVisible(o=>{if(o.isMesh&&o.name.startsWith('Rounded wall corner')){skins++;assert.equal(o.material.opacity,1,o.name+' is built');assert.equal(o.material.map,model.mats.ply.map,'bare lauan');assert.equal(o.material.customProgramCacheKey?.(),'corner-skin-seams-v2','with plaster at its seams');
   // ...and a dab of fill on every rib screw row that crosses this piece.
   const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <map_fragment>'};o.material.onBeforeCompile(shader);
   const height=shader.uniforms.seamHeight.value,rows=[...shader.uniforms.fillRows.value].slice(0,shader.uniforms.fillRowCount.value);assert.ok(rows.length>=2,o.name+' has fastener rows');assert.ok(rows.every(v=>v>-2&&v<height+2));assert.match(shader.fragmentShader,/fillPatch/);}});
  assert.ok(skins>0);scene.onAfterRender();
 }finally{window.dispatchEvent(new Event('pagehide'));model.dispose(cyc);Object.assign(globalThis,originals);}
});

test('A filled floor shows wood filler on the pine plywood, never a white skim',async()=>{
 const originals={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch},element=()=>({hidden:false,classList:{add(){},remove(){},toggle(){}},setAttribute(){},append(){}});
 const built=projectUpgradeTracking(structuredClone(data));for(const s of built.stages)for(const t of s.steps)if(['floor-0','floor-2','floor-upper','floor-1'].includes(t.id))t.percent=100;
 globalThis.document={querySelector:()=>element(),querySelectorAll:()=>[],addEventListener(){},hidden:false,createElement:element};globalThis.window=new EventTarget();globalThis.fetch=async()=>({ok:true,json:async()=>({data:built,revision:1})});
 const scene=new T.Scene(),floor=model.floorMesh(90,'charcoal');scene.add(floor);const api={scene,state:{mode:'pricing',floor:'charcoal',height:120,angle:90},invalidate(){}};
 try{installConstructionView(api);await new Promise(setImmediate);window.dispatchEvent(new CustomEvent('project-tracking-changed',{detail:built}));
  const top=floor.getObjectByName('Floor');assert.equal(top.userData.progress.fill.grid,8);assert.ok(top.userData.progress.fill.seams.length>0,'the top seams are filled');
  scene.onBeforeRender();assert.equal(top.material.map,model.mats.platformWood.map,'sanded pine plywood');assert.equal(top.material.customProgramCacheKey?.(),'wood-fill-v1');assert.notEqual(top.material.map,model.mats.compound.map);scene.onAfterRender();
  assert.equal(floor.getObjectByName('Top finish edge').material.map,model.mats.platformWood.map,'the edge of the top is plywood too');
 }finally{window.dispatchEvent(new Event('pagehide'));model.dispose(floor);Object.assign(globalThis,originals);}
});
