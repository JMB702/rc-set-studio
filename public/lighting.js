import * as THREE from 'three';
import {defaultLightingRig,normalizeLightingRig,subjectCoordinates,subjectPoint} from './lighting-state.js';

const STORAGE='rc-set-lighting-v1',FT=.3048,IN=.0254;
export function installLighting(api){
 const host=document.querySelector('#camera-positions'),cameraPanel=document.createElement('div');
 cameraPanel.id='shot-camera-panel';cameraPanel.setAttribute('role','tabpanel');cameraPanel.setAttribute('aria-labelledby','shot-tab-camera');
 while(host.firstChild)cameraPanel.append(host.firstChild);host.append(cameraPanel);
 const tabs=document.createElement('div');tabs.className='shot-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Shot controls');
 tabs.innerHTML='<button id="shot-tab-camera" role="tab" aria-controls="shot-camera-panel" aria-selected="true">Camera controls</button><button id="shot-tab-lighting" role="tab" aria-controls="shot-lighting-panel" aria-selected="false" tabindex="-1">Lighting controls</button>';host.prepend(tabs);
 const panel=document.createElement('section');panel.id='shot-lighting-panel';panel.hidden=true;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','shot-tab-lighting');host.append(panel);
 const range=(key,label,min,max,step=1)=>`<label class="light-range" for="light-${key}"><span>${label}</span><output id="light-${key}-value" for="light-${key}"></output><input id="light-${key}" data-light-field="${key}" type="range" min="${min}" max="${max}" step="${step}"></label>`;
 panel.innerHTML=`<div class="light-chips" role="group" aria-label="Lights in the rig"><div id="light-chip-list"></div><button id="light-add" type="button" class="light-chip-add">+ Add light</button></div>
 <div id="light-undo" class="light-undo" role="status" hidden><span></span><button type="button">Undo</button></div>
 <p id="light-none" class="hint">Tap a light to adjust it. Tap it again, or empty space in the view, to deselect.</p>
 <div id="light-editor">
 <div class="light-head"><div class="light-title-wrap"><h2 id="light-title" title="Tap to rename"></h2><button id="light-rename" class="light-rename" type="button" aria-label="Rename light"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4"/></svg></button><input id="light-name" class="light-title-input" maxlength="40" aria-label="Light name" enterkeyhint="done" autocomplete="off" hidden></div><button id="light-remove" class="light-remove" type="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg><span>Remove</span></button><button id="light-enabled" class="light-switch" aria-pressed="true"><span aria-hidden="true"></span><b>On</b></button></div>
 <div class="light-pads"><div id="light-pad" class="light-pad" tabindex="0" role="group" aria-label="Light position pad. Drag left or right to circle the subject, up or down to raise or lower the light. Arrow keys also work." aria-describedby="light-pad-readout"><span class="light-pad-x" aria-hidden="true">◀ circle subject ▶</span><span class="light-pad-y" aria-hidden="true">▲ higher</span><output id="light-pad-readout"></output></div>
 <div id="light-strip" class="light-strip" tabindex="0" role="group" aria-label="Distance strip. Drag up to move the light farther from the subject, down to bring it closer. Arrow keys also work." aria-describedby="light-strip-readout"><span aria-hidden="true">▲ farther</span><output id="light-strip-readout"></output><span aria-hidden="true">▼ closer</span></div></div>
 ${range('power','Brightness',0,200)}
 <div class="light-actions"><button id="light-place">Tap to place</button><button id="light-aim">Tap to aim</button></div>
 <details id="light-exact"><summary>Exact position <span>+</span></summary>${range('rotation','Direction',-180,180)}${range('elevation','Height',.5,16,.25)}${range('distance','Distance',.5,30,.25)}</details>
 <div class="light-quality"><span>Light quality</span><div class="light-types" role="group" aria-label="Light quality"><button data-light-type="diffuse" aria-pressed="true"><b>Soft</b><small>Softbox · even wrap</small></button><button data-light-type="spot" aria-pressed="false"><b>Hard</b><small>Spotlight · crisp shadows</small></button></div></div>
 <details id="light-aim-details"><summary>Fine-tune aim <span>+</span></summary>${range('aimRotation','Aim direction',-180,180)}${range('aimHeight','Aim height',0,16,.25)}${range('aimDistance','Aim offset',0,15,.25)}<p class="hint">Moves the point the light aims at. Zero offset aims at the subject’s center.</p></details>
 <details id="light-shape"><summary>Shape &amp; size <span>+</span></summary>
 <div class="light-presets" role="group" aria-label="Light shape presets"><button data-light-preset="softbox">Softbox</button><button data-light-preset="strip">Strip</button><button data-light-preset="square">Square</button></div>
 ${range('width','Width',3,144)}${range('height','Height',3,144)}
 <div class="light-ratio-row"><span id="light-ratio"></span><button id="light-lock" aria-pressed="false">Lock ratio</button></div>${range('roll','Tilt',-180,180)}
 <p class="hint" id="light-size-note"></p></details>
 <details id="light-output"><summary>Color &amp; beam <span>+</span></summary>
 <label class="light-color">Light color<input id="light-color" type="color" value="#fff5e6"></label>
 <div id="light-spot-controls">${range('beam','Beam width',10,120)}${range('edge','Edge softness',0,100)}<div class="light-presets"><button data-light-edge="0">Hard edge</button><button data-light-edge="50">Soft edge</button><button data-light-edge="100">Feathered</button></div></div></details>
 <details id="light-manage"><summary>More <span>+</span></summary><div class="light-actions"><button id="light-duplicate">Duplicate this light</button></div></details></div>
 <div class="light-view-options"><label><input id="light-show-shapes" type="checkbox" checked> Show lights in view</label><button id="light-overview">See whole rig</button><button id="light-return" hidden>Back to shot</button></div>
 <button id="light-reset">Reset to soft three-point</button><p id="light-status" role="status" aria-live="polite"></p><p class="hint">Your current lights stay on this device. Save them as a setup below to use them on any device. Preview is approximate; soft-light shadows are not simulated.</p>
 <div id="light-reset-confirm" hidden><p>Replace your current lights with the soft three-point setup?</p><div class="light-actions"><button id="light-reset-cancel">Cancel</button><button id="light-reset-yes">Replace lights</button></div></div>`;
 panel.addEventListener('pointerdown',()=>api.cancelCameraMove?.(),{capture:true,passive:true});
 const $=s=>panel.querySelector(s);let rig=defaultLightingRig(),selected,tab='camera',picking=null,locked=false,overview=null,ready=false,initializing=null;
 try{const saved=localStorage.getItem(STORAGE);if(saved)rig=normalizeLightingRig(JSON.parse(saved));}catch{}
 selected=null;
 const group=new THREE.Group();group.name='Lighting rig';api.scene.add(group);
 const helpers=new THREE.Group();helpers.name='Light placement shapes';api.scene.add(helpers);
 const originalLights=api.scene.children.filter(o=>o.isLight).map(o=>[o,o.visible]);
 const ambient=new THREE.HemisphereLight(0xe7edff,0x292c35,.35);group.add(ambient);
 let nodes=[],saveTimer;
 const flush=()=>{clearTimeout(saveTimer);try{localStorage.setItem(STORAGE,JSON.stringify(rig));}catch{status('Device storage is unavailable. Save a camera position to keep this rig.');}};
 window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});
 // Outside Camera positions a preview rig (the default saved setup) can light the finished set without touching the edited rig.
 let preview=null;
 const active=()=>api.state.mode==='cameras',lit=()=>active()||!!preview,liveRig=()=>active()?rig:preview,current=()=>rig.lights.find(l=>l.id===selected);
 function status(text){$('#light-status').textContent=text;}
 function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(flush,160);window.dispatchEvent(new Event('lighting-changed'));}
 async function initialize(){if(initializing)return initializing;initializing=(async()=>{try{const {RectAreaLightUniformsLib}=await import('./vendor/RectAreaLightUniformsLib.js');RectAreaLightUniformsLib.init();ready=true;rebuild();syncScene();}catch{initializing=null;status('Lighting could not load. Reopen this tab to retry.');}})();return initializing;}
 function rebuild(){
  for(const n of nodes){group.remove(n.area,n.spot,n.target);n.spot.dispose();helpers.remove(n.mesh,n.line);n.mesh.geometry.dispose();n.mesh.material.dispose();n.line.geometry.dispose();n.line.material.dispose();}nodes=[];
  if(!ready||!lit()){syncScene();return;}
  for(const l of liveRig().lights){
   const area=new THREE.RectAreaLight(),spot=new THREE.SpotLight(),target=new THREE.Object3D();spot.target=target;spot.castShadow=true;spot.shadow.mapSize.set(512,512);spot.shadow.bias=-.0002;spot.shadow.normalBias=.015;spot.shadow.camera.near=.05;spot.shadow.camera.far=35;
   const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xffe2a8,side:THREE.DoubleSide,transparent:true,opacity:.7}));mesh.userData.lightId=l.id;
   const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineDashedMaterial({color:0xc7ec9d,dashSize:.09,gapSize:.07,transparent:true,opacity:.8}));
   group.add(area,spot,target);helpers.add(mesh,line);nodes.push({id:l.id,area,spot,target,mesh,line});
  }
  syncScene();
 }
 function syncScene(){
  group.visible=lit()&&ready;helpers.visible=active()&&tab==='lighting'&&$('#light-show-shapes').checked;
  for(const [light,visible]of originalLights)light.visible=lit()&&ready?false:visible;
  for(const n of nodes){const l=liveRig()?.lights.find(l=>l.id===n.id);if(!l)continue;const on=l.enabled;
   n.area.visible=on&&l.type==='diffuse';n.spot.visible=on&&l.type==='spot';
   n.area.color.set(l.color);n.area.intensity=l.power*.22;n.area.width=l.width;n.area.height=l.height;n.area.position.fromArray(l.position);n.area.lookAt(...l.target);n.area.rotateZ(l.roll*Math.PI/180);
   n.spot.color.set(l.color);n.spot.intensity=l.power*.8;n.spot.distance=35;n.spot.decay=2;n.spot.angle=l.beam*Math.PI/360;n.spot.penumbra=l.edge/100;n.spot.position.fromArray(l.position);n.target.position.fromArray(l.target);
   n.mesh.position.copy(n.area.position);n.mesh.quaternion.copy(n.area.quaternion);n.mesh.scale.set(l.width,l.height,1);n.mesh.material.color.set(l.id===selected?'#c7ec9d':l.color);n.mesh.material.opacity=on?.75:.2;
   const a=n.line.geometry.attributes.position;a.setXYZ(0,...l.position);a.setXYZ(1,...l.target);a.needsUpdate=true;n.line.geometry.computeBoundingSphere();n.line.computeLineDistances();n.line.visible=l.id===selected;
  }
  api.invalidate();
 }
 function list(){const host=$('#light-chip-list');host.replaceChildren(...rig.lights.map(l=>{const b=document.createElement('button');b.type='button';b.className='light-chip';b.dataset.lightId=l.id;b.setAttribute('aria-pressed',l.id===selected);b.classList.toggle('off',!l.enabled);const dot=document.createElement('i');dot.setAttribute('aria-hidden','true');b.append(dot,l.name);b.setAttribute('aria-label',l.name+(l.enabled?'':' (off)'));b.onclick=()=>{hideUndo();selected=selected===l.id?null:l.id;locked=false;cancelPick();sync();};return b;}));$('#light-add').disabled=rig.lights.length>=6;host.querySelector('[aria-pressed=true]')?.scrollIntoView({block:'nearest',inline:'nearest'});}
 // Readable values: feet and inches for distances, plain directions around the subject.
 const feet=v=>{const t=Math.round(v*12),f=Math.floor(t/12),i=t-f*12;return f?`${f}′${i?` ${i}″`:''}`:`${i}″`;},turn=v=>{const a=Math.round(v),m=Math.abs(a);return m<=5?'Front':m>=175?'Behind':`${m}° ${a>0?'right':'left'}`;};
 const shown={power:v=>Math.round(v)+'%',rotation:turn,aimRotation:turn,elevation:feet,distance:feet,aimHeight:feet,aimDistance:feet,width:v=>Math.round(v)+'″',height:v=>Math.round(v)+'″',roll:v=>Math.round(v)+'°',beam:v=>Math.round(v)+'°',edge:v=>Math.round(v)+'%'};
 const mapping={rotation:['position','rotation',1],elevation:['position','height',FT],distance:['position','distance',FT],aimRotation:['target','rotation',1],aimHeight:['target','height',FT],aimDistance:['target','distance',FT]},angles=new Map();
 const subject=()=>api.getFigures()?.position.toArray()??[0,0,48*IN];
 function coordinates(l,key){const id=l.id+':'+key,c=subjectCoordinates(l[key],subject(),angles.get(id)||0);angles.set(id,c.rotation);return c;}
 function sync(){list();const l=current();$('#light-editor').hidden=!l;$('#light-none').hidden=!!l||!rig.lights.length;if(!l){syncScene();return;}
  if($('#light-name').hidden)$('#light-name').value=l.name;$('#light-title').textContent=l.name;$('#light-rename').setAttribute('aria-label','Rename '+l.name);$('#light-enabled').querySelector('b').textContent=l.enabled?'On':'Off';$('#light-enabled').setAttribute('aria-pressed',l.enabled);$('#light-enabled').setAttribute('aria-label',(l.enabled?'Turn off ':'Turn on ')+l.name);
  panel.querySelectorAll('[data-light-type]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.lightType===l.type));
  for(const input of panel.querySelectorAll('[data-light-field]')){const k=input.dataset.lightField,m=mapping[k],v=m?coordinates(l,m[0])[m[1]]/m[2]:['width','height'].includes(k)?l[k]/IN:l[k];if(m){input.min=Math.min(+input.min,v);input.max=Math.max(+input.max,v);}input.value=v;$('#light-'+k+'-value').textContent=(shown[k]||(x=>Math.round(x*100)/100))(v);}
  const pos=coordinates(l,'position'),h=pos.height/FT,d=pos.distance/FT;
  $('#light-pad-readout').textContent=turn(pos.rotation)+' · '+feet(h)+' high';$('#light-strip-readout').textContent=feet(d);
  $('#light-ratio').textContent='Aspect ratio '+(l.width/l.height).toFixed(2)+' : 1';$('#light-lock').setAttribute('aria-pressed',locked);$('#light-lock').textContent=locked?'Ratio locked':'Lock ratio';$('#light-color').value=l.color;$('#light-spot-controls').hidden=l.type!=='spot';$('#light-duplicate').disabled=rig.lights.length>=6;
  $('#light-size-note').textContent=l.type==='diffuse'?'The whole panel glows. Bigger shapes give softer light; narrow strips make a thin edge light.':'Size only changes the marker. Beam width and edge softness set the spotlight’s coverage.';
  syncScene();
 }
 function commit(next){try{rig=normalizeLightingRig(next);sync();persist();}catch(e){status(e.message);sync();}}
 function edit(change){const next=structuredClone(rig),l=next.lights.find(l=>l.id===selected);if(l){change(l);commit(next);}}
 function cancelPick(){picking=null;$('#light-place').setAttribute('aria-pressed','false');$('#light-aim').setAttribute('aria-pressed','false');api.renderer.domElement.style.cursor='';document.querySelector('#light-pick-banner')?.remove();}
 function selectTab(next){tab=next;try{localStorage.setItem('rc-set-shot-controls',next);}catch{}if(next==='camera'&&overview){restoreShot(overview);overview=null;$('#light-return').hidden=true;}cameraPanel.hidden=next!=='camera';panel.hidden=next!=='lighting';cancelPick();for(const b of tabs.children){const on=b.id==='shot-tab-'+next;b.setAttribute('aria-selected',on);b.tabIndex=on?0:-1;}syncScene();}
 for(const name of ['camera','lighting'])document.querySelector('#shot-tab-'+name).onclick=()=>selectTab(name);
 tabs.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();selectTab(e.key==='Home'?'camera':e.key==='End'?'lighting':tab==='camera'?'lighting':'camera');document.querySelector('#shot-tab-'+tab).focus();};
 // Tap the name (or the pencil) to rename in place. Enter or leaving the field saves; Escape cancels; blank keeps the old name.
 const nameInput=$('#light-name'),renaming=on=>{nameInput.hidden=!on;$('#light-title').hidden=on;$('#light-rename').hidden=on;};
 function startRename(){const l=current();if(!l)return;nameInput.value=l.name;renaming(true);nameInput.focus();nameInput.select();}
 function finishRename(save){if(nameInput.hidden)return;const value=nameInput.value.trim();renaming(false);if(save&&value&&value!==current()?.name)edit(l=>l.name=value);else sync();}
 $('#light-title').onclick=startRename;$('#light-rename').onclick=startRename;
 nameInput.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();finishRename(true);}else if(e.key==='Escape'){e.preventDefault();finishRename(false);}};nameInput.onblur=()=>finishRename(true);$('#light-enabled').onclick=()=>edit(l=>l.enabled=!l.enabled);
 panel.querySelectorAll('[data-light-type]').forEach(b=>b.onclick=()=>edit(l=>l.type=b.dataset.lightType));
 panel.querySelectorAll('[data-light-field]').forEach(input=>input.oninput=()=>edit(l=>{const k=input.dataset.lightField,v=+input.value,m=mapping[k];if(m){const c=coordinates(l,m[0]);c[m[1]]=v*m[2];angles.set(l.id+':'+m[0],c.rotation);l[m[0]]=subjectPoint(c,subject());}else if(['width','height'].includes(k)){const other=k==='width'?'height':'width',ratio=l[other]/l[k];l[k]=v*IN;if(locked){l[other]=l[k]*ratio;if(l[other]<3*IN){l[other]=3*IN;l[k]=l[other]/ratio;}if(l[other]>144*IN){l[other]=144*IN;l[k]=l[other]/ratio;}}}else l[k]=v;}));
 // Trackpads move relative to where the drag starts, like a laptop trackpad, and feed the position sliders.
 function nudge(key,value){const input=$('#light-'+key);if(key==='rotation')value=((value+180)%360+360)%360-180;input.value=Math.min(+input.max,Math.max(+input.min,value));input.dispatchEvent(new Event('input'));}
 function trackpad(el,axes){let drag=null;
  el.addEventListener('pointerdown',e=>{if(!current()||!e.isPrimary)return;e.preventDefault();el.setPointerCapture(e.pointerId);el.classList.add('dragging');drag={x:e.clientX,y:e.clientY,start:Object.fromEntries(axes.map(([key])=>[key,+$('#light-'+key).value]))};});
  el.addEventListener('pointermove',e=>{if(!drag)return;for(const [key,axis,rate] of axes)nudge(key,drag.start[key]+(axis==='x'?e.clientX-drag.x:drag.y-e.clientY)*rate);});
  const end=()=>{drag=null;el.classList.remove('dragging');};el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
  el.addEventListener('keydown',e=>{const step=e.shiftKey?4:1;for(const [key,axis,,keyStep] of axes){const delta=axis==='x'?{ArrowRight:1,ArrowLeft:-1}[e.key]:{ArrowUp:1,ArrowDown:-1}[e.key];if(delta&&current()){e.preventDefault();nudge(key,+$('#light-'+key).value+delta*keyStep*step);}}});
 }
 trackpad($('#light-pad'),[['rotation','x',1.2,5],['elevation','y',.06,.25]]);trackpad($('#light-strip'),[['distance','y',.1,.25]]);
 $('#light-lock').onclick=()=>{locked=!locked;sync();};$('#light-color').oninput=e=>edit(l=>l.color=e.target.value);
 panel.querySelectorAll('[data-light-preset]').forEach(b=>b.onclick=()=>{locked=false;edit(l=>{l.type='diffuse';const [w,h]={softbox:[36,48],strip:[12,48],square:[48,48]}[b.dataset.lightPreset];l.width=w*IN;l.height=h*IN;});});
 panel.querySelectorAll('[data-light-edge]').forEach(b=>b.onclick=()=>edit(l=>l.edge=+b.dataset.lightEdge));
 function add(copy=false){if(rig.lights.length>=6)return;hideUndo();const l=structuredClone(copy&&current()?current():defaultLightingRig().lights[0]);l.id=crypto.randomUUID();l.name=copy?l.name.slice(0,33)+' copy':'Light '+(rig.lights.length+1);l.position[0]=Math.min(6,l.position[0]+.5);selected=l.id;rig.lights.push(l);rebuild();sync();persist();startRename();}
 $('#light-add').onclick=()=>add();$('#light-duplicate').onclick=()=>add(true);
 // Removing a light is one tap from its header; Undo appears right under the chips for ten seconds.
 let removed=null,undoTimer;const undoBar=$('#light-undo'),hideUndo=()=>{clearTimeout(undoTimer);undoBar.hidden=true;removed=null;};
 $('#light-remove').onclick=()=>{const l=current();if(!l)return;removed={light:l,index:rig.lights.findIndex(x=>x.id===l.id)};rig.lights=rig.lights.filter(x=>x.id!==l.id);selected=null;cancelPick();rebuild();sync();persist();
  undoBar.querySelector('span').textContent=l.name+' removed';undoBar.hidden=false;clearTimeout(undoTimer);undoTimer=setTimeout(hideUndo,10000);};
 undoBar.querySelector('button').onclick=()=>{if(!removed||rig.lights.length>=6){hideUndo();return;}rig.lights.splice(removed.index,0,removed.light);selected=removed.light.id;hideUndo();rebuild();sync();persist();};
 $('#light-show-shapes').onchange=syncScene;
 $('#light-reset').onclick=()=>{$('#light-reset-confirm').hidden=false;$('#light-reset-cancel').focus();};$('#light-reset-cancel').onclick=()=>{$('#light-reset-confirm').hidden=true;};$('#light-reset-yes').onclick=()=>{rig=defaultLightingRig();selected=null;locked=false;cancelPick();$('#light-reset-confirm').hidden=true;rebuild();sync();persist();status('Soft three-point setup restored.');};
 const snapshot=()=>({position:api.camera.position.toArray(),target:api.orbit.target.toArray(),lens:api.lens.get()});
 function restoreShot(s){const damping=api.orbit.enableDamping;api.orbit.enableDamping=false;api.orbit.update();api.lens.set(s.lens);api.camera.position.fromArray(s.position);api.orbit.target.fromArray(s.target);api.camera.lookAt(api.orbit.target);api.orbit.update();api.orbit.enableDamping=damping;api.invalidate();}
 $('#light-overview').onclick=()=>{overview??=snapshot();api.lens.set({on:false});const box=new THREE.Box3().setFromObject(api.getSet());for(const l of rig.lights)box.expandByPoint(new THREE.Vector3(...l.position));const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()).length(),fov=THREE.MathUtils.degToRad(Math.min(api.camera.fov,api.camera.fov*api.camera.aspect)),distance=Math.min(42,size/2/Math.tan(fov/2)*1.15);const shot={position:center.clone().add(new THREE.Vector3(.35,.7,1).normalize().multiplyScalar(distance)).toArray(),target:center.toArray(),lens:{...api.lens.get(),on:false}};restoreShot(shot);$('#light-return').hidden=false;};
 $('#light-return').onclick=()=>{if(overview)restoreShot(overview);overview=null;$('#light-return').hidden=true;};
 function startPick(kind){if(picking===kind){cancelPick();return;}cancelPick();picking=kind;$('#light-'+(kind==='position'?'place':'aim')).setAttribute('aria-pressed','true');const banner=document.createElement('div');banner.id='light-pick-banner';const label=document.createElement('span');label.textContent=kind==='position'?'Tap the ground to place this light':'Tap the set to aim this light';const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.onclick=cancelPick;banner.append(label,cancel);document.querySelector('.viewport').append(banner);api.renderer.domElement.style.cursor='crosshair';}
 $('#light-place').onclick=()=>startPick('position');$('#light-aim').onclick=()=>startPick('target');
 const canvas=api.renderer.domElement,ray=new THREE.Raycaster(),point=new THREE.Vector2();let down=null;
 canvas.addEventListener('pointerdown',e=>{if(e.isPrimary)down={x:e.clientX,y:e.clientY,id:e.pointerId};else down=null;},{passive:true});
 canvas.addEventListener('pointercancel',()=>down=null);
 canvas.addEventListener('pointerup',e=>{if(!down||down.id!==e.pointerId||Math.hypot(e.clientX-down.x,e.clientY-down.y)>8){down=null;return;}down=null;if(!active()||tab!=='lighting')return;const rect=canvas.getBoundingClientRect();point.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(point,api.camera);
  if(!picking){if(helpers.visible){const hit=ray.intersectObjects(nodes.map(n=>n.mesh))[0];selected=hit?hit.object.userData.lightId:null;locked=false;sync();}return;}
  let hit;if(picking==='target')hit=ray.intersectObjects([api.getSet(),api.getFloor()].filter(Boolean),true)[0]?.point;
  hit??=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());
  if(!hit||Math.abs(hit.x)>6.096||hit.z< -3.048||hit.z>7.62){status('Tap closer to the set, or use the position sliders.');return;}
  const key=picking;edit(l=>{l[key]=[hit.x,key==='position'?l.position[1]:Math.max(0,hit.y),hit.z];});cancelPick();status(key==='position'?'Light placed. Adjust its height above.':'Aim updated.');
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape')cancelPick();});
 api.lighting={preview:async raw=>{preview=raw?normalizeLightingRig(raw):null;if(preview&&!ready)await initialize();rebuild();},get:()=>structuredClone(rig),set:raw=>{rig=normalizeLightingRig(raw);selected=null;locked=false;cancelPick();rebuild();sync();persist();}};
 const baseMode=api.setMode;api.setMode=m=>{cancelPick();const r=baseMode(m);if(m==='cameras')initialize();rebuild();return r;};
 window.addEventListener('set-configured',sync);
 syncScene();sync();
 try{if(localStorage.getItem('rc-set-shot-controls')==='lighting')selectTab('lighting');}catch{}
}
