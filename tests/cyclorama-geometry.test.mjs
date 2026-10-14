import test from 'node:test';
import assert from 'node:assert/strict';
import {cycloramaPlan,cycloramaPath,cycloramaGaps} from '../public/cyclorama.js';
import {platformPlan} from '../public/platform.js';
import {normalizeDesign,normalizeConfiguration} from '../public/pricing-config.js';
const base={height:120,angle:45,wallColor:'#34383b',floor:'charcoal',platformShape:'square',platformAngle:90,platformBack:12,platformSide:12};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('Optional geometry vanishes cleanly and corners remain floor-height without a perimeter',()=>{
 for(const height of [96,120])for(const angle of [0,1,45,90])for(const seamlessCorners of [false,true])for(const seamlessPerimeter of [false,true]){
  const d={...base,height,angle,seamlessCorners,seamlessPerimeter},p=cycloramaPlan(d);
  assert.equal(p.corners,seamlessCorners&&angle>0?2:0);assert.equal(p.cornerHeight,height-(seamlessPerimeter?24:0));
  for(const key of ['ribCount','skinSheets','ribSheets','skinArea','fasteners'])assert.ok(Number.isFinite(p[key])&&p[key]>=0);
  if(!seamlessPerimeter&&!p.corners)assert.equal(p.ribCount+p.skinSheets+p.ribSheets,0);
 }
});
test('Straight sweeps meet compound corner edges at every floor cross-section',()=>{
 for(const angle of [1,45,90])for(const offset of [0,6,12,24]){
  const path=cycloramaPath({...base,angle,seamlessCorners:true},offset),back=path[0],right=path[1],corner=path.find(p=>p.kind==='corner'&&p.side===1);
  corner.points[0].forEach((v,i)=>close(v,back.points[1][i]));corner.points.at(-1).forEach((v,i)=>close(v,right.points[0][i]));
  close(corner.points[0][1],offset);
 }
});
test('Stage vertices clear the straight toes AND compound finishing envelope at all wing angles',()=>{
 for(let angle=0;angle<=90;angle++)for(const seamlessCorners of [false,true])for(const seamlessPerimeter of [false,true])for(const platformAngle of [angle,90]){
  const d={...base,angle,seamlessCorners,seamlessPerimeter,platformAngle,platformBack:0,platformSide:0},p=cycloramaPlan(d),g=cycloramaGaps(d),pl=platformPlan(angle,0,0,platformAngle,d),a=angle*Math.PI/180;
  const clearance=seamlessPerimeter?32:0;
  for(const [x,z]of pl.outline){assert.ok(z>=clearance-1e-7);assert.ok(-Math.sin(a)*x+Math.cos(a)*z+96*Math.sin(a)>=clearance-1e-7);assert.ok(Math.sin(a)*x+Math.cos(a)*z+96*Math.sin(a)>=clearance-1e-7);
   if(p.corners){const cx=96-p.tangent,R=36-(seamlessPerimeter?32:2);if(x>cx&&z<36&&Math.atan2(x-cx,36-z)<=a)assert.ok(Math.hypot(x-cx,z-36)<=R+1e-7,`${angle}: stage hits corner margin`);if(x< -cx&&z<36&&Math.atan2(-x-cx,36-z)<=a)assert.ok(Math.hypot(x+cx,z-36)<=R+1e-7);}
  }
  assert.ok(g.minimum<=48);assert.equal(d.platformBack,0);
 }
});
test('Stored designs and configurations retain booleans and requested gaps, reject truthy strings',()=>{
 for(const seamlessCorners of [false,true])for(const seamlessPerimeter of [false,true]){
  const d={...base,seamlessCorners,seamlessPerimeter},saved=normalizeDesign(d);assert.equal(saved.seamlessCorners,seamlessCorners);assert.equal(saved.seamlessPerimeter,seamlessPerimeter);assert.equal(saved.platformBack,12);
  const cfg=normalizeConfiguration({...d,version:1,scope:'set',supports:true,ballast:true,finishes:true,excluded:[],customItems:[]});assert.equal(cfg.seamlessPerimeter,seamlessPerimeter);
 }
 assert.equal(normalizeDesign(base).seamlessCorners,false);assert.throws(()=>normalizeDesign({...base,seamlessCorners:'true'}));
});

test('Floor coves trim to the eight-foot footprint at oblique wing ends',()=>{for(let angle=0;angle<=90;angle++)for(const offset of [0,12,24])for(const seg of cycloramaPath({...base,angle,seamlessPerimeter:true,seamlessCorners:true},offset))for(const [x,z]of seg.points)assert.ok(z<=96+1e-7,`${angle}: ${z}`);});
