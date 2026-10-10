import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../public/opening-view.js',import.meta.url),'utf8').replace("import * as THREE from 'three';",'');
const {fitSetCamera}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('Opening camera fits all bounding corners on portrait, landscape and desktop viewports',()=>{
 for(const aspect of [.45,.75,1,1.8,2.6])for(const width of [5,8,11]){
 const b={min:[-width/2,0,-1.5],max:[width/2,4,4]},shot=fitSetCamera(b,aspect,38),back=shot.position.map((n,i)=>(n-shot.target[i])/shot.distance),n=Math.hypot(back[2],back[0]),right=[back[2]/n,0,-back[0]/n],up=[back[1]*right[2],back[2]*right[0]-back[0]*right[2],-back[1]*right[0]],dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0),tan=Math.tan(38*Math.PI/360);
 for(const x of [b.min[0],b.max[0]])for(const y of [0,4])for(const z of [-1.5,4]){const v=[x,y,z].map((q,i)=>q-shot.target[i]),depth=shot.distance-dot(v,back);assert.ok(Math.abs(dot(v,right))/(depth*tan*aspect)<=.820001);assert.ok(Math.abs(dot(v,up))/(depth*tan)<=.820001);}
 }
});
