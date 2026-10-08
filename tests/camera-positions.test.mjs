import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import * as T from '../public/vendor/three.module.js';
import {normalizeCameraShot,interpolateCameraShot,cameraPolarLimit} from '../public/camera-state.js';
import {createCameraMotion} from '../public/camera-motion.js';
const a={version:1,position:[.7123456789,3.25,9.87654321],target:[0,1.4,.7],mm:35,ratio:'16:9'};
const b={version:1,position:[-8,4,-10],target:[1,1.8,.2],mm:85,ratio:'9:16'};
test('Camera snapshots preserve full coordinate precision and reject invalid views',()=>{
 assert.deepEqual(normalizeCameraShot(JSON.parse(JSON.stringify(a))),a);
 for(const patch of [{version:2},{position:[NaN,2,3]},{position:[1,2]},{position:[0,1.4,.7]},{position:[0,1.4,50]},{target:[Infinity,0,0]},{mm:201},{mm:0},{ratio:'square'}])assert.throws(()=>normalizeCameraShot({...a,...patch}));
});
test('Camera moves retain exact endpoints and avoid collapsing through the target',()=>{
 assert.deepEqual(interpolateCameraShot(a,b,0),a);assert.deepEqual(interpolateCameraShot(a,b,1),b);
 for(let t=.05;t<1;t+=.05){const shot=interpolateCameraShot(a,b,t);normalizeCameraShot(shot);assert.ok(Math.hypot(...shot.position.map((n,i)=>n-shot.target[i]))>9);}
 const nearA={...a,position:[.01,3,-10]},nearB={...a,position:[-.01,3,-10]};
 assert.ok(interpolateCameraShot(nearA,nearB,.5).position[2]<-9,'takes short path across the azimuth seam');
});
function rig(reduced=false){let time=0,next=0;const frames=new Map(),camera=new T.PerspectiveCamera();camera.position.fromArray(a.position);const orbit={target:new T.Vector3().fromArray(a.target),enableDamping:true,update(){}};let lens={mm:a.mm,ratio:a.ratio};const api={camera,orbit,lens:{get:()=>lens,set:s=>{lens={mm:s.mm,ratio:s.ratio};}},invalidate(){}};
 const motion=createCameraMotion(api,{requestFrame:fn=>{frames.set(++next,fn);return next;},cancelFrame:id=>frames.delete(id),now:()=>time,reducedMotion:()=>reduced});
 return {api,motion,tick(t){time=t;const jobs=[...frames.values()];frames.clear();jobs.forEach(f=>f(t));},frames};
}
test('Animated recall settles exactly, restores damping, and reduced motion is immediate',()=>{
 for(const reduced of [false,true]){const r=rig(reduced);let done;r.motion.move(b,result=>done=result);if(!reduced){assert.equal(r.api.cameraAnimating,true);r.tick(450);assert.notDeepEqual(r.motion.snapshot(),b);r.tick(1000);}assert.deepEqual(r.motion.snapshot(),b);assert.equal(done,true);assert.equal(r.api.cameraAnimating,false);assert.equal(r.api.orbit.enableDamping,true);assert.equal(r.frames.size,0);}
});
test('Interrupting or selecting a different shot cancels stale animation callbacks',()=>{
 const r=rig();let first;r.motion.move(b,result=>first=result);r.tick(400);const partial=r.motion.snapshot();r.motion.stop();assert.equal(first,false);r.tick(800);assert.deepEqual(r.motion.snapshot(),partial);r.motion.move(a);r.tick(1200);r.motion.move(b);r.tick(2200);assert.deepEqual(r.motion.snapshot(),b);assert.equal(r.frames.size,0);
});
const helpers=['pricing-config','camera-state'].map(name=>fs.readFileSync(new URL('../public/'+name+'.js',import.meta.url),'utf8').replaceAll('export function ','function ')).join('\n');
const worker=fs.readFileSync(new URL('../worker/index.js',import.meta.url),'utf8');
const api=(await import('data:text/javascript;base64,'+Buffer.from('const assets={};\n'+helpers+'\n'+worker).toString('base64'))).default;
function database(){const sqlite=new DatabaseSync(':memory:');for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 return {sqlite,DB:{prepare(sql){const statement=sqlite.prepare(sql);let args=[];return {bind(...values){args=values;return this;},async first(){return statement.get(...args)||null;},async all(){return {results:statement.all(...args)};},async run(){return {meta:statement.run(...args)};}};}}};}
const id='43d6ed9a-6b19-498f-870c-a9e272ce1b01';
function request(method,body,origin='https://example.com'){return new Request('https://example.com/api/camera-positions',{method,headers:{'Content-Type':'application/json',Origin:origin},...(body!==undefined?{body:JSON.stringify(body)}:{})});}
test('Camera API persists precision, names and lenses, with idempotent saves and safe concurrent edits',async()=>{
 const env=database();try{
 const payload={id,name:'Wide master',shot:a};let res=await api.fetch(request('POST',payload),env);assert.equal(res.status,201);const saved=(await res.json()).position;assert.deepEqual(saved.shot,a);
 assert.equal((await api.fetch(request('POST',payload),env)).status,201);
 let list=await(await api.fetch(request('GET'),env)).json();assert.equal(list.positions.length,1);assert.deepEqual(list.positions[0].shot,a);
 const edit={...payload,name:'Portrait close-up',shot:b,revision:0};res=await api.fetch(request('PATCH',edit),env);assert.equal(res.status,200);const updated=(await res.json()).position;assert.equal(updated.revision,1);assert.equal(updated.createdAt,saved.createdAt);assert.deepEqual(updated.shot,b);
 assert.equal((await api.fetch(request('PATCH',edit),env)).status,200,'safe retry');assert.equal((await api.fetch(request('PATCH',{...edit,name:'Stale edit'}),env)).status,409);
 list=await(await api.fetch(request('GET'),env)).json();assert.equal(list.positions[0].name,edit.name);assert.deepEqual(list.positions[0].shot,b);
 }finally{env.sqlite.close();}
});
test('Camera API rejects invalid input, cross-origin writes and missing update targets',async()=>{
 const env=database();try{for(const body of [null,{}, {id,name:'',shot:a},{id,name:'Wide',shot:{...a,mm:NaN}}])assert.equal((await api.fetch(request('POST',body),env)).status,400);
 assert.equal((await api.fetch(request('POST',{id,name:'Wide',shot:a},'https://other.com'),env)).status,403);
 assert.equal((await api.fetch(request('PATCH',{id,name:'Wide',shot:a,revision:0}),env)).status,404);
 assert.equal((await api.fetch(request('POST',{id,name:'x'.repeat(4100),shot:a}),env)).status,413);
 assert.equal((await api.fetch(request('PUT'),env)).status,405);
 }finally{env.sqlite.close();}
});

