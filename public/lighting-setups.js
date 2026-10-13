// Named lighting setups saved on the website, shared across devices. Mirrors saved camera positions.
export function installLightingSetups(api) {
  const panel=document.querySelector('#shot-lighting-panel'),host=document.createElement('section');host.id='lighting-setups';host.setAttribute('aria-label','Saved lighting setups');
  host.innerHTML=`<div class="camera-heading"><h2>Saved setups</h2><button id="lighting-refresh" type="button">Refresh</button></div>
<div id="lighting-setup-list" role="group" aria-label="Saved lighting setups"></div>
<dialog id="lighting-delete-dialog" aria-labelledby="lighting-delete-title" aria-describedby="lighting-delete-description"><h2 id="lighting-delete-title">Delete lighting setup?</h2><p id="lighting-delete-description"></p><p class="hint">This removes the setup across devices. You can restore it later under Deleted setups.</p><div class="dialog-actions"><button type="button" id="lighting-delete-cancel" autofocus>Cancel</button><button type="button" id="lighting-delete-confirm">Delete setup</button></div></dialog>
<details id="lighting-deleted" hidden><summary>Deleted setups <span>+</span></summary><div id="lighting-deleted-list"></div></details>`;
  // The save bar sits directly in the panel so it can stay pinned to the bottom while the controls scroll.
  const dock=document.createElement('div');dock.innerHTML=`<form id="lighting-save-form" class="save-dock"><p id="lighting-status" role="status" aria-live="polite"></p><label for="lighting-name">Lighting setup name <span id="lighting-selection"></span></label><input id="lighting-name" required maxlength="80" placeholder="e.g. Moody interview" autocomplete="off"><div class="camera-actions"><button type="button" id="lighting-update" disabled>Update selected</button><button type="submit" id="lighting-save">Save as new</button></div></form>`;panel.append(host,dock.firstElementChild);
  const $=s=>panel.querySelector(s),name=$('#lighting-name'),status=$('#lighting-status'),deleteDialog=$('#lighting-delete-dialog');
  let setups=[],deleted=[],selected=null,busy=false,attempt=null,loadVersion=0,pendingDelete=null;
  const changed=()=>!!selected&&(name.value.trim()!==selected.name||JSON.stringify(api.lighting.get())!==JSON.stringify(selected.rig));
  function buttons(){const dirty=changed();$('#lighting-save').disabled=busy;$('#lighting-update').disabled=busy||!selected||!dirty;name.disabled=busy;$('#lighting-selection').textContent=selected?'· '+(dirty?'unsaved changes to '+selected.name:selected.name+' applied'):'';}
  function action(label,aria,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-label',aria);b.disabled=busy;b.onclick=fn;return b;}
  function render(){
    const list=$('#lighting-setup-list');list.replaceChildren();
    if(!setups.length){const p=document.createElement('p');p.className='camera-empty';p.textContent='No saved setups yet. Name this lighting below and save it.';list.append(p);}
    for(const s of setups){
      const row=document.createElement('article'),b=document.createElement('button'),title=document.createElement('strong'),meta=document.createElement('span'),actions=document.createElement('div'),on=s.rig.lights.filter(l=>l.enabled);
      row.className='camera-shot-row';b.type='button';b.className='camera-shot';b.setAttribute('aria-pressed',s.id===selected?.id);title.textContent=s.name;meta.textContent=on.length?on.map(l=>l.name).join(' · '):'All lights off';b.append(title,meta);b.onclick=()=>apply(s);b.disabled=busy;
      actions.className='camera-row-actions';actions.append(action('Delete','Delete '+s.name,()=>confirmDeletion(s)));row.append(b,actions);list.append(row);
    }
    $('#lighting-deleted').hidden=!deleted.length;
    $('#lighting-deleted-list').replaceChildren(...deleted.map(s=>{const row=document.createElement('div'),label=document.createElement('span');label.textContent=s.name;row.append(label,action('Restore','Restore '+s.name,()=>removeOrRestore(s,true)));return row;}));
    buttons();
  }
  async function request(options){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{const response=await fetch('/api/lighting-setups',{...options,signal:controller.signal});let data;try{data=await response.json();}catch{throw Error('Lighting setups are unavailable. Please try again.');}if(!response.ok)throw Error(data.error||'Could not save this lighting setup.');return data;}
    catch(e){if(e.name==='AbortError')throw Error('The request timed out. Please try again.');throw e;}finally{clearTimeout(timer);}
  }
  async function refresh(){const version=++loadVersion;$('#lighting-refresh').disabled=true;try{const data=await request();if(version!==loadVersion)return;setups=data.setups;deleted=data.deletedSetups||[];if(selected&&!setups.some(s=>s.id===selected.id)){selected=null;name.value='';}render();}
    catch(e){if(version===loadVersion)status.textContent=e.message;}finally{if(version===loadVersion)$('#lighting-refresh').disabled=false;}}
  function apply(s){if(busy)return;selected=s;name.value=s.name;name.setCustomValidity('');attempt=null;api.lighting.set(s.rig);status.textContent='Applied '+s.name+'. Adjust the lights to enable Update selected.';render();}
  function remember(s){setups=setups.filter(x=>x.id!==s.id);deleted=deleted.filter(x=>x.id!==s.id);if(s.deletedAt!==null)deleted.unshift(s);else setups.unshift(s);}
  async function save(update=false){
    if(busy||!name.reportValidity()||update&&!changed())return;
    const value=name.value.trim();if(!value){name.setCustomValidity('Enter a setup name.');name.reportValidity();return;}
    const original=update?selected:null,payload={name:value,rig:api.lighting.get(),...(original?{id:original.id,revision:original.revision}:{})};
    const key=JSON.stringify(payload);if(!attempt||attempt.key!==key)attempt={key,id:crypto.randomUUID()};if(!original)payload.id=attempt.id;
    busy=true;++loadVersion;$('#lighting-refresh').disabled=true;render();status.textContent='Saving…';
    try{const data=await request({method:original?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});attempt=null;selected=data.setup;remember(selected);name.value=selected.name;status.textContent='Saved '+selected.name+'. Available across devices.';}
    catch(e){status.textContent=e.message;}
    finally{busy=false;$('#lighting-refresh').disabled=false;render();}
  }
  function confirmDeletion(s){if(busy||deleteDialog.open)return;pendingDelete=s;$('#lighting-delete-description').textContent='Delete “'+s.name+'”?';deleteDialog.showModal();$('#lighting-delete-cancel').focus();}
  $('#lighting-delete-cancel').onclick=()=>deleteDialog.close();
  deleteDialog.addEventListener('close',()=>{pendingDelete=null;});
  $('#lighting-delete-confirm').onclick=()=>{const s=pendingDelete;pendingDelete=null;deleteDialog.close();if(s)removeOrRestore(s,false);};
  async function removeOrRestore(s,restore){
    if(busy)return;busy=true;++loadVersion;$('#lighting-refresh').disabled=true;render();status.textContent=restore?'Restoring…':'Deleting…';
    try{const data=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:s.id,revision:s.revision,action:restore?'restore':'delete'})});remember(data.setup);
      if(!restore&&selected?.id===s.id){selected=null;name.value='';attempt=null;}
      status.textContent=restore?'Restored '+s.name+'.':'Deleted '+s.name+'. You can restore it under Deleted setups.';
    }catch(e){status.textContent=e.message;}
    finally{busy=false;$('#lighting-refresh').disabled=false;render();}
  }
  name.addEventListener('input',()=>{name.setCustomValidity('');buttons();});
  $('#lighting-save-form').onsubmit=e=>{e.preventDefault();save(false);};$('#lighting-update').onclick=()=>save(true);$('#lighting-refresh').onclick=refresh;
  window.addEventListener('lighting-changed',buttons);
  const baseMode=api.setMode;api.setMode=m=>{if(deleteDialog.open)deleteDialog.close();const result=baseMode(m);if(m==='cameras')refresh();return result;};
  if(api.state.mode==='cameras')refresh();
  render();
}
