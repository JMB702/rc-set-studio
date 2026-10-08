import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWorkspace,readWorkspace,saveWorkspace,workspaceKey} from '../public/workspace-state.js';
import {installWorkspaceSession} from '../public/workspace-session.js';
const design={height:120,angle:60,wallColor:'#34383b',platformShape:'angled',platformAngle:70,platformBack:24,platformSide:18,platformColor:'#34383b',floor:'wood',floorColor:'#34383b',figures:'rap',figureScale:1.1,clothing:{rapper:{shirt:'#112233',pants:'#445566'}}};
const saved={version:1,mode:'build',stage:17,design,scrollY:427,panelScroll:0,openDetails:['cut-details'],camera:{position:[1,2,3],target:[0,1,0],on:false,mm:50,ratio:'16:9'}};
function storage(initial={}){const values=new Map(Object.entries(initial));return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),values};}
test('Workspace preserves each tab, stable build stage, full design, lens and reading position',()=>{
 const store=storage();for(const mode of ['finished','build','pricing','cameras']){assert.equal(saveWorkspace({...saved,mode},store),true);assert.deepEqual(readWorkspace(design,store),{...saved,mode});}
});
test('Legacy guide progress upgrades to the same build stage and dimensions',()=>{
 const store=storage({'rc-set-build-progress-v1':JSON.stringify({height:96,angle:45,floor:'charcoal',platformShape:'none',stage:15})});const result=readWorkspace(design,store);assert.equal(result.mode,'build');assert.equal(result.stage,15);assert.equal(result.design.height,96);assert.equal(result.design.floor,'charcoal');
});
test('Corrupt or inaccessible storage cannot break startup or saving',()=>{
 assert.equal(readWorkspace(design,storage({[workspaceKey]:'oops'})),null);
 const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};assert.equal(readWorkspace(design,denied),null);assert.equal(saveWorkspace(saved,denied),false);
 for(const patch of [{mode:'wrong'},{stage:NaN},{stage:100},{design:{...design,height:999}}])assert.throws(()=>normalizeWorkspace({...saved,...patch}));
 assert.equal(normalizeWorkspace({...saved,camera:{...saved.camera,position:[NaN,0,0]}}).camera,null);
});
test('Stage/mode actions persist before backgrounding; startup restores without overwriting saved state',async()=>{
 const store=storage(),win=new EventTarget(),doc=new EventTarget(),controls=new EventTarget(),raf=[];controls.scrollTop=0;win.scrollY=0;win.scrollTo=(x,y)=>{win.scrollY=y;};doc.querySelector=()=>controls;doc.querySelectorAll=()=>[];doc.getElementById=()=>null;doc.visibilityState='visible';
 const vec=v=>({v:[...v],toArray(){return [...this.v];},fromArray(a){this.v=[...a];return this;}});
 let stage=0;const api={state:{...design,mode:'finished'},getGuideStage:()=>stage,restoreGuideStage:s=>{stage=s;},setMode:m=>{api.state.mode=m;},camera:{position:vec([5,6,7]),lookAt(){}},orbit:Object.assign(new EventTarget(),{target:vec([0,1,0]),enableDamping:true,update(){}}),lens:{get:()=>({mm:35,ratio:'16:9',on:false}),set(){}},invalidate(){}};
 Object.assign(globalThis,{window:win,document:doc,history:{scrollRestoration:'auto'},localStorage:store,requestAnimationFrame:fn=>{raf.push(fn);}});
 try{installWorkspaceSession(api,saved);assert.equal(api.state.mode,'build');assert.equal(stage,17);assert.equal(store.getItem(workspaceKey),null,'initial rendering must not replace saved progress');await new Promise(setImmediate);while(raf.length)raf.shift()();assert.equal(win.scrollY,427);assert.deepEqual(api.camera.position.toArray(),saved.camera.position);
 stage=19;win.dispatchEvent(new Event('studio-view-changed'));assert.equal(readWorkspace(design,store).stage,19);
 api.setMode('cameras');assert.equal(readWorkspace(design,store).mode,'cameras');win.scrollY=611;doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));assert.equal(readWorkspace(design,store).scrollY,611);
 }finally{for(const key of ['window','document','history','localStorage','requestAnimationFrame'])delete globalThis[key];}
});
