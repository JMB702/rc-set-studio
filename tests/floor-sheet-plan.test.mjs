import test from 'node:test';import assert from 'node:assert/strict';
import {floorSheetPlan,area} from '../public/platform.js';
import {floorPlan,FLOOR} from '../public/floor-plan.js';
function intersection(a,b){let out=a;for(const [axis,lo,hi] of [[0,Math.min(...b.map(p=>p[0])),Math.max(...b.map(p=>p[0]))],[1,Math.min(...b.map(p=>p[1])),Math.max(...b.map(p=>p[1]))]]){if(Math.max(...out.map(p=>p[axis]))<=lo+1e-6||Math.min(...out.map(p=>p[axis]))>=hi-1e-6)return false;}return true;}
test('Both layers tile every degree of wing angle inside 48 × 96 stock',()=>{
 for(let angle=0;angle<=90;angle++)for(const floorLip of [false,true])for(const layer of [0,1]){const p=floorSheetPlan(angle,layer,{floorLip});assert.ok(Math.abs(p.pieces.reduce((n,q)=>n+Math.abs(area(q.poly)),0)-Math.abs(area(p.outline)))<1e-5);
 for(const q of p.pieces)for(const [x,z]of q.poly){assert.ok(x>=q.x-1e-6&&x<=q.x+48+1e-6);assert.ok(z>=q.z-1e-6&&z<=q.z+96+1e-6);}
 for(let i=0;i<p.pieces.length;i++)for(let j=i+1;j<p.pieces.length;j++)assert.equal(intersection(p.pieces[i].poly,p.pieces[j].poly),false);
 }
});
test('Top has no crosswise joints, four whole core sheets and lower joints offset 24 inches',()=>{
 for(const a of [0,15,45,75,90])for(const floorLip of [false,true]){let p=floorPlan(a,{floorLip});assert.ok(p.upper.pieces.filter(q=>q.full).length>=4);
 for(const q of p.upper.pieces)for(const [x,z,X,Z]of q.seamEdges)assert.ok(Math.abs(x-X)<1e-6,'top seams run back to front');
 for(const q of p.upper.pieces)for(const l of p.lower.pieces)assert.notEqual(q.x,l.x);
 assert.ok(p.upper.pieces.every(q=>Math.max(...q.poly.map(p=>p[1]))<=96+1e-6));
 }
 assert.equal(floorPlan(90).upper.pieces.length,4);assert.equal(floorPlan(90).topSeamLength,288);
 assert.equal(floorPlan(45).upper.pieces.length,8);assert.equal(floorPlan(45).topSeamLength,576);
});
test('Lip is a continuous lower-sheet projection, with a small rear infill and unchanged top',()=>{
 for(const angle of [0,45,90]){const off=floorPlan(angle),on=floorPlan(angle,{floorLip:true});assert.deepEqual(on.upper.outline,off.upper.outline);assert.equal(on.topSeamLength,off.topSeamLength);assert.ok(on.baseArea>off.baseArea);assert.equal(on.lip,6);
 for(const q of on.lower.pieces.filter(q=>Math.max(...q.poly.map(v=>v[1]))>96)){assert.equal(q.z,6);assert.ok(Math.min(...q.poly.map(v=>v[1]))<96);}
 }
});
test('Packed rectangular blanks fit stock, never overlap and count each piece once',()=>{
 for(let a=0;a<=90;a+=5)for(const floorLip of [false,true]){const p=floorPlan(a,{floorLip}),ids=[];
 for(const sheet of p.sheets){for(const c of sheet.cuts){ids.push(c.piece);assert.ok(c.x>=0&&c.z>=0&&c.x+c.width<=48+1e-6&&c.z+c.depth<=96+1e-6);}
 for(let i=0;i<sheet.cuts.length;i++)for(let j=i+1;j<sheet.cuts.length;j++){const a=sheet.cuts[i],b=sheet.cuts[j];assert.ok(a.x+a.width+FLOOR.kerf<=b.x+1e-6||b.x+b.width+FLOOR.kerf<=a.x+1e-6||a.z+a.depth+FLOOR.kerf<=b.z+1e-6||b.z+b.depth+FLOOR.kerf<=a.z+1e-6);}}
 assert.equal(new Set(ids).size,p.pieces.length);
 }
 assert.equal(floorPlan(90).sheetCount,9);assert.equal(floorPlan(45).sheetCount,14);assert.equal(floorPlan(45,{floorLip:true}).sheetCount,15);
});
