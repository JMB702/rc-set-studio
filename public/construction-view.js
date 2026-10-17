import {applyPlatformSeamTexture,applyFasciaCompound,SKIM_TINT} from './platform-finish.js';
import * as THREE from 'three';
import {mats} from './model.js';
import {projectPartStatus,projectUpgradeTracking} from './project-model.js';

// Temporary render materials leave guide highlights and pricing selections intact underneath.
export function installConstructionView(api){
 const viewport=document.querySelector('.viewport'),toggle=document.createElement('button');toggle.id='construction-view-toggle';toggle.type='button';toggle.setAttribute('aria-pressed','false');
 toggle.innerHTML='<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Z M3 8v8l9 5 9-5V8 M12 13v8"/><path d="m7 5 9 5" stroke-dasharray="2 2"/></svg>';
 viewport.append(toggle);
 // Explore shows the three views as a labeled switch instead of the icon button.
 const switcher=document.createElement('div');switcher.id='view-switch';switcher.setAttribute('role','group');switcher.setAttribute('aria-label','3D view');
 switcher.innerHTML=[['finished','Finished'],['progress','Progress'],['lighting','Lit']].map(([v,t])=>`<button type="button" data-view-mode="${v}" aria-pressed="false">${t}</button>`).join('');viewport.append(switcher);
 const status=document.createElement('span');status.id='construction-view-status';status.setAttribute('role','status');viewport.append(status);
 let statusTimer;
 function announceView(){clearTimeout(statusTimer);status.classList.add('view-notice-visible');statusTimer=setTimeout(()=>status.classList.remove('view-notice-visible'),2600);}
 // Each tab remembers its own view: Explore opens on the finished set, Cost & Tracking on build progress.
 const viewBy={finished:'finished',pricing:'progress'},current=()=>viewBy[api.state.mode]??'progress',setView=v=>{viewBy[api.state.mode==='pricing'?'pricing':'finished']=v;};
 let defaultRig,guideColor=true,tracking=null,revision=-1,materials=new Map(),watched=new WeakSet(),disposed=false,loading=false,generation=0;
 const originalBefore=api.scene.onBeforeRender,originalAfter=api.scene.onAfterRender;let restored=[];
 const views=['progress','finished','lighting'],names={progress:'Build progress',finished:'Finished set',lighting:'Lighting preview'};
 function mode(){return api.state.mode==='cameras'||(api.state.mode==='build'?guideColor:current()!=='progress');}
 const lighting=()=>!['build','cameras'].includes(api.state.mode)&&current()==='lighting';
 function sync(){const color=mode(),build=api.state.mode==='build',explore=api.state.mode==='finished';toggle.hidden=api.state.mode==='cameras'||explore;switcher.hidden=!explore;for(const b of switcher.querySelectorAll?.('[data-view-mode]')??[])b.setAttribute('aria-pressed',String(b.dataset.viewMode===current()));toggle.setAttribute('aria-pressed',String(color));toggle.classList.toggle('lighting-view',lighting());
  const now=build?(color?'This step':'Build progress'):names[current()],next=build?(color?'Build progress':'This step'):names[views[(views.indexOf(current())+1)%3]];toggle.setAttribute('aria-label','Show '+next.toLowerCase());toggle.title=now+' · show '+next.toLowerCase();
  status.textContent=api.state.mode==='cameras'?'':now==='Build progress'&&!tracking?'Progress unavailable':lighting()&&defaultRig===null?'Lighting preview · no default setup':now;status.hidden=api.state.mode==='cameras';api.invalidate();}
 switcher.onclick=e=>{const b=e.target.closest('[data-view-mode]');if(!b)return;setView(b.dataset.viewMode);applyLighting();sync();window.dispatchEvent(new Event('studio-view-changed'));};
 toggle.onclick=()=>{if(api.state.mode==='build')guideColor=!guideColor;else setView(views[(views.indexOf(current())+1)%3]);applyLighting();sync();announceView();window.dispatchEvent(new Event('studio-view-changed'));};
 // Lighting preview lights the finished set with the default saved lighting setup, shared across devices.
 async function loadDefault(){try{const r=await fetch('/api/lighting-setups',{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();defaultRig=(await r.json()).setups.find(s=>s.isDefault)?.rig??null;}catch{defaultRig=null;}}
 async function applyLighting(){if(!lighting()){api.lighting?.preview(null);return;}if(defaultRig===undefined)await loadDefault();if(lighting())api.lighting?.preview(defaultRig);sync();if(defaultRig===null){status.title='Set a default in Camera positions › Lighting controls › Saved setups.';announceView();}}
 window.addEventListener('lighting-default-changed',async()=>{await loadDefault();applyLighting();});
 let seamlessEdited=api.hasRestoredSession===true;window.addEventListener('set-configured',e=>{if(e.detail?.seamlessEdited)seamlessEdited=true;});
 // Keep explicit seamless-option previews visible; completion is guarded until the shared build design matches.
 function pinBuildDesign(){const d=tracking?.design?{floorLip:false,seamlessCornerSide:'both',...tracking.design}:null;if(api.state.mode!=='build'||!d||seamlessEdited&&(['seamlessCorners','seamlessPerimeter','floorLip'].some(k=>(d[k]===true)!==(api.state[k]===true))||d.seamlessCorners===true&&d.seamlessCornerSide!==(api.state.seamlessCornerSide??'both')))return;const changed=Object.entries(d).some(([k,v])=>typeof v==='number'?Math.round(+api.state[k])!==v:api.state[k]!==v);if(changed){api.configure({...d});window.dispatchEvent(new Event('studio-view-changed'));}}
 function accept(data,nextRevision){if(nextRevision!==undefined&&nextRevision<revision)return;tracking=projectUpgradeTracking(data);if(nextRevision!==undefined)revision=nextRevision;pinBuildDesign();sync();window.dispatchEvent(new CustomEvent('project-tracking-loaded',{detail:tracking}));}
 async function refresh(){if(loading||disposed)return;loading=true;const version=generation;try{let data=await window.__rcEarlyTracking?.('construction-view');if(!data){const r=await fetch('/api/project/tracking',{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Progress unavailable');data=await r.json();}if(version===generation)accept(data.data,data.revision);}catch{if(!tracking&&!mode()){status.textContent='Progress unavailable';status.title='Could not load saved progress. Unconfirmed parts remain gray.';}}finally{loading=false;}}
 window.addEventListener('project-tracking-changed',e=>{generation++;revision=-1;accept(e.detail);});
 window.addEventListener('studio-view-changed',()=>{toggle.hidden=api.state.mode==='cameras'||api.state.mode==='finished';switcher.hidden=api.state.mode!=='finished';status.hidden=api.state.mode==='cameras';});
 const baseMode=api.setMode;api.setMode=m=>{const changed=m!==api.state.mode,result=baseMode(m);pinBuildDesign();applyLighting();sync();if(changed)announceView();return result;};document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>api.setMode(b.dataset.mode));
 function inheritedPanel(o){for(let p=o;p;p=p.parent)if(p.userData.progressPanel!==undefined)return p.userData.progressPanel;return 0;}
 // Framing (ribs, added crossbars, backing) keeps its own wood whatever finish the surface it carries has reached.
 function finishMaterial(base,part,result){const ghost=!result.assembled,finish=part.rawOnly||part.framing?'base':result.finish||'base',key=base.uuid+':'+part.kind+':'+(ghost?'ghost':finish)+((finish==='seams'||finish==='skim'&&part.kind==='platform'&&part.stage===35)&&!ghost?':'+JSON.stringify(part.seamEdges||[]):'');if(!watched.has(base)){watched.add(base);base.addEventListener('dispose',()=>{for(const [k,m]of materials)if(k.startsWith(base.uuid+':')){m.dispose();materials.delete(k);}});}let m=materials.get(key);if(!m){m=base.clone();if(!ghost&&(finish==='seams'||finish==='skim'&&part.stage===35)&&part.kind==='platform')part.stage===35?applyFasciaCompound(m,part):applyPlatformSeamTexture(m,part,mats.compound.map,SKIM_TINT);materials.set(key,m);}
  const oldMap=m.map,oldTransparent=m.transparent;m.copy(base);
  if(ghost){m.color.set('#858585');m.map=null;m.vertexColors=false;m.emissive?.set(0);m.opacity=Math.min(.26,base.opacity);m.transparent=true;m.depthWrite=false;m.side=THREE.DoubleSide;}
  // The fascia is spot-finished: once skimmed it is still lauan, with joint compound only at joints and corners.
  else if(part.kind==='platform'&&part.stage>=34&&(finish==='raw'||finish==='seams'||finish==='skim'&&part.stage===35)){const wood=part.stage===34?mats.platformWood:mats.ply;m.map=wood.map;m.color.set(base.userData.sheetColor??wood.color);}
  else if(finish==='raw'&&part.kind==='cyclorama'){m.color.copy(mats.ply.color);m.map=mats.ply.map;}
  else if(finish==='raw'&&(part.kind==='wallSkin'||part.kind==='floor'&&api.state.floor==='charcoal')){const raw=part.kind==='wallSkin'?mats.wallRaw:mats.ply;m.color.copy(raw.color);m.map=raw.map;}
  else if(finish==='seams'&&part.kind==='wallSkin'){m.color.set(0xffffff);m.map=(api.state.height===120?mats.wallSeams10:mats.wallSeams8).map;m.roughness=1;}
  else if(finish==='paint'&&!(part.kind==='floor'&&api.state.floor==='wood')){m.map=null;m.color.copy(part.kind==='wallSkin'||part.kind==='cyclorama'?mats.charcoal.color:part.kind==='platform'?mats.platform.color:mats.floorGray.color);}
  else if(finish==='skim'){m.map=mats.compound.map;if(part.kind==='platform')m.color.copy(mats.skim.color);else m.color.setRGB(1.4,1.4,1.4);m.roughness=1;}
  else if(finish==='primer'){m.map=null;m.color.set('#e3e0d8');}
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
   const preview=o.userData.wallFinishPreview&&api.state.mode==='pricing',result=preview?{assembled:true,finish:o.userData.wallFinishPreview}:projectPartStatus(part,tracking),base=o.material;if(o.userData.guideMaterial&&result.assembled)return;
   restored.push([o,'material',base],[o,'castShadow',o.castShadow],[o,'receiveShadow',o.receiveShadow]);o.material=finishMaterial(base,part,result);if(!result.assembled)o.castShadow=o.receiveShadow=false;
  });
 };
 api.scene.onAfterRender=function(...args){for(let i=restored.length-1;i>=0;i--){const [o,key,value]=restored[i];o[key]=value;}restored=[];originalAfter?.apply(this,args);};
 const timer=setInterval(()=>{if(!document.hidden)refresh();},30000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 window.addEventListener('pagehide',()=>{disposed=true;clearTimeout(statusTimer);clearInterval(timer);for(const m of materials.values())m.dispose();materials.clear();},{once:true});
 api.constructionView={get completed(){return mode();},get tracking(){return tracking;},refresh};sync();refresh();
}
