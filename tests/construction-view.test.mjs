import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../public/vendor/three.module.js';
import {projectDefaultTracking,projectPartStatus} from '../public/project-model.js';
const url=name=>new URL('../public/'+name,import.meta.url).href;
const moduleURL=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const utils=fs.readFileSync(new URL('../public/vendor/BufferGeometryUtils.js',import.meta.url),'utf8').replaceAll("'three'",JSON.stringify(url('vendor/three.module.js')));
let source=fs.readFileSync(new URL('../public/model.js',import.meta.url),'utf8').replaceAll("'three'",JSON.stringify(url('vendor/three.module.js'))).replace("'./vendor/BufferGeometryUtils.js'",JSON.stringify(moduleURL(utils)));
for(const name of ['platform.js','jack-attachment.js','jack-layout.js','wall-appearance.js','platform-finish.js'])source=source.replace("'./"+name+"'",JSON.stringify(url(name)));
source=source.replace(JSON.stringify(url('platform-finish.js')),JSON.stringify(moduleURL(fs.readFileSync(new URL('../public/platform-finish.js',import.meta.url),'utf8').replace("'three'",JSON.stringify(url('vendor/three.module.js'))))));
const modelURL=moduleURL(source),load=T.TextureLoader.prototype.load;T.TextureLoader.prototype.load=()=>new T.Texture();const model=await import(modelURL);T.TextureLoader.prototype.load=load;
const finishSource=fs.readFileSync(new URL('../public/platform-finish.js',import.meta.url),'utf8').replace("'three'",JSON.stringify(url('vendor/three.module.js')));
const viewSource=fs.readFileSync(new URL('../public/construction-view.js',import.meta.url),'utf8').replace("'three'",JSON.stringify(url('vendor/three.module.js'))).replace("'./model.js'",JSON.stringify(modelURL)).replace("'./project-model.js'",JSON.stringify(url('project-model.js'))).replace("'./platform-finish.js'",JSON.stringify(moduleURL(finishSource)));
const {installConstructionView}=await import(moduleURL(viewSource));
const data={...projectDefaultTracking(),assembly:{panelsCompleted:8,jacksBuilt:4,jacksAttached:2,jacksPartial:2}};
function panelIndex(o){for(let p=o;p;p=p.parent)if(p.userData.progressPanel!==undefined)return p.userData.progressPanel;return 0;}
test('Generated full-set geometry retains separate panels and all 16 independently attachable jacks',()=>{
 for(const height of [96,120]){const root=model.finishedSet(height,45),panels=new Set(),jacks=new Set(),attached=new Set();root.traverse(o=>{if(o.userData.progressPanel!==undefined)panels.add(o.userData.progressPanel);const part=o.userData.progress;if(part?.kind==='jack'){const p=panelIndex(o),j=p*2+part.side;jacks.add(j);if(projectPartStatus({...part,panel:p},data).assembled)attached.add(j);}});assert.equal(panels.size,8);assert.equal(jacks.size,16);assert.deepEqual([...attached].sort(),[14,15]);model.dispose(root);}
});
test('Progress materials are temporary, the toggle restores the model, and camera positions always bypass shading',async()=>{
 const originals={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch};const nodes=[];
 const element=()=>({hidden:false,classList:{add(){},remove(){}},attributes:{},setAttribute(k,v){this.attributes[k]=v;},append(o){nodes.push(o);}});
 globalThis.document={querySelector:()=>element(),querySelectorAll:()=>[],addEventListener(){},hidden:false,createElement:element};globalThis.window=new EventTarget();globalThis.fetch=async()=>({ok:true,json:async()=>({data,revision:1})});
 const scene=new T.Scene(),root=model.finishedSet(120,45),platform=model.platformFloor(45,12,12,90);scene.add(root,platform);const api={scene,state:{mode:'finished',floor:'charcoal'},invalidate(){}};
 try{installConstructionView(api);await new Promise(setImmediate);const before=new Map();scene.traverse(o=>{if(o.isMesh)before.set(o,{material:o.material,visible:o.visible,castShadow:o.castShadow});});
 scene.onBeforeRender();let coloredJacks=0,ghostJacks=0,visibleProgress=0;scene.traverseVisible(o=>{if(o.userData.progressOnly)visibleProgress++;if(o.userData.progress?.kind==='jack'){if(o.material.opacity===1)coloredJacks++;else{ghostJacks++;assert.equal(o.material.opacity,.26);assert.equal(o.material.depthWrite,false);}}});assert.ok(coloredJacks>0&&ghostJacks>coloredJacks);assert.ok(visibleProgress>0);scene.onAfterRender();
 for(const [o,base] of before){assert.equal(o.material,base.material);assert.equal(o.visible,base.visible);assert.equal(o.castShadow,base.castShadow);}
 const toggle=nodes.find(n=>n.id==='construction-view-toggle');toggle.onclick();assert.equal(api.constructionView.completed,true);scene.onBeforeRender();for(const [o,base] of before)assert.equal(o.material,base.material);scene.onAfterRender();
 toggle.onclick();const woodData=structuredClone(data);woodData.stages.find(s=>s.id==='floor').steps.forEach(s=>s.percent=100);window.dispatchEvent(new CustomEvent('project-tracking-changed',{detail:woodData}));api.state.floor='wood';const floor=model.floorMesh(45,'wood');scene.add(floor);scene.onBeforeRender();assert.equal(floor.children[0].material.map,model.mats.floor.map);scene.onAfterRender();model.dispose(floor);
 const seamData=structuredClone(data);seamData.stages.find(s=>s.id==='wall-finishing').steps.forEach(s=>s.percent=['wall-finishing-1','wall-finishing-2'].includes(s.id)?100:0);seamData.stages.find(s=>s.id==='platform').steps.forEach(s=>s.percent=['platform-skim','platform-prime','platform-paint'].includes(s.id)?0:100);api.state.height=120;window.dispatchEvent(new CustomEvent('project-tracking-changed',{detail:seamData}));scene.onBeforeRender();let wallSeams=0,platformSeams=0;scene.traverseVisible(o=>{if(o.userData.progress?.kind==='wallSkin'&&o.userData.progress.front){wallSeams++;assert.equal(o.material.map,model.mats.wallSeams10.map);assert.notEqual(o.material.customProgramCacheKey(),'platform-seam-compound-v1','Wall seams must not acquire the platform-height plaster band');}if(o.userData.progress?.kind==='platform'&&o.userData.progress.stage>=34){platformSeams++;assert.equal(o.material.customProgramCacheKey(),'platform-seam-compound-v1');}});assert.ok(wallSeams>0&&platformSeams>0);scene.onAfterRender();
 api.state.mode='build';assert.equal(api.constructionView.completed,true,'Build guide starts in full color');scene.onBeforeRender();for(const [o,base] of before)assert.equal(o.material,base.material);scene.onAfterRender();toggle.onclick();assert.equal(api.constructionView.completed,false);api.state.mode='finished';assert.equal(api.constructionView.completed,false,'Other views keep their progress preference');api.state.mode='cameras';assert.equal(api.constructionView.completed,true);scene.onBeforeRender();for(const [o,base] of before)assert.equal(o.material,base.material);scene.onAfterRender();
 }finally{window.dispatchEvent(new Event('pagehide'));model.dispose(root);model.dispose(platform);Object.assign(globalThis,originals);}
});
test('Deck seams follow larger plywood pieces while fascia follows long strip joints',()=>{
 for(const angle of [30,45,90]){const platform=model.platformFloor(angle,12,12,angle),parts=platform.children.find(o=>o.userData.progressOnly),plan=platform.userData.plan;
  for(const o of parts.children){if(o.userData.step<34)continue;const part=o.userData.progress;assert.equal(part.seamEdges.length,o.userData.step===34?plan.decks[part.deckIndex].edges.length:1);assert.ok(part.seamEdges.length<=8);for(const edge of part.seamEdges)assert.ok(edge.every(Number.isFinite));if(o.userData.step===34)assert.equal(o.material,model.mats.platformWood);}
  model.dispose(platform);
 }
});
