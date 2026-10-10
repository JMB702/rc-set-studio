import * as THREE from 'three';

// Fit every corner against both viewport axes, including depth perspective.
export function fitSetCamera(bounds,aspect,fov,direction=[.32,.23,1]){
 const target=bounds.min.map((n,i)=>(n+bounds.max[i])/2),normalize=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);},dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0),back=normalize(direction),right=normalize([back[2],0,-back[0]]),up=[back[1]*right[2],back[2]*right[0]-back[0]*right[2],-back[1]*right[0]],tan=Math.tan(fov*Math.PI/360),margin=.82;
 let distance=1.4;
 for(const x of [bounds.min[0],bounds.max[0]])for(const y of [bounds.min[1],bounds.max[1]])for(const z of [bounds.min[2],bounds.max[2]]){const p=[x-target[0],y-target[1],z-target[2]],depth=dot(p,back);distance=Math.max(distance,depth+Math.abs(dot(p,right))/(tan*aspect*margin),depth+Math.abs(dot(p,up))/(tan*margin));}
 return {target,position:target.map((n,i)=>n+back[i]*distance),distance};
}
export function installOpeningView(api){
 let frame=0,started=0,interacted=false,finished=false,from,to;const viewport=document.querySelector('#canvas-wrap');
 const bounds=()=>{const box=new THREE.Box3().setFromObject(api.getSet());box.union(new THREE.Box3().setFromObject(api.getFloor()));return {min:box.min.toArray(),max:box.max.toArray()};};
 function apply(position,target){api.camera.position.fromArray(position);api.orbit.target.fromArray(target);api.camera.lookAt(api.orbit.target);api.invalidate();}
 function stop(){interacted=true;cancelAnimationFrame(frame);api.cameraAnimating=false;api.orbit.enableDamping=true;}
 function destination(){const rect=viewport.getBoundingClientRect();return fitSetCamera(bounds(),Math.max(1,rect.width)/Math.max(1,rect.height),38);}
 function settle(){to=destination();api.orbit.maxDistance=Math.max(22,to.distance*1.2);apply(to.position,to.target);}
 function start(){if(interacted||!['finished','pricing'].includes(api.state.mode))return;api.lens.set({on:false});to=destination();api.orbit.maxDistance=Math.max(22,to.distance*1.2);api.orbit.enableDamping=false;api.orbit.update();const front=fitSetCamera(bounds(),api.camera.aspect,38,[0,.12,1]);from=front.position.map((n,i)=>front.target[i]+(n-front.target[i])*.88);api.cameraAnimating=true;started=performance.now();
  const duration=matchMedia('(prefers-reduced-motion:reduce)').matches?0:1500;
  function tick(now){const p=duration?Math.min(1,(now-started)/duration):1,t=p*p*(3-2*p);apply(from.map((n,i)=>n+(to.position[i]-n)*t),to.target);if(p<1)frame=requestAnimationFrame(tick);else{finished=true;api.cameraAnimating=false;api.orbit.enableDamping=true;}}
  tick(started);
 }
 for(const event of ['pointerdown','wheel','keydown'])document.addEventListener(event,stop,{capture:true,passive:true});
 function refit(){if(interacted||!to)return;if(finished)settle();else{to=destination();api.orbit.maxDistance=Math.max(22,to.distance*1.2);}}
 new ResizeObserver(refit).observe(viewport);window.addEventListener('set-configured',refit);
 window.addEventListener('pagehide',stop,{once:true});
 Promise.resolve(api.workspaceReady).then(()=>api.pricingReady).catch(()=>{}).then(()=>requestAnimationFrame(()=>requestAnimationFrame(start)));
}
