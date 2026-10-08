import {cameraShotChanged} from './camera-state.js';
import {createCameraMotion} from './camera-motion.js';

export function installCameraPositions(api) {
  const $=s=>document.querySelector(s),host=$('#camera-positions'),lensControls=$('#camera-controls'),explore=$('#explore-controls');
  host.innerHTML=`<div id="camera-lens-slot"></div>
<form id="camera-save-form"><h2 id="camera-form-title">Save camera position</h2><p id="camera-selection" class="hint"></p><label for="camera-name">Camera name</label><input id="camera-name" required maxlength="80" placeholder="e.g. Wide master" autocomplete="off"><div class="camera-actions"><button type="button" id="camera-update" disabled>Update selected</button><button type="submit" id="camera-save">Save as new</button></div></form>
<p id="camera-status" role="status" aria-live="polite"></p>
<div class="camera-heading"><h2>Saved angles</h2><button id="camera-refresh" type="button">Refresh</button></div>
<div id="camera-shot-list" role="group" aria-label="Saved camera positions"></div>
<p id="camera-save-hint" class="hint">Tap an angle to select it. Change the view, lens, frame or name, then Update selected. Save as new keeps a separate angle. Drag to orbit, pinch to zoom, or use two fingers to pan.</p>
<p class="hint">Camera positions are saved on this website across devices.</p>
<details id="camera-deleted" hidden><summary>Deleted angles <span>+</span></summary><div id="camera-deleted-list"></div></details>`;
  let positions=[],deleted=[],selected=null,busy=false,attempt=null,loadVersion=0,rowMessage=null;
  const motion=createCameraMotion(api),status=$('#camera-status'),name=$('#camera-name');
  function changed(){try{return cameraShotChanged(selected,motion.snapshot(),name.value);}catch{return false;}}
  function buttons(){
    const moving=!!api.cameraAnimating,dirty=changed();
    $('#camera-save').disabled=busy||moving;$('#camera-update').disabled=busy||moving||!selected||!dirty;name.disabled=busy;
    $('#camera-selection').textContent=selected?'Selected: '+selected.name+(moving?' · Moving…':dirty?' · Unsaved changes':' · No changes to save'):'Frame and name a new angle, or select one below.';
  }
  function action(label,aria,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-label',aria);b.disabled=busy;b.onclick=fn;return b;}
  function render(){
    const list=$('#camera-shot-list');list.replaceChildren();
    if(!positions.length){const p=document.createElement('p');p.className='camera-empty';p.textContent='No saved angles yet. Frame and name your first shot above.';list.append(p);}
    for(const p of positions){
      const row=document.createElement('article'),b=document.createElement('button'),title=document.createElement('strong'),meta=document.createElement('span'),actions=document.createElement('div');
      row.className='camera-shot-row';b.type='button';b.className='camera-shot';b.setAttribute('aria-pressed',p.id===selected?.id);title.textContent=p.name;meta.textContent=`${Math.round(p.shot.mm)} mm · ${p.shot.ratio}`;b.append(title,meta);b.onclick=()=>select(p);b.disabled=busy;
      actions.className='camera-row-actions';actions.append(action('Edit','Edit '+p.name,()=>select(p,true)),action('Delete','Delete '+p.name,()=>removeOrRestore(p,false)));row.append(b,actions);if(rowMessage?.id===p.id){const message=document.createElement('p');message.className='camera-row-status';message.setAttribute('role','status');message.textContent=rowMessage.text;row.append(message);}list.append(row);
    }
    $('#camera-deleted').hidden=!deleted.length;
    $('#camera-deleted-list').replaceChildren(...deleted.map(p=>{const row=document.createElement('div'),label=document.createElement('span');label.textContent=p.name;row.append(label,action('Restore','Restore '+p.name,()=>removeOrRestore(p,true)));return row;}));
    buttons();
  }
  async function request(options){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{const response=await fetch('/api/camera-positions',{...options,signal:controller.signal});let data;try{data=await response.json();}catch{throw Error('Camera positions are unavailable. Please try again.');}if(!response.ok)throw Error(data.error||'Could not save this camera position.');return data;}
    catch(e){if(e.name==='AbortError')throw Error('The request timed out. Please try again.');throw e;}finally{clearTimeout(timer);}
  }
  async function refresh(){const version=++loadVersion;$('#camera-refresh').disabled=true;try{const data=await request();if(version!==loadVersion)return;positions=data.positions;deleted=data.deletedPositions||[];if(selected&&!positions.some(p=>p.id===selected.id)){selected=null;name.value='';}rowMessage=null;
    // Keep the selected baseline revision until reselected; remote edits must not be overwritten.
    render();if(!selected)status.textContent='';
  }catch(e){if(version===loadVersion)status.textContent=e.message;}finally{if(version===loadVersion)$('#camera-refresh').disabled=false;}}
  function select(p,edit=false){
    if(busy)return;motion.stop();selected=p;name.value=p.name;name.setCustomValidity('');attempt=null;
    status.textContent='Moving to '+p.name+'…';motion.move(p.shot,complete=>{status.textContent=complete?('Viewing '+p.name+'. Move the camera or change its settings to enable Update selected.'):'Move stopped. You can adjust this view.';buttons();});render();
    if(edit)$('#camera-save-form').scrollIntoView({block:'nearest'});
  }
  function remember(p){positions=positions.filter(x=>x.id!==p.id);deleted=deleted.filter(x=>x.id!==p.id);if(p.deletedAt!==null)deleted.unshift(p);else positions.unshift(p);}
  async function save(update=false){
    if(busy||api.cameraAnimating||!name.reportValidity()||update&&(!selected||!changed()))return;
    let shot;try{shot=motion.freeze();}catch(e){status.textContent=e.message;return;}
    const value=name.value.trim();if(!value){name.setCustomValidity('Enter a camera name.');name.reportValidity();return;}
    const original=update?selected:null,payload={name:value,shot,...(original?{id:original.id,revision:original.revision}:{})};
    const key=JSON.stringify(payload);if(!attempt||attempt.key!==key)attempt={key,id:crypto.randomUUID()};if(!original)payload.id=attempt.id;
    busy=true;++loadVersion;$('#camera-refresh').disabled=true;render();status.textContent='Saving…';
    try{const data=await request({method:original?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});attempt=null;selected=data.position;remember(selected);name.value=selected.name;status.textContent='Saved '+selected.name+' on the website. Available across devices.';}
    catch(e){status.textContent=e.message;}
    finally{busy=false;$('#camera-refresh').disabled=false;render();}
  }
  async function removeOrRestore(p,restore){
    if(busy)return;motion.stop();busy=true;++loadVersion;$('#camera-refresh').disabled=true;rowMessage={id:p.id,text:restore?'Restoring…':'Deleting…'};render();status.textContent=rowMessage.text;
    try{const data=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:p.id,revision:p.revision,action:restore?'restore':'delete'})});remember(data.position);
      if(!restore&&selected?.id===p.id){selected=null;name.value='';attempt=null;}rowMessage=null;
      status.textContent=restore?'Restored '+p.name+'.':'Deleted '+p.name+'. You can restore it under Deleted angles.';
    }catch(e){status.textContent=e.message;rowMessage={id:p.id,text:e.message};}
    finally{busy=false;$('#camera-refresh').disabled=false;render();}
  }
  name.addEventListener('input',()=>{name.setCustomValidity('');buttons();});
  $('#camera-save-form').onsubmit=e=>{e.preventDefault();save(false);};$('#camera-update').onclick=()=>save(true);$('#camera-refresh').onclick=refresh;
  const interrupt=()=>{if(api.state.mode==='cameras')motion.stop();};
  for(const type of ['pointerdown','wheel','keydown'])api.renderer.domElement.addEventListener(type,interrupt,{capture:true,passive:true});
  lensControls.addEventListener('input',interrupt,{capture:true});lensControls.addEventListener('pointerdown',interrupt,{capture:true});lensControls.addEventListener('keydown',interrupt,{capture:true});
  api.orbit.addEventListener('change',()=>{if(api.state.mode==='cameras')buttons();});
  window.addEventListener('camera-lens-changed',()=>{if(api.state.mode==='cameras')buttons();});
  const baseMode=api.setMode;
  api.setMode=m=>{
    motion.stop();const result=baseMode(m),active=m==='cameras';host.hidden=!active;document.body.classList.toggle('camera-positions',active);
    if(active){$('#camera-lens-slot').append(lensControls);api.lens.set({on:true});$('#view-hint').textContent='Drag to orbit · two fingers to pan';buttons();refresh();}
    else{explore.prepend(lensControls);}
    return result;
  };
  $('#cam-save-positions').onclick=()=>api.setMode('cameras');
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>api.setMode(b.dataset.mode));
}
