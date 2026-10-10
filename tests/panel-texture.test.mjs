import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from '../public/vendor/three.module.js';
const url=name=>new URL('../public/'+name,import.meta.url).href;
const utils=fs.readFileSync(new URL('../public/vendor/BufferGeometryUtils.js',import.meta.url),'utf8').replaceAll("'three'",JSON.stringify(url('vendor/three.module.js')));
let source=fs.readFileSync(new URL('../public/model.js',import.meta.url),'utf8').replaceAll("'three'",JSON.stringify(url('vendor/three.module.js'))).replace("'./vendor/BufferGeometryUtils.js'",JSON.stringify('data:text/javascript;base64,'+Buffer.from(utils).toString('base64')));
for(const name of ['platform.js','jack-attachment.js','jack-layout.js'])source=source.replace("'./"+name+"'",JSON.stringify(url(name)));
const load=T.TextureLoader.prototype.load;T.TextureLoader.prototype.load=path=>{const t=new T.Texture();t.name=path;return t;};let model;
try{model=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));}finally{T.TextureLoader.prototype.load=load;}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function assertVertical(geometry){const p=geometry.attributes.position,uv=geometry.attributes.uv;for(let i=0;i<p.count;i++){close(uv.getX(i),p.getX(i)/(48*model.inch));close(uv.getY(i),p.getY(i)/(96*model.inch));}}
test('Both panel heights and the wide top extension retain vertical veneer grain at sheet scale',()=>{
 for(const h of [96,120]){const p=model.panel(h);for(const name of ['Lower lauan skin',...(h===120?['Upper lauan skin']:[])]){const skin=p.getObjectByName(name);assert.equal(skin.material,model.mats.ply);assertVertical(skin.geometry);const vs=Array.from(skin.geometry.attributes.uv.array).filter((_,i)=>i%2);close(Math.max(...vs)-Math.min(...vs),name.startsWith('Upper')?.25:1);}model.dispose(p);}
});
test('Finished wall backs and front UVs keep the same vertical mapping for unpainted views',()=>{
 const scene=model.finishedSet(120,45);let backs=0,fronts=0,progress=0;scene.traverse(o=>{if(o.userData.paintedSide){assertVertical(o.geometry);if(o.userData.progressOnly)progress++;if(o.userData.paintedSide==='none'){backs++;assert.equal(o.material,model.mats.ply);}else{fronts++;assert.equal(o.material,model.mats.charcoal);assert.equal(o.material.map,null);}}});assert.equal(backs,11);assert.equal(fronts,11);assert.equal(progress,16);model.dispose(scene);
});
test('Plywood has its own pale texture while framing retains pine',()=>{
 assert.match(model.mats.ply.map.name,/lauan-plywood/);assert.match(model.mats.wood.map.name,/pine-framing/);assert.notEqual(model.mats.ply.map,model.mats.wood.map);assert.equal(model.mats.ply.color.getHex(),0xffffff);
});
