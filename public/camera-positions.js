import {createCameraMotion} from './camera-motion.js';

export function installCameraPositions(api) {
  const $=s=>document.querySelector(s),host=$('#camera-positions'),lensControls=$('#camera-controls'),explore=$('#explore-controls');
  host.innerHTML=`<div class="camera-heading"><div><span class="eyebrow">SHOT PLANNING</span><h2>Camera positions</h2></div><button id="camera-refresh" type="button">Refresh</button></div>
<p class="hint">Name a view, then tap a saved shot to move there. Position, viewing direction, focal length and frame shape are saved across devices.</p>
<div id="camera-shot-list" role="group" aria-label="Saved camera positions"></div>
<div id="camera-lens-slot"></div>
<form id="camera-save-form"><label for="camera-name">Camera name</label><input id="camera-name" required maxlength="80" placeholder="e.g. Wide master" autocomplete="off"><div class="camera-actions"><button type="submit" id="camera-save">Save new position</button><button type="button" id="camera-update" disabled>Update selected</button></div></form>
<p id="camera-save-hint" class="hint">Arrange the view by dragging to orbit, pinching to zoom, or dragging with two fingers to pan.</p>
<p id="camera-status" role="status" aria-live="polite"></p>`;
  let positions=[],selected=null,busy=false,attempt=null,loadVersion=0;
  const motion=createCameraMotion(api),status=$('#camera-status'),name=$('#camera-name');
  function buttons(){ $('#camera-save').disabled=busy||!!api.cameraAnimating;$('#camera-update').disabled=busy||!!api.cameraAnimating||!selected; }
  function render(){
    const list=$('#camera-shot-list');list.replaceChildren();
    if(!positions.length){const p=document.createElement('p');p.className='camera-empty';p.textContent='No saved positions yet. Frame your first shot below.';list.append(p);}
    for(const p of positions){const b=document.createElement('button'),title=document.createElement('strong'),meta=document.createElement('span');b.type='button';b.className='camera-shot';b.setAttribute('aria-pressed',p.id===selected?.id);title.textContent=p.name;meta.textContent=`${Math.round(p.shot.mm)} mm · ${p.shot.ratio}`;b.append(title,meta);b.onclick=()=>select(p);b.disabled=busy;list.append(b);}
    buttons();
  }
  async function request(options){const response=await fetch('/api/camera-positions',options);let data;try{data=await response.json();}catch{throw Error('Camera positions are unavailable. Please try again.');}if(!response.ok)throw Error(data.error||'Could not save this camera position.');return data;}
  async function refresh(){const version=++loadVersion;$('#camera-refresh').disabled=true;try{const data=await request();if(version!==loadVersion)return;positions=data.positions;
    // Keep the selected revision until explicitly reselected; never silently overwrite a remote edit.
    render();if(!selected)status.textContent=positions.length?'Saved on this website. Select a shot to restore it.':'';
  }catch(e){if(version===loadVersion)status.textContent=e.message;}finally{if(version===loadVersion)$('#camera-refresh').disabled=false;}}
  function select(p){if(busy)return;motion.stop();selected=p;name.value=p.name;status.textContent='Moving to '+p.name+'…';motion.move(p.shot,complete=>{status.textContent=complete?'Viewing '+p.name+'.':'Move stopped. You can adjust this view.';buttons();});render();}
  async function save(update){
    if(busy||api.cameraAnimating||!name.reportValidity())return;
    let shot;try{shot=motion.freeze();}catch(e){status.textContent=e.message;return;}
    const value=name.value.trim();if(!value){name.setCustomValidity('Enter a camera name.');name.reportValidity();return;}
    const original=selected,payload={name:value,shot,...(update?{id:original.id,revision:original.revision}:{})};
    const key=JSON.stringify({update,payload});if(!attempt||attempt.key!==key)attempt={key,id:crypto.randomUUID()};if(!update)payload.id=attempt.id;
    busy=true;++loadVersion;$('#camera-refresh').disabled=true;render();status.textContent='Saving…';
    try{const data=await request({method:update?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});attempt=null;selected=data.position;positions=[data.position,...positions.filter(p=>p.id!==data.position.id)];status.textContent='Saved '+selected.name+' on the website. Available across devices.';}
    catch(e){status.textContent=e.message;}
    finally{busy=false;$('#camera-refresh').disabled=false;render();}
  }
  name.addEventListener('input',()=>name.setCustomValidity(''));
  $('#camera-save-form').onsubmit=e=>{e.preventDefault();save(false);};$('#camera-update').onclick=()=>save(true);$('#camera-refresh').onclick=refresh;
  const interrupt=()=>{if(api.state.mode==='cameras'){motion.stop();if(selected)status.textContent='Adjusting '+selected.name+'. Save a new position or update selected to keep your changes.';}};
  // Capture before OrbitControls handles the new gesture.
  for(const type of ['pointerdown','wheel','keydown'])api.renderer.domElement.addEventListener(type,interrupt,{capture:true,passive:true});
  lensControls.addEventListener('input',interrupt,{capture:true});lensControls.addEventListener('pointerdown',interrupt,{capture:true});lensControls.addEventListener('keydown',interrupt,{capture:true});
  const baseMode=api.setMode;
  api.setMode=m=>{
    motion.stop();const result=baseMode(m),active=m==='cameras';host.hidden=!active;document.body.classList.toggle('camera-positions',active);
    if(active){$('#camera-lens-slot').append(lensControls);api.lens.set({on:true});$('#view-hint').textContent='Drag to orbit · two fingers to pan';$('#camera-save-hint').textContent='Arrange the view by dragging to orbit, pinching to zoom, or dragging with two fingers to pan. Update selected replaces its name and view.';refresh();}
    else{explore.prepend(lensControls);}
    return result;
  };
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>api.setMode(b.dataset.mode));
}
