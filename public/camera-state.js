// Shared with the Worker: no imports, so the build can inline validation.
export function normalizeCameraShot(input) {
  if(!input || input.version!==1)throw Error('Invalid camera position.');
  const vector=key=>{const v=input[key];if(!Array.isArray(v)||v.length!==3||v.some(n=>!Number.isFinite(n)||Math.abs(n)>1000))throw Error('Invalid camera '+key+'.');return [...v];};
  const position=vector('position'),target=vector('target'),delta=position.map((n,i)=>n-target[i]),distance=Math.hypot(...delta);
  if(distance<1.4-1e-8||distance>45+1e-8||delta[1]/distance<Math.cos(Math.PI*.485)-1e-8)throw Error('Camera position is outside the viewing range.');
  if(!Number.isFinite(input.mm)||input.mm<14||input.mm>200||!['16:9','9:16'].includes(input.ratio))throw Error('Invalid camera lens or aspect ratio.');
  return {version:1,position,target,mm:input.mm,ratio:input.ratio};
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
