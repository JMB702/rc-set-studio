// Shared with the Worker: no imports, so the build can inline validation.
export function normalizeCameraShot(input) {
  if(!input || input.version!==1)throw Error('Invalid camera position.');
  const vector=key=>{const v=input[key];if(!Array.isArray(v)||v.length!==3||v.some(n=>!Number.isFinite(n)||Math.abs(n)>1000))throw Error('Invalid camera '+key+'.');return [...v];};
  const position=vector('position'),target=vector('target'),delta=position.map((n,i)=>n-target[i]),distance=Math.hypot(...delta);
  if(distance<1.4-1e-8||distance>45+1e-8)throw Error('Camera position is outside the viewing range.');
  if(!Number.isFinite(input.mm)||input.mm<14||input.mm>200||!['16:9','9:16'].includes(input.ratio))throw Error('Invalid camera lens or aspect ratio.');
  return {version:1,position,target,mm:input.mm,ratio:input.ratio,...(input.lighting===undefined?{}:{lighting:normalizeLightingRig(input.lighting)})};
}

// Travel around the target rather than through it, including opposite views.
export function interpolateCameraShot(from,to,progress) {
  if(progress<=0)return structuredClone(from);
  if(progress>=1)return structuredClone(to);
  const t=progress*progress*(3-2*progress),lerp=(a,b)=>a+(b-a)*t;
  const spherical=shot=>{const [x,y,z]=shot.position.map((n,i)=>n-shot.target[i]),r=Math.hypot(x,y,z);return {r,phi:Math.acos(Math.min(1,Math.max(-1,y/r))),theta:Math.atan2(x,z)};};
  const a=spherical(from),b=spherical(to),turn=Math.atan2(Math.sin(b.theta-a.theta),Math.cos(b.theta-a.theta));
  const r=lerp(a.r,b.r),phi=lerp(a.phi,b.phi),theta=a.theta+turn*t,target=from.target.map((n,i)=>lerp(n,to.target[i]));
  return {version:1,target,position:[r*Math.sin(phi)*Math.sin(theta),r*Math.cos(phi),r*Math.sin(phi)*Math.cos(theta)].map((n,i)=>n+target[i]),mm:lerp(from.mm,to.mm),ratio:to.ratio};
}

// Ignore numeric roundoff from OrbitControls, but detect real changes to a saved shot.
export function cameraShotChanged(saved,current,name) {
  if(!saved||!current)return false;
  if(name.trim()!==saved.name||current.ratio!==saved.shot.ratio)return true;
  if(JSON.stringify(current.lighting)!==JSON.stringify(saved.shot.lighting))return true;
  return Math.abs(current.mm-saved.shot.mm)>1e-6||['position','target'].some(key=>current[key].some((n,i)=>Math.abs(n-saved.shot[key][i])>1e-6));
}

// Shot planning can look up from below its target; build/pricing keep their inspection limit.
export function cameraPolarLimit(mode) {
  return ['finished','cameras'].includes(mode)?Math.PI:Math.PI*.485;
}

export function normalizeLightingRig(raw){
  if(!raw||raw.version!==1||!Array.isArray(raw.lights)||raw.lights.length>6)throw Error('Use up to six lights.');
  const ids=new Set(),number=(n,min,max)=>{if(!Number.isFinite(n)||n<min||n>max)throw Error('Invalid light setting.');return n;};
  const vector=v=>{if(!Array.isArray(v)||v.length!==3)throw Error('Invalid light position.');return v.map(n=>number(n,-15,15));};
  return {version:1,lights:raw.lights.map(l=>{
    if(!l||typeof l.id!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(l.id)||ids.has(l.id)||typeof l.name!=='string'||!l.name.trim()||l.name.length>40||!['diffuse','spot'].includes(l.type)||typeof l.enabled!=='boolean'||!/^#[0-9a-f]{6}$/i.test(l.color))throw Error('Invalid light.');
    ids.add(l.id);const position=vector(l.position),target=vector(l.target);
    if(Math.hypot(...position.map((n,i)=>n-target[i]))<.05)throw Error('Aim away from the light.');
    return {id:l.id,name:l.name.trim(),type:l.type,enabled:l.enabled,position,target,width:number(l.width,.0762,3.6576),height:number(l.height,.0762,3.6576),power:number(l.power,0,200),beam:number(l.beam,10,120),edge:number(l.edge,0,100),roll:number(l.roll,-180,180),color:l.color.toLowerCase()};
  })};
}
