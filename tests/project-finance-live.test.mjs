import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../public/project.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf(' let financePending=false;'),source.indexOf(' function refreshProject()'));
function harness(request){
 const state={renders:0,errors:[],editing:false,hidden:false};
 const create=new Function('request','state',`let busy=false,dialog={open:false},selected='finance',api={state:{mode:'pricing'}},loadSequence=0,records={finance:{revision:1,data:{}}},access={configured:true,unlocked:true},clockTimer;
 const document={get hidden(){return state.hidden},activeElement:{matches:()=>state.editing}},host={contains:()=>state.editing,querySelector:()=>null};
 const render=()=>state.renders++,error=e=>state.errors.push(e);
 ${code}
 return {refreshFinance,records,localEdit:()=>records.finance={revision:3,data:{}},access:()=>access};`);
 return {...create(request,state),state};
}
test('Finance auto-refresh redraws changed revisions and leaves unchanged data alone',async()=>{
 let revision=2;const h=harness(async path=>path==='access'?{configured:true,unlocked:true}:{revision,data:{}});
 await h.refreshFinance();assert.equal(h.records.finance.revision,2);assert.equal(h.state.renders,1);
 await h.refreshFinance();assert.equal(h.state.renders,1);
 revision=3;h.state.editing=true;await h.refreshFinance();assert.equal(h.records.finance.revision,2);
 h.state.editing=false;await h.refreshFinance();assert.equal(h.records.finance.revision,3);
});
test('A stale poll cannot overwrite a local save, and a locked session clears private data',async()=>{
 let release;const h=harness(path=>path==='access'?Promise.resolve({configured:true,unlocked:true}):new Promise(r=>release=r));
 const pending=h.refreshFinance();await Promise.resolve();h.localEdit();release({revision:2,data:{}});await pending;assert.equal(h.records.finance.revision,3);
 const locked=harness(async()=>({configured:true,unlocked:false}));await locked.refreshFinance();assert.equal(locked.records.finance,undefined);assert.equal(locked.access().unlocked,false);assert.equal(locked.state.renders,1);
});