test('Real OrbitControls retains the restored camera and target after animation ends',async()=>{
 const source=fs.readFileSync(new URL('../public/vendor/OrbitControls.js',import.meta.url),'utf8').replace("'three'",JSON.stringify(new URL('../public/vendor/three.module.js',import.meta.url).href));
 const {OrbitControls}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const r=rig(true);r.api.orbit=new OrbitControls(r.api.camera,null);r.api.orbit.target.fromArray(a.target);r.api.orbit.minDistance=1.4;r.api.orbit.maxDistance=45;r.api.orbit.maxPolarAngle=cameraPolarLimit('cameras');r.api.orbit.enableDamping=true;
 const low={...b,position:[1,.15,4]};r.motion.move(low);for(let i=0;i<10;i++)r.api.orbit.update();const actual=r.motion.snapshot();
 for(const key of ['position','target'])for(let i=0;i<3;i++)assert.ok(Math.abs(actual[key][i]-low[key][i])<1e-12);
 assert.equal(actual.mm,b.mm);assert.equal(actual.ratio,b.ratio);
});


test('Deleted angles disappear across clients and can be restored with their exact saved view',async()=>{
 const env=database();try{
  await api.fetch(request('POST',{id,name:'Wide master',shot:a}),env);
  const remove={id,revision:0};let res=await api.fetch(request('DELETE',remove),env);assert.equal(res.status,200);
  let saved=(await res.json()).position;assert.ok(saved.deletedAt);assert.equal(saved.revision,1);assert.deepEqual(saved.shot,a);
  assert.equal((await api.fetch(request('DELETE',remove),env)).status,200,'lost response retry');
  let list=await(await api.fetch(request('GET'),env)).json();assert.equal(list.positions.length,0);assert.equal(list.deletedPositions.length,1);
  assert.equal((await api.fetch(request('PATCH',{id,revision:1,name:'Deleted edit',shot:b}),env)).status,409);
  assert.equal((await api.fetch(request('POST',{id,name:'Wide master',shot:a}),env)).status,409,'create retry never resurrects a deleted shot');
  const restore={id,revision:1,restore:true};res=await api.fetch(request('PATCH',restore),env);assert.equal(res.status,200);saved=(await res.json()).position;assert.equal(saved.deletedAt,null);assert.equal(saved.revision,2);assert.deepEqual(saved.shot,a);
  assert.equal((await api.fetch(request('PATCH',restore),env)).status,200);
  list=await(await api.fetch(request('GET'),env)).json();assert.equal(list.positions.length,1);assert.equal(list.deletedPositions.length,0);
  assert.equal((await api.fetch(request('DELETE',remove),env)).status,409,'stale deletion cannot delete a restored view');
 }finally{env.sqlite.close();}
});
test('Deletion rejects stale revisions, unknown IDs and cross-origin requests',async()=>{
 const env=database();try{
  await api.fetch(request('POST',{id,name:'Wide',shot:a}),env);
  await api.fetch(request('PATCH',{id,revision:0,name:'Newer angle',shot:b}),env);
  assert.equal((await api.fetch(request('DELETE',{id,revision:0}),env)).status,409);
  assert.equal((await api.fetch(request('DELETE',{id,revision:1},'https://other.com'),env)).status,403);
  assert.equal((await api.fetch(request('DELETE',{id}),env)).status,400);
  assert.equal((await api.fetch(request('DELETE',{id:'43d6ed9a-6b19-498f-870c-a9e272ce1b02',revision:0}),env)).status,404);
  const list=await(await api.fetch(request('GET'),env)).json();assert.equal(list.positions[0].name,'Newer angle');assert.deepEqual(list.positions[0].shot,b);
 }finally{env.sqlite.close();}
});

