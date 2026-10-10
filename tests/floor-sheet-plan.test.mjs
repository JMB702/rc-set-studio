import test from 'node:test';
import assert from 'node:assert/strict';
import {floorSheetPlan,area} from '../public/platform.js';
test('Floor sheets cover every supported wing angle without overlapping rows or exceeding sheet bounds',()=>{
 for(const angle of [0,15,45,75,90]){
  const {outline,pieces}=floorSheetPlan(angle);
  assert.ok(pieces.length>=4);
  assert.ok(Math.abs(pieces.reduce((sum,p)=>sum+Math.abs(area(p.poly)),0)-Math.abs(area(outline)))<1e-6);
  for(const p of pieces){assert.ok(p.seamEdges.length<=8);for(const [x,z] of p.poly){assert.ok(x>=p.x-1e-6&&x<=p.x+96+1e-6);assert.ok(z>=p.z-1e-6&&z<=p.z+48+1e-6);}}
  const back=pieces.filter(p=>p.row===0).map(p=>p.x),front=pieces.filter(p=>p.row===1).map(p=>p.x);
  for(const x of back)assert.ok(!front.includes(x));
 }
});
