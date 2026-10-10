import {projectGuideStageDone,projectSetGuideStage} from './project-model.js';
export function installGuideCompletion(api){
 const host=document.createElement('div');host.id='guide-completion';host.innerHTML='<label><input id="guide-step-done" type="checkbox" disabled><span>Mark this step done</span></label><span id="guide-save-status" role="status" aria-live="polite"></span>';
 const dock=document.querySelector('.step-buttons');dock.prepend(host);
 new ResizeObserver(()=>{const height=dock.getBoundingClientRect().height;if(height>0)document.documentElement.style.setProperty('--guide-dock-height',height+'px');}).observe(dock);
 const checkbox=host.querySelector('input'),status=host.querySelector('[role=status]');let data=null,busy=false,loading=false;
 function render(){const step=api.currentGuideStep();checkbox.disabled=busy||!data||step.stage===undefined;checkbox.checked=!!data&&projectGuideStageDone(data,step.stage,api.state);host.querySelector('label span').textContent=checkbox.checked?'Step done':'Mark this step done';checkbox.setAttribute('aria-label','Mark '+(step.title||'this step')+' done');}
 async function read(){const r=await fetch('/api/project/tracking',{signal:AbortSignal.timeout(15000)}),snapshot=await r.json();if(!r.ok)throw Error(snapshot.error||'Could not load project progress.');return snapshot;}
 async function refresh(){if(loading||busy)return;loading=true;try{const snapshot=await read();data=snapshot.data;status.textContent='';render();}catch(e){status.textContent=e.message;}finally{loading=false;}}
 checkbox.onchange=async()=>{const stage=api.currentGuideStep().stage,design={...api.state},done=checkbox.checked;busy=true;checkbox.disabled=true;status.textContent='Saving…';try{
  const snapshot=await read(),next=projectSetGuideStage(snapshot.data,stage,done,design);
  const r=await fetch('/api/project/tracking',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:next,revision:snapshot.revision}),signal:AbortSignal.timeout(15000)}),saved=await r.json();if(!r.ok)throw Error(saved.error||'Could not save this step.');
  data=saved.data;window.dispatchEvent(new CustomEvent('project-tracking-changed',{detail:data}));status.textContent='Saved to Project tracking.';
 }catch(e){status.textContent=e.name==='TimeoutError'?'Save timed out. Refresh before trying again.':e.message;}finally{busy=false;render();}};
 window.addEventListener('studio-view-changed',()=>{status.textContent='';render();if(!data&&api.state.mode==='build')refresh();});
 for(const type of ['project-tracking-changed','project-tracking-loaded'])window.addEventListener(type,e=>{if(!busy){data=e.detail;status.textContent='';render();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&api.state.mode==='build')refresh();});
 render();refresh();
}