test('Update selected only enables for real differences and disables again at the saved shot',async()=>{
 const {cameraShotChanged}=await import('../public/camera-state.js');const saved={name:'Wide master',shot:a};
 assert.equal(cameraShotChanged(null,a,'Wide master'),false);
 assert.equal(cameraShotChanged(saved,structuredClone(a),'Wide master'),false);
 assert.equal(cameraShotChanged(saved,{...a,position:a.position.map(n=>n+1e-12)},'Wide master'),false);
 for(const shot of [{...a,position:[a.position[0]+.01,...a.position.slice(1)]},{...a,target:[.01,...a.target.slice(1)]},{...a,mm:50},{...a,ratio:'9:16'}])assert.equal(cameraShotChanged(saved,shot,saved.name),true);
 assert.equal(cameraShotChanged(saved,a,'Renamed'),true);assert.equal(cameraShotChanged(saved,a,' Wide master '),false);
 assert.equal(cameraShotChanged(saved,a,saved.name),false,'returning to the saved state clears dirty status');
});
test('POST camera actions delete and restore without relying on DELETE request bodies',async()=>{
 const env=database();try{
 await api.fetch(request('POST',{id,name:'Wide',shot:a}),env);
 assert.equal((await api.fetch(request('POST',{id,action:'delete'}),env)).status,400);
 assert.equal((await api.fetch(request('POST',{id,revision:0,action:'unknown'}),env)).status,400);
 let res=await api.fetch(request('POST',{id,revision:0,action:'delete'}),env);assert.equal(res.status,200);assert.ok((await res.json()).position.deletedAt);
 assert.equal((await api.fetch(request('POST',{id,revision:0,action:'delete'}),env)).status,200,'retries remain safe');
 let list=await(await api.fetch(request('GET'),env)).json();assert.equal(list.positions.length,0);assert.equal(list.deletedPositions.length,1);
 res=await api.fetch(request('POST',{id,revision:1,action:'restore'}),env);assert.equal(res.status,200);assert.equal((await res.json()).position.deletedAt,null);
 assert.equal((await api.fetch(request('POST',{id,revision:0,action:'delete'}),env)).status,409,'stale clients cannot remove restored angles');
 list=await(await api.fetch(request('GET'),env)).json();assert.equal(list.positions.length,1);assert.deepEqual(list.positions[0].shot,a);
 }finally{env.sqlite.close();}
});


test('Low camera angles save, update, and round-trip through the camera API',async()=>{
 const low={...a,position:[1,.15,4]};assert.ok(low.position[1]<low.target[1]);assert.deepEqual(normalizeCameraShot(low),low);
 assert.equal(cameraPolarLimit('finished'),Math.PI);assert.equal(cameraPolarLimit('cameras'),Math.PI);assert.equal(cameraPolarLimit('build'),Math.PI*.485);assert.equal(cameraPolarLimit('pricing'),Math.PI*.485);
 const env=database();try{
  let response=await api.fetch(request('POST',{id,name:'Low angle',shot:low}),env);assert.equal(response.status,201);assert.deepEqual((await response.json()).position.shot,low);
  const lower={...low,position:[1,.05,4]};response=await api.fetch(request('PATCH',{id,revision:0,name:'Ground angle',shot:lower}),env);assert.equal(response.status,200);
  const list=await(await api.fetch(request('GET'),env)).json();assert.deepEqual(list.positions[0].shot,lower);
  for(let t=0;t<=1;t+=.1)normalizeCameraShot(interpolateCameraShot(a,lower,t));
 }finally{env.sqlite.close();}
});
