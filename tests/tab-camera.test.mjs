import test from 'node:test';import assert from 'node:assert/strict';
import {installTabCamera} from '../public/tab-camera.js';

const vec=()=>{const v={x:0,y:0,z:0,toArray:()=>[v.x,v.y,v.z],fromArray:a=>{[v.x,v.y,v.z]=a;return v;}};return v;};
function fakeApi(){
 const api={state:{mode:'finished'},camera:{position:vec(),far:60,lookAt(){},updateProjectionMatrix(){}},orbit:{target:vec(),minDistance:1.4,maxDistance:22,enableDamping:true,update(){}},invalidate(){}};
 let lensOn=false;api.lens={get:()=>({on:lensOn,mm:35,ratio:'16:9'}),set:n=>{if(n.on!==undefined)lensOn=n.on;}};
 // Like the real modes: entering a tab reframes unless that tab already has a remembered camera.
 api.setMode=m=>{api.state.mode=m;if(!api.hasTabCamera(m)){api.camera.position.fromArray({finished:[0,2,6],build:[1,4,7],pricing:[0,3,8],cameras:[2,2,6]}[m]);api.orbit.target.fromArray([0,1,0]);}if(m==='cameras')api.lens.set({on:true});};
 installTabCamera(api);return api;
}

test('Switching tabs never moves the camera; each tab restores where it was left',()=>{
 const api=fakeApi();api.camera.position.fromArray([0,2,6]);
 api.camera.position.fromArray([3,1,4]);api.orbit.target.fromArray([.5,1,0]);
 api.setMode('pricing');assert.deepEqual(api.camera.position.toArray(),[0,3,8]);
 api.camera.position.fromArray([-2,2,5]);
 api.setMode('finished');assert.deepEqual(api.camera.position.toArray(),[3,1,4]);assert.deepEqual(api.orbit.target.toArray(),[.5,1,0]);
 api.setMode('pricing');assert.deepEqual(api.camera.position.toArray(),[-2,2,5]);
 api.setMode('pricing');assert.deepEqual(api.camera.position.toArray(),[-2,2,5]);
});

test('The Camera positions lens does not follow you back into Explore',()=>{
 const api=fakeApi();
 api.setMode('cameras');assert.equal(api.lens.get().on,true);
 api.setMode('finished');assert.equal(api.lens.get().on,false);
 api.setMode('cameras');assert.equal(api.lens.get().on,true);
});
