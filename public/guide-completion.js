import {projectGuideStageDone,projectSetGuideStage} from './project-model.js';
export function nextCompletionState(done,autoMark){return autoMark?{done:false,autoMark:false}:done?{done:true,autoMark:true}:{done:true,autoMark:false};}
export function installGuideCompletion(api){
 const host=document.createElement('div');host.id='guide-completion';host.innerHTML='<label><input id="guide-step-done" type="checkbox" disabled><span>Mark this step done</span></label><span id="guide-save-status" role="status" aria-live="polite"></span>';
 const dock=document.querySelector('.step-buttons');dock.prepend(host);
 new ResizeObserver(()=>{const height=dock.getBoundingClientRect().height;if(height>0)document.documentElement.style.setProperty('--guide-dock-height',height+'px');}).observe(dock);
 const checkbox=host.querySelector('input'),status=host.querySelector('[role=status]'),nextButton=document.querySelector('#next'),originalNext=nextButton.onclick;let data=null,busy=false,loading=false,autoMark=false;
 function render(){const step=api.currentGuideStep();checkbox.disabled=busy||!data||step.stage===undefined;checkbox.checked=!!data&&projectGuideStageDone(data,step.stage,api.state);host.classList.toggle('guide-auto-mark',autoMark);host.querySelector('label span').textContent=autoMark?'Auto-mark next steps':checkbox.checked?'Step done':'Mark this step done';checkbox.setAttribute('aria-label','Mark '+(step.title||'this step')+' done');const hint=autoMark?'Next will mark the following step done. Tap again to unmark this step and turn auto-mark off.':checkbox.checked?'Tap again to enable auto-marking when you press Next.':'Tap to mark this step done.';checkbox.setAttribute('aria-description',hint);host.querySelector('label').title=hint;nextButton.disabled=busy;}
 async function read(){const r=await fetch('/api/project/tracking',{signal:AbortSignal.timeout(15000)}),snapshot=await r.json();if(!r.ok)throw Error(snapshot.error||'Could not load project progress.');return snapshot;}
 async function refresh(){if(loading||busy)return;loading=true;try{const snapshot=await read();if(!busy){data=snapshot.data;status.textContent='';render();}}catch(e){status.textContent=e.message;}finally{loading=false;}}
 async function save(stage,done,design){const snapshot=await read(),next=projectSetGuideStage(snapshot.data,stage,done,design);const r=await fetch('/api/project/tracking',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:next,revision:snapshot.revision}),signal:AbortSignal.timeout(15000)}),saved=await r.json();if(!r.ok)throw Error(saved.error||'Could not save this step.');data=saved.data;window.dispatchEvent(new CustomEvent('project-tracking-changed',{detail:data}));}
 async function runSave(action){if(busy)return;busy=true;render();status.textContent='Saving…';try{await action();status.textContent='Saved to Project tracking.';}catch(e){status.textContent=e.name==='TimeoutError'?'Save timed out. Refresh before trying again.':e.message;}finally{busy=false;render();}}
 checkbox.onchange=()=>{if(!data||busy){render();return;}const stage=api.currentGuideStep().stage,design={...api.state},current=projectGuideStageDone(data,stage,design),state=nextCompletionState(current,autoMark);
  if(state.done===current){autoMark=state.autoMark;status.textContent=autoMark?'Next marks the following step done.':'';render();return;}
  return runSave(async()=>{await save(stage,state.done,design);autoMark=state.autoMark;});
 };
 nextButton.onclick=async e=>{if(busy)return;const target=api.nextGuideStep();if(!autoMark||!target)return originalNext?.call(nextButton,e);const design={...api.state},from=api.currentGuideStep().stage;await runSave(async()=>{await save(target.stage,true,design);if(api.state.mode==='build'&&api.currentGuideStep().stage===from)originalNext?.call(nextButton,e);});};
 window.addEventListener('studio-view-changed',()=>{if(!busy)status.textContent='';render();if(!data&&api.state.mode==='build')refresh();});
 for(const type of ['project-tracking-changed','project-tracking-loaded'])window.addEventListener(type,e=>{if(!busy){data=e.detail;status.textContent='';render();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&api.state.mode==='build')refresh();});
 render();refresh();
}
