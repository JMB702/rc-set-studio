import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from '../public/vendor/three.module.js';
test('Selecting and clearing a cut row changes only the matching material, not layout or camera',async()=>{
 const handlers={},button={setAttribute(){},title:''},row={dataset:{cutFamily:'panel',cutPart:'Outer stiles'},classList:{add(){},remove(){}},querySelector:()=>button};
 const list={addEventListener:(k,f)=>handlers[k]=f,querySelectorAll:()=>[row]},details={addEventListener(){}};
 globalThis.document={querySelector:s=>s==='#cut-list'?list:details,querySelectorAll:()=>[],addEventListener(){}};globalThis.window={addEventListener(){}};
 const scene=new T.Scene(),group=new T.Group(),mat=new T.MeshStandardMaterial(),stile=new T.Mesh(new T.BoxGeometry(1,10,1),mat),rail=new T.Mesh(new T.BoxGeometry(4,1,1),mat);stile.name='Left stile';rail.name='Top rail';stile.position.set(5,6,7);group.rotation.x=.7;group.add(stile,rail);scene.add(group);const camera=new T.PerspectiveCamera();camera.position.set(8,9,10);
 let source=fs.readFileSync(new URL('../public/cut-preview.js',import.meta.url),'utf8').replace("'three'",JSON.stringify(new URL('../public/vendor/three.module.js',import.meta.url).href)).replace("'./cut-selection.js'",JSON.stringify(new URL('../public/cut-selection.js',import.meta.url).href));
 const {installCutPreview}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));installCutPreview({scene,camera,invalidate(){},setMode(){},setStep(){}});
 const click=()=>handlers.click({target:{closest:()=>row}});click();assert.notEqual(stile.material,mat);assert.equal(rail.material,mat);assert.deepEqual(stile.position.toArray(),[5,6,7]);assert.deepEqual(camera.position.toArray(),[8,9,10]);assert.equal(group.rotation.x,.7);assert.equal(group.children.length,2);assert.equal(group.visible,true);click();assert.equal(stile.material,mat);delete globalThis.document;delete globalThis.window;
});
