import {createCameraMotion} from './camera-motion.js';

export function installCameraPositions(api) {
  const $=s=>document.querySelector(s),host=$('#camera-positions'),lensControls=$('#camera-controls'),explore=$('#explore-controls');
  host.innerHTML=`<div id="camera-lens-slot"></div>
<form id="camera-save-form"><h2 id="camera-form-title">Save camera position</h2><label for="camera-name">Camera name</label><input id="camera-name" required maxlength="80" placeholder="e.g. Wide master" autocomplete="off"><div class="camera-actions"><button type="submit" id="camera-save">Save camera position</button><button type="button" id="camera-cancel" hidden>Cancel editing</button></div></form>
<p id="camera-status" role="status" aria-live="polite"></p>
<div class="camera-heading"><h2>Saved angles</h2><button id="camera-refresh" type="button">Refresh</button></div>
<div id="camera-shot-list" role="group" aria-label="Saved camera positions"></div>
<p id="camera-save-hint" class="hint">Tap an angle to move there. Edit restores the shot so you can change its name, lens, frame and position. Drag to orbit, pinch to zoom, or use two fingers to pan.</p>
<p class="hint">Camera positions are saved on this website across devices.</p>
<details id="camera-deleted" hidden><summary>Deleted angles <span>+</span></summary><div id="camera-deleted-list"></div></details>`;
  let positions=[],deleted=[],selected=null,editing=null,busy=false,attempt=null,loadVersion=0;
  const motion=createCameraMotion(api),status=$('#camera-status'),name=$('#camera-name');
  function buttons(){
    $('#camera-save').disabled=busy||!!api.cameraAnimating;$('#camera-cancel').disabled=busy;name.disabled=busy;
    $('#camera-cancel').hidden=!editing;$('#camera-save').textContent=editing?'Save changes':'Save camera position';
    $('#camera-form-title').textContent=editing?'Edit camera position':'Save camera position';
  }
  function action(label,aria,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-label',aria);b.disabled=busy;b.onclick=fn;return b;}
  function render(){
    const list=$('#camera-shot-list');list.replaceChildren();
    if(!positions.length){const p=document.createElement('p');p.className='camera-empty';p.textContent='No saved angles yet. Frame and name your first shot above.';list.append(p);}
    for(const p of positions){
      const row=document.createElement('article'),b=document.createElement('button'),title=document.createElement('strong'),meta=document.createElement('span'),actions=document.createElement('div');
      row.className='camera-shot-row';b.type='button';b.className='camera-shot';b.setAttribute('aria-pressed',p.id===selected?.id);title.textContent=p.name;meta.textContent=`${Math.round(p.shot.mm)} mm · ${p.shot.ratio}`;b.append(title,meta);b.onclick=()=>select(p);b.disabled=busy;
      actions.className='camera-row-actions';actions.append(action('Edit','Edit '+p.name,()=>select(p,true)),action('Delete','Delete '+p.name,()=>removeOrRestore(p,false)));row.append(b,actions);list.append(row);
    }
    $('#camera-deleted').hidden=!deleted.length;
    $('#camera-deleted-list').replaceChildren(...deleted.map(p=>{const row=document.createElement('div'),label=document.createElement('span');label.textContent=p.name;row.append(label,action('Restore','Restore '+p.name,()=>removeOrRestore(p,true)));return row;}));
    buttons();
  }
  async function request(options){const response=await fetch('/api/camera-positions',options);let data;try{data=await response.json();}catch{throw Error('Camera positions are unavailable. Please try again.');}if(!response.ok)throw Error(data.error||'Could not save this camera position.');return data;}
  async function refresh(){const version=++loadVersion;$('#camera-refresh').disabled=true;try{const data=await request();if(version!==loadVersion)return;positions=data.positions;deleted=data.deletedPositions||[];
    // An open editor keeps its original revision, so a remote update cannot be overwritten silently.
    render();if(!selected&&!editing)status.textContent='';
  }catch(e){if(version===loadVersion)status.textContent=e.message;}finally{if(version===loadVersion)$('#camera-refresh').disabled=false;}}
  function select(p,edit=false){
    if(busy)return;motion.stop();selected=p;editing=edit?p:null;name.value=edit?p.name:'';name.setCustomValidity('');attempt=null;
    status.textContent='Moving to '+p.name+'…';motion.move(p.shot,complete=>{status.textContent=complete?(editing?'Editing '+p.name+'. Adjust the view or name, then save changes.':'Viewing '+p.name+'.'):'Move stopped. You can adjust this view.';buttons();});render();
    if(edit)$('#camera-save-form').scrollIntoView({block:'nearest'});
  }
  function remember(p){positions=positions.filter(x=>x.id!==p.id);deleted=deleted.filter(x=>x.id!==p.id);if(p.deletedAt!==null)deleted.unshift(p);else positions.unshift(p);}
  async function save(){
    if(busy||api.cameraAnimating||!name.reportValidity())return;
    let shot;try{shot=motion.freeze();}catch(e){status.textContent=e.message;return;}
    const value=name.value.trim();if(!value){name.setCustomValidity('Enter a camera name.');name.reportValidity();return;}
    const original=editing,payload={name:value,shot,...(original?{id:original.id,revision:original.revision}:{})};
    const key=JSON.stringify(payload);if(!attempt||attempt.key!==key)attempt={key,id:crypto.randomUUID()};if(!original)payload.id=attempt.id;
    busy=true;++loadVersion;$('#camera-refresh').disabled=true;render();status.textContent='Saving…';
    try{const data=await request({method:original?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});attempt=null;selected=data.position;remember(selected);editing=null;name.value='';status.textContent='Saved '+selected.name+' on the website. Available across devices.';}
    catch(e){status.textContent=e.message;}
    finally{busy=false;$('#camera-refresh').disabled=false;render();}
  }
  async function removeOrRestore(p,restore){
    if(busy)return;motion.stop();busy=true;++loadVersion;$('#camera-refresh').disabled=true;render();status.textContent=restore?'Restoring…':'Deleting…';
    try{const data=await request({method:restore?'PATCH':'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:p.id,revision:p.revision,...(restore?{restore:true}:{})})});remember(data.position);
      if(!restore&&selected?.id===p.id)selected=null;if(!restore&&editing?.id===p.id){editing=null;name.value='';attempt=null;}
      status.textContent=restore?'Restored '+p.name+'.':'Deleted '+p.name+'. You can restore it under Deleted angles.';
    }catch(e){status.textContent=e.message;}
    finally{busy=false;$('#camera-refresh').disabled=false;render();}
  }
  name.addEventListener('input',()=>name.setCustomValidity(''));
  $('#camera-save-form').onsubmit=e=>{e.preventDefault();save();};$('#camera-refresh').onclick=refresh;
  $('#camera-cancel').onclick=()=>{motion.stop();editing=null;name.value='';name.setCustomValidity('');attempt=null;buttons();status.textContent='Editing canceled. The saved angle is unchanged.';};
  const interrupt=()=>{if(api.state.mode==='cameras'){motion.stop();status.textContent=editing?'Adjusting '+editing.name+'. Save changes to keep this view.':'Frame your shot, then name and save it above.';}};
  for(const type of ['pointerdown','wheel','keydown'])api.renderer.domElement.addEventListener(type,interrupt,{capture:true,passive:true});
  lensControls.addEventListener('input',interrupt,{capture:true});lensControls.addEventListener('pointerdown',interrupt,{capture:true});lensControls.addEventListener('keydown',interrupt,{capture:true});
  const baseMode=api.setMode;
  api.setMode=m=>{
    motion.stop();const result=baseMode(m),active=m==='cameras';host.hidden=!active;document.body.classList.toggle('camera-positions',active);
    if(active){$('#camera-lens-slot').append(lensControls);api.lens.set({on:true});$('#view-hint').textContent='Drag to orbit · two fingers to pan';if(editing){editing=null;name.value='';buttons();}refresh();}
    else{explore.prepend(lensControls);}
    return result;
  };
  $('#cam-save-positions').onclick=()=>api.setMode('cameras');
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>api.setMode(b.dataset.mode));
}
