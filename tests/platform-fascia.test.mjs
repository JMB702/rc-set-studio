import test from 'node:test';
import assert from 'node:assert/strict';
import {platformPlan,PLATFORM} from '../public/platform.js';
test('Long fascia spans frames, fits stock with kerf, and keeps butt joints supported',()=>{
 for(const a of [0,15,30,45,60,90])for(const pa of [a,90])for(const gap of [0,12,48]){
  const p=platformPlan(a,gap,gap,pa),f=p.fasciaPieces;
  assert.ok(Math.abs(f.reduce((s,x)=>s+x.length,0)-p.fasciaLength)<1e-6);
  for(const x of f){assert.ok(x.cutLength<=96);assert.ok(x.moduleIndices.length);for(const end of [x.A,x.B])assert.ok(p.modules.some(m=>m.poly.some(v=>Math.hypot(v[0]-end[0],v[1]-end[1])<1e-6)));}
  for(let strip=1;strip<=p.fasciaStrips;strip++){const cuts=f.filter(x=>x.strip===strip);assert.ok(cuts.reduce((s,x)=>s+Math.ceil(x.cutLength*16)/16,0)+(cuts.length-1)*PLATFORM.kerf<=96+1e-6);}
  assert.equal(p.tapeLength,p.deckSeamLength+f.filter(x=>x.joint).length*PLATFORM.height);
 }
 assert.equal(platformPlan(45,12,12,90).fasciaPieces.length,6);
 assert.equal(platformPlan(45,12,12,45).fasciaPieces.length,12);
});
