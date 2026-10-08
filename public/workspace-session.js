import {saveWorkspace} from './workspace-state.js';

export function installWorkspaceSession(api,saved){
  let restoring=!!saved,timer,interacted=false;
  const controls=document.querySelector('.controls');
  function capture(){return {version:1,jackViewRevision:1,mode:api.state.mode,design:api.state,stage:api.getGuideStage(),camera:{position:api.camera.position.toArray(),target:api.orbit.target.toArray(),...api.lens.get()},scrollY:window.scrollY,panelScroll:controls.scrollTop,openDetails:[...document.querySelectorAll('details[id][open]')].map(d=>d.id)};}
  function persist(){if(restoring)return;clearTimeout(timer);saveWorkspace(capture());}
  function soon(){if(restoring)return;clearTimeout(timer);timer=setTimeout(persist,120);}
  // Mode changes and every guide step save immediately; camera/scroll updates are batched.
  const baseMode=api.setMode;api.setMode=m=>{const result=baseMode(m);persist();return result;};
  for(const event of ['studio-view-changed','set-configured','surface-color-changed'])window.addEventListener(event,persist);
  window.addEventListener('camera-lens-changed',()=>api.cameraAnimating?soon():persist());
  api.orbit.addEventListener('change',soon);
  window.addEventListener('scroll',soon,{passive:true});controls.addEventListener('scroll',soon,{passive:true});
  document.addEventListener('toggle',soon,true);
  for(const type of ['pointerdown','keydown','input'])document.addEventListener(type,()=>{if(restoring){interacted=true;restoring=false;}soon();},{capture:true,passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persist();});
  window.addEventListener('pagehide',persist);
  // No unload handler: Safari can keep this page in its back/forward cache.
  if(!saved)return;
  if('scrollRestoration' in history)history.scrollRestoration='manual';
  api.restoreGuideStage(saved.stage);api.setMode(saved.mode);
  const ready=saved.mode==='pricing'?api.pricingReady:Promise.resolve();
  Promise.resolve(ready).catch(()=>{}).then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(interacted)return;
    for(const id of saved.openDetails){const el=document.getElementById(id);if(el?.tagName==='DETAILS')el.open=true;}
    if(saved.camera){const c=saved.camera,damping=api.orbit.enableDamping;api.orbit.enableDamping=false;api.orbit.update();api.lens.set({mm:c.mm,ratio:c.ratio,on:c.on});api.camera.position.fromArray(c.position);api.orbit.target.fromArray(c.target);api.camera.lookAt(api.orbit.target);const distance=Math.hypot(...c.position.map((n,i)=>n-c.target[i]));if(Number.isFinite(api.orbit.minDistance))api.orbit.minDistance=Math.min(api.orbit.minDistance,distance);if(Number.isFinite(api.orbit.maxDistance))api.orbit.maxDistance=Math.max(api.orbit.maxDistance,distance);api.orbit.enableDamping=damping;api.invalidate();}
    window.scrollTo(0,saved.scrollY);controls.scrollTop=saved.panelScroll;
    restoring=false;persist();
  })));
}
