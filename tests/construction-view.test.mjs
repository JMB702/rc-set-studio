import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../public/vendor/three.module.js';
import {projectDefaultTracking,projectPartStatus} from '../public/project-model.js';
const url=name=>new URL('../public/'+name,import.meta.url).href;
const moduleURL=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const utils=fs.readFileSync(new URL('../public/vendor/BufferGeometryUtils.js',import.meta.url),'utf8').replaceAll("'three'",JSON.stringify(url('vendor/three.module.js')));
let source=fs.readFileSync(new URL('../public/model.js',import.meta.url),'utf8').replaceAll("'three'",JSON.stringify(url('vendor/three.module.js'))).replace("'./vendor/BufferGeometryUtils.js'",JSON.stringify(moduleURL(utils)));
for(const name of ['platform.js','jack-attachment.js','jack-layout.js','wall-appearance.js'])source=source.replace("'./"+name+"'",JSON.stringify(url(name)));
const modelURL=moduleURL(source),load=T.TextureLoader.prototype.load;T.TextureLoader.prototype.load=()=>new T.Texture();const model=await import(modelURL);T.TextureLoader.prototype.load=load;
const viewSource=fs.readFileSync(new URL('../public/construction-view.js',import.meta.url),'utf8').replace("'three'",JSON.stringify(url('vendor/three.module.js'))).replace("'./model.js'",JSON.stringify(modelURL)).replace("'./project-model.js'",JSON.stringify(url('project-model.js')));
const {installConstructionView}=await import(moduleURL(viewSource));
const data={...projectDefaultTracking(),assembly:{panelsCompleted:8,jacksBuilt:4,jacksAttached:2,jacksPartial:2}};
function panelIndex(o){for(let p=o;p;p=p.parent)if(p.userData.progressPanel!==undefined)return p.userData.progressPanel;return 0;}
test('Generated full-set geometry retains separate panels and all 16 independently attachable jacks',()=>{
 for(const height of [96,120]){const root=model.finishedSet(height,45),panels=new Set(),jacks=new Set(),attached=new Set();root.traverse(o=>{if(o.userData.progressPanel!==undefined)panels.add(o.userData.progressPanel);const part=o.userData.progress;if(part?.kind==='jack'){const p=panelIndex(o),j=p*2+part.side;jacks.add(j);if(projectPartStatus({...part,panel:p},data).assembled)attached.add(j);}});assert.equal(panels.size,8);assert.equal(jacks.size,16);assert.deepEqual([...attached].sort(),[0,1]);model.dispose(root);}
});
test('Progress materials are temporary, the toggle restores the model, and camera positions always bypass shading',async()=>{
 const originals={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch};const nodes=[];
 const element=()=>({hidden:false,attributes:{},setAttribute(k,v){this.attributes[k]=v;},append(o){nodes.push(o);}});
 globalThis.document={querySelector:()=>element(),querySelectorAll:()=>[],addEventListener(){},hidden:false,createElement:element};globalThis.window=new EventTarget();globalThis.fetch=async()=>({ok:true,json:async()=>({data,revision:1})});
 const scene=new T.Scene(),root=model.finishedSet(120,45),platform=model.platformFloor(45,12,12,90);scene.add(root,platform);const api={scene,state:{mode:'finished',floor:'charcoal'},invalidate(){}};
 try{installConstructionView(api);await new Promise(setImmediate);const before=new Map();scene.traverse(o=>{if(o.isMesh)before.set(o,{material:o.material,visible:o.visible,castShadow:o.castShadow});});
 scene.onBeforeRender();let coloredJacks=0,ghostJacks=0,visibleProgress=0;scene.traverseVisible(o=>{if(o.userData.progressOnly)visibleProgress++;if(o.userData.progress?.kind==='jack'){if(o.material.opacity===1)coloredJacks++;else{ghostJacks++;assert.equal(o.material.opacity,.16);assert.equal(o.material.depthWrite,false);}}});assert.ok(coloredJacks>0&&ghostJacks>coloredJacks);assert.ok(visibleProgress>0);scene.onAfterRender();
 for(const [o,base] of before){assert.equal(o.material,base.material);assert.equal(o.visible,base.visible);assert.equal(o.castShadow,base.castShadow);}
 const toggle=nodes.find(n=>n.id==='construction-view-toggle');toggle.onclick();assert.equal(api.constructionView.completed,true);scene.onBeforeRender();for(const [o,base] of before)assert.equal(o.material,base.material);scene.onAfterRender();
 toggle.onclick();const woodData=structuredClone(data);woodData.stages.find(s=>s.id==='floor').steps.forEach(s=>s.percent=100);window.dispatchEvent(new CustomEvent('project-tracking-changed',{detail:woodData}));api.state.floor='wood';const floor=model.floorMesh(45,'wood');scene.add(floor);scene.onBeforeRender();assert.equal(floor.children[0].material.map,model.mats.floor.map);scene.onAfterRender();model.dispose(floor);
 const filled=structuredClone(data);filled.stages.find(s=>s.id==='wall-finishing').steps.find(s=>s.id==='wall-finishing-1').percent=100;api.state.height=120;window.dispatchEvent(new CustomEvent('project-tracking-changed',{detail:filled}));scene.onBeforeRender();let plastered=0;scene.traverseVisible(o=>{if(o.userData.progress?.kind==='wallSkin'){if(o.userData.progress.front){assert.equal(o.material.map,model.mats.wallSeams10.map);plastered++;}else assert.equal(o.material.map,model.mats.wallRaw.map);}});assert.equal(plastered,8);scene.onAfterRender();
 api.state.mode='cameras';assert.equal(api.constructionView.completed,true);scene.onBeforeRender();for(const [o,base] of before)assert.equal(o.material,base.material);scene.onAfterRender();
 }finally{window.dispatchEvent(new Event('pagehide'));model.dispose(root);model.dispose(platform);Object.assign(globalThis,originals);}
});
