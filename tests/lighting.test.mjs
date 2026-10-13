import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultLightingRig,normalizeLightingRig} from '../public/lighting-state.js';
import {normalizeCameraShot,cameraShotChanged} from '../public/camera-state.js';
const shot=()=>({version:1,position:[0,2,7],target:[0,1,1],mm:35,ratio:'16:9'});
test('soft three-point rig round trips without mutating source',()=>{const r=defaultLightingRig(),n=normalizeLightingRig(r);assert.deepEqual(n,r);n.lights[0].position[0]=5;assert.notEqual(n.lights[0].position[0],r.lights[0].position[0]);assert.equal(r.lights.length,3);assert(r.lights.every(l=>l.type==='diffuse'));});
test('camera shots preserve lighting, old shots remain valid, lighting edits mark changed',()=>{assert.deepEqual(normalizeCameraShot(shot()),shot());const current=normalizeCameraShot({...shot(),lighting:defaultLightingRig()});assert.equal(cameraShotChanged({name:'Wide',shot:current},structuredClone(current),'Wide'),false);const changed=structuredClone(current);changed.lighting.lights[0].edge=0;assert.equal(cameraShotChanged({name:'Wide',shot:current},changed,'Wide'),true);assert.deepEqual(normalizeCameraShot(current).lighting,current.lighting);});
test('light validation rejects malformed and excessive input, accepts empty and boundary rigs',()=>{const mutate=fn=>{const r=defaultLightingRig();fn(r);assert.throws(()=>normalizeLightingRig(r));};mutate(r=>r.lights[0].position[0]=NaN);mutate(r=>r.lights[0].position=r.lights[0].target);mutate(r=>r.lights[0].width=0);mutate(r=>r.lights[0].edge=101);mutate(r=>r.lights[0].name='');mutate(r=>r.lights[0].color='red');mutate(r=>r.lights.push(r.lights[0]));mutate(r=>r.lights=Array(7).fill(r.lights[0]));assert.deepEqual(normalizeLightingRig({version:1,lights:[]}),{version:1,lights:[]});});

test('subject controls keep rotation, height and horizontal distance independent',async()=>{
 const {subjectCoordinates,subjectPoint}=await import('../public/lighting-state.js');const subject=[1,.254,1.2192],point=[-2,2.6,3.1],c=subjectCoordinates(point,subject);
 const back=subjectPoint(c,subject);back.forEach((v,i)=>assert.ok(Math.abs(v-point[i])<1e-10));
 for(const rotation of [-180,-90,0,90,180]){const p=subjectPoint({...c,rotation},subject);assert.ok(Math.abs(p[1]-point[1])<1e-10);assert.ok(Math.abs(Math.hypot(p[0]-subject[0],p[2]-subject[2])-c.distance)<1e-10);}
 const raised=subjectPoint({...c,height:4},subject);assert.equal(raised[1],4.254);assert.ok(Math.abs(raised[0]-point[0])<1e-10);assert.ok(Math.abs(raised[2]-point[2])<1e-10);
 assert.deepEqual(subjectPoint({rotation:0,height:2,distance:3},subject),[1,2.254,4.2192]);
 assert.equal(subjectCoordinates(subject,subject,75).rotation,75);
 const aim=subjectPoint({rotation:75,height:1.4,distance:0},subject);assert.equal(aim[0],subject[0]);assert.equal(aim[2],subject[2]);
});
