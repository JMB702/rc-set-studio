// Cost projection and tracking share the viewer, but never isolate priced parts.
export function pricingIsolationAllowed(mode,projectTab){
 return mode==='pricing'&&projectTab==='pricing';
}

// OrbitControls owns pointer capture. Watch the whole gesture, not just its endpoint:
// a drag can loop back to its start, and a pinch must never become a material tap.
export function installCanvasTap(canvas,{enabled,onTap,tolerance=5}){
 const pointers=new Set();let candidate=null;
 const reset=()=>{candidate=null;pointers.clear();};
 const down=e=>{
  pointers.add(e.pointerId);
  if(pointers.size!==1||e.isPrimary===false||e.button!==0||!enabled()){candidate=null;return;}
  candidate={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};
 };
 const move=e=>{if(candidate?.id===e.pointerId&&Math.hypot(e.clientX-candidate.x,e.clientY-candidate.y)>tolerance)candidate.moved=true;};
 const up=e=>{
  move(e);const tap=candidate;pointers.delete(e.pointerId);
  if(tap?.id!==e.pointerId)return;
  candidate=null;
  if(!tap.moved&&pointers.size===0&&enabled())onTap(e);
 };
 const cancel=e=>{pointers.delete(e.pointerId);candidate=null;};
 const handlers={pointerdown:down,pointermove:move,pointerup:up,pointercancel:cancel};
 for(const [name,handler]of Object.entries(handlers))canvas.addEventListener(name,handler);
 return {reset,dispose(){reset();for(const [name,handler]of Object.entries(handlers))canvas.removeEventListener(name,handler);}};
}
