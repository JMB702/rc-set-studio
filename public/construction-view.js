import * as THREE from 'three';
import {mats} from './model.js';
import {projectPartStatus,projectUpgradeTracking} from './project-model.js';

// Temporary render materials leave guide highlights and pricing selections intact underneath.
export function installConstructionView(api){
 const viewport=document.querySelector('.viewport'),toggle=document.createElement('button');toggle.id='construction-view-toggle';toggle.type='button';toggle.setAttribute('aria-pressed','false');
 toggle.innerHTML='<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Z M3 8v8l9 5 9-5V8 M12 13v8"/><path d="m7 5 9 5" stroke-dasharray="2 2"/></svg>';
 viewport.append(toggle);
 const status=document.createElement('span');status.id='construction-view-status';status.setAttribute('role','status');viewport.append(status);
 let completed=false,tracking=null,revision=-1,materials=new Map(),watched=new WeakSet(),disposed=false,loading=false,generation=0;
 const originalBefore=api.scene.onBeforeRender,originalAfter=api.scene.onAfterRender;let restored=[];
 function guideOrCamera(){return ['build','cameras'].includes(api.state.mode);}
 function mode(){return completed||guideOrCamera();}
 function sync(){toggle.hidden=guideOrCamera();toggle.setAttribute('aria-pressed',String(completed));toggle.setAttribute('aria-label',completed?'Show construction progress':'Show completed set');toggle.title=completed?'Completed set · show progress':'Construction progress · show completed set';status.textContent=api.state.mode==='cameras'?'':completed?'Completed set':tracking?'Construction progress':'Progress unavailable';status.hidden=guideOrCamera();api.invalidate();}
 toggle.onclick=()=>{completed=!completed;sync();window.dispatchEvent(new Event('studio-view-changed'));};
 function accept(data,nextRevision){if(nextRevision!==undefined&&nextRevision<revision)return;tracking=projectUpgradeTracking(data);if(nextRevision!==undefined)revision=nextRevision;sync();window.dispatchEvent(new CustomEvent('project-tracking-loaded',{detail:tracking}));}
 async function refresh(){if(loading||disposed)return;loading=true;const version=generation;try{const r=await fetch('/api/project/tracking',{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Progress unavailable');const data=await r.json();if(version===generation)accept(data.data,data.revision);}catch{if(!tracking){status.textContent='Progress unavailable';status.title='Could not load saved progress. Unconfirmed parts remain gray.';}}finally{loading=false;}}
 window.addEventListener('project-tracking-changed',e=>{generation++;revision=-1;accept(e.detail);});
 window.addEventListener('studio-view-changed',()=>{toggle.hidden=guideOrCamera();status.hidden=guideOrCamera();});
 const baseMode=api.setMode;api.setMode=m=>{const result=baseMode(m);sync();return result;};document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>api.setMode(b.dataset.mode));
 function inheritedPanel(o){for(let p=o;p;p=p.parent)if(p.userData.progressPanel!==undefined)return p.userData.progressPanel;return 0;}
 function finishMaterial(base,part,result){const ghost=!result.assembled,finish=result.finish||'base',key=base.uuid+':'+part.kind+':'+(ghost?'ghost':finish);if(!watched.has(base)){watched.add(base);base.addEventListener('dispose',()=>{for(const [k,m]of materials)if(k.startsWith(base.uuid+':')){m.dispose();materials.delete(k);}});}let m=materials.get(key);if(!m){m=base.clone();materials.set(key,m);}
  const oldMap=m.map,oldTransparent=m.transparent;m.copy(base);
  if(ghost){m.color.set('#929c96');m.map=null;m.vertexColors=false;m.emissive?.set(0);m.opacity=Math.min(.16,base.opacity);m.transparent=true;m.depthWrite=false;m.side=THREE.DoubleSide;}
  else if(finish==='raw'&&(part.kind==='wallSkin'||part.kind==='floor'&&api.state.floor==='charcoal')){const raw=part.kind==='wallSkin'?mats.wallRaw:mats.ply;m.color.copy(raw.color);m.map=raw.map;}
  else if(finish==='seams'&&part.kind==='wallSkin'){m.color.set(0xffffff);m.map=(api.state.height===120?mats.wallSeams10:mats.wallSeams8).map;m.roughness=1;}
  else if(finish==='paint'&&!(part.kind==='floor'&&api.state.floor==='wood')){m.map=null;m.color.copy(part.kind==='wallSkin'?mats.charcoal.color:part.kind==='platform'?mats.platform.color:mats.floorGray.color);}
  else if(finish==='primer'||finish==='skim'){m.map=null;m.color.set(finish==='primer'?'#e3e0d8':'#cfcbc0');}
  if(oldMap!==m.map||oldTransparent!==m.transparent)m.needsUpdate=true;
  return m;
 }
 api.scene.onBeforeRender=function(...args){originalBefore?.apply(this,args);restored=[];const active=!mode();
  // Visibility is set before WebGLRenderer builds its render list.
  api.scene.traverse(o=>{if(o.userData.progressOnly||o.userData.completeOnly){restored.push([o,'visible',o.visible]);o.visible=o.userData.progressOnly?active:!active;}});
  if(!active)return;
  api.scene.traverseVisible(o=>{if(!o.isMesh||!o.material||Array.isArray(o.material)||o.userData.guideDecoration)return;let part=o.userData.progress;
   if(!part&&o.name==='Floor')part={kind:'floor'};
   if(!part)return;part={...part,panel:part.panel??inheritedPanel(o)};
   const preview=o.userData.wallFinishPreview&&['build','pricing'].includes(api.state.mode),result=preview?{assembled:true,finish:o.userData.wallFinishPreview}:projectPartStatus(part,tracking),base=o.material;
   restored.push([o,'material',base],[o,'castShadow',o.castShadow],[o,'receiveShadow',o.receiveShadow]);o.material=finishMaterial(base,part,result);if(!result.assembled)o.castShadow=o.receiveShadow=false;
  });
 };
 api.scene.onAfterRender=function(...args){for(let i=restored.length-1;i>=0;i--){const [o,key,value]=restored[i];o[key]=value;}restored=[];originalAfter?.apply(this,args);};
 const timer=setInterval(()=>{if(!document.hidden)refresh();},30000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 window.addEventListener('pagehide',()=>{disposed=true;clearInterval(timer);for(const m of materials.values())m.dispose();materials.clear();},{once:true});
 api.constructionView={get completed(){return mode();},get tracking(){return tracking;},refresh};sync();refresh();
}
