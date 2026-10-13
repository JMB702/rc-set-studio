import * as THREE from 'three';
import {defaultLightingRig,normalizeLightingRig} from './lighting-state.js';

const STORAGE='rc-set-lighting-v1',FT=.3048,IN=.0254;
export function installLighting(api){
 const host=document.querySelector('#camera-positions'),cameraPanel=document.createElement('div');
 cameraPanel.id='shot-camera-panel';cameraPanel.setAttribute('role','tabpanel');cameraPanel.setAttribute('aria-labelledby','shot-tab-camera');
 while(host.firstChild)cameraPanel.append(host.firstChild);host.append(cameraPanel);
 const tabs=document.createElement('div');tabs.className='shot-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Shot controls');
 tabs.innerHTML='<button id="shot-tab-camera" role="tab" aria-controls="shot-camera-panel" aria-selected="true">Camera controls</button><button id="shot-tab-lighting" role="tab" aria-controls="shot-lighting-panel" aria-selected="false" tabindex="-1">Lighting controls</button>';host.prepend(tabs);
 const panel=document.createElement('section');panel.id='shot-lighting-panel';panel.hidden=true;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','shot-tab-lighting');host.append(panel);
 const range=(key,label,min,max,step=1)=>`<label class="light-range" for="light-${key}"><span>${label}</span><output id="light-${key}-value" for="light-${key}"></output><input id="light-${key}" data-light-field="${key}" type="range" min="${min}" max="${max}" step="${step}"></label>`;
 panel.innerHTML=`<div class="light-intro"><h2>Light the scene</h2><p>Key, fill &amp; rim · soft three-point starting setup</p></div>
 <div class="light-toolbar"><label for="light-picker">Selected light<select id="light-picker"></select></label><button id="light-add" type="button">+ Add</button></div>
 <div id="light-editor">
 <div class="light-name-row"><input id="light-name" aria-label="Light name" maxlength="40"><button id="light-enabled" aria-pressed="true">On</button></div>
 <div class="light-types" role="group" aria-label="Light type"><button data-light-type="diffuse" aria-pressed="true">Diffuse</button><button data-light-type="spot" aria-pressed="false">Spotlight</button></div>
 <details id="light-placement" open><summary>Position &amp; aim <span>+</span></summary>
 <div class="light-actions"><button id="light-place">Place in scene</button><button id="light-aim">Aim in scene</button></div><p class="hint">Tap a position in the view, or use the sliders. All distances are from the set origin.</p>
 ${range('x','Left / right (ft)',-20,20,.25)}${range('z','Back / front (ft)',-10,25,.25)}${range('y','Height (ft)',.5,16,.25)}
 <details id="light-aim-details"><summary>Fine-tune aim <span>+</span></summary>${range('tx','Aim left / right (ft)',-20,20,.25)}${range('tz','Aim back / front (ft)',-10,25,.25)}${range('ty','Aim height (ft)',0,16,.25)}</details></details>
 <details id="light-shape" open><summary>Shape &amp; size <span>+</span></summary>
 <div class="light-presets" role="group" aria-label="Light shape presets"><button data-light-preset="softbox">Softbox</button><button data-light-preset="strip">Strip</button><button data-light-preset="square">Square</button></div>
 ${range('width','Width (in)',3,144)}${range('height','Height (in)',3,144)}
 <div class="light-ratio-row"><span id="light-ratio"></span><button id="light-lock" aria-pressed="false">Lock ratio</button></div>${range('roll','Rotation (°)',-180,180)}
 <p class="hint" id="light-size-note"></p></details>
 <details id="light-output" open><summary>Output &amp; edge <span>+</span></summary>${range('power','Intensity (%)',0,200)}
 <label class="light-color">Light color<input id="light-color" type="color" value="#fff5e6"></label>
 <div id="light-spot-controls">${range('beam','Beam angle (°)',10,120)}${range('edge','Edge feather (%)',0,100)}<div class="light-presets"><button data-light-edge="0">Hard</button><button data-light-edge="50">Soft</button><button data-light-edge="100">Feathered</button></div></div></details>
 <div class="light-actions"><button id="light-duplicate">Duplicate</button><button id="light-remove">Remove light</button></div></div>
 <div class="light-view-options"><label><input id="light-show-shapes" type="checkbox" checked> Show light shapes</label><button id="light-overview">View entire rig</button><button id="light-return" hidden>Return to shot</button></div>
 <button id="light-reset">Reset to soft three-point</button><p id="light-status" role="status" aria-live="polite"></p><p class="hint">Saved on this device. Save or update a camera position to include its lighting across devices. Preview is approximate; diffuse-light shadows are not simulated.</p>
 <div id="light-reset-confirm" hidden><p>Replace your current lights with the soft three-point setup?</p><div class="light-actions"><button id="light-reset-cancel">Cancel</button><button id="light-reset-yes">Replace lights</button></div></div>`;
 panel.addEventListener('pointerdown',()=>api.cancelCameraMove?.(),{capture:true,passive:true});
 const $=s=>panel.querySelector(s);let rig=defaultLightingRig(),selected,tab='camera',picking=null,locked=false,overview=null,ready=false,initializing=null;
 try{const saved=localStorage.getItem(STORAGE);if(saved)rig=normalizeLightingRig(JSON.parse(saved));}catch{}
 selected=rig.lights[0]?.id;
 const group=new THREE.Group();group.name='Lighting rig';api.scene.add(group);
 const helpers=new THREE.Group();helpers.name='Light placement shapes';api.scene.add(helpers);
 const originalLights=api.scene.children.filter(o=>o.isLight).map(o=>[o,o.visible]);
 const ambient=new THREE.HemisphereLight(0xe7edff,0x292c35,.35);group.add(ambient);
 let nodes=[],saveTimer;
 const flush=()=>{clearTimeout(saveTimer);try{localStorage.setItem(STORAGE,JSON.stringify(rig));}catch{status('Device storage is unavailable. Save a camera position to keep this rig.');}};
 window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});
 const active=()=>api.state.mode==='cameras',current=()=>rig.lights.find(l=>l.id===selected);
 function status(text){$('#light-status').textContent=text;}
 function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(flush,160);window.dispatchEvent(new Event('lighting-changed'));}
 async function initialize(){if(initializing)return initializing;initializing=(async()=>{try{const {RectAreaLightUniformsLib}=await import('./vendor/RectAreaLightUniformsLib.js');RectAreaLightUniformsLib.init();ready=true;rebuild();syncScene();}catch{initializing=null;status('Lighting could not load. Reopen this tab to retry.');}})();return initializing;}
 function rebuild(){
  for(const n of nodes){group.remove(n.area,n.spot,n.target);n.spot.dispose();helpers.remove(n.mesh,n.line);n.mesh.geometry.dispose();n.mesh.material.dispose();n.line.geometry.dispose();n.line.material.dispose();}nodes=[];
  if(!ready)return;
  for(const l of rig.lights){
   const area=new THREE.RectAreaLight(),spot=new THREE.SpotLight(),target=new THREE.Object3D();spot.target=target;spot.castShadow=true;spot.shadow.mapSize.set(512,512);spot.shadow.bias=-.0002;spot.shadow.normalBias=.015;spot.shadow.camera.near=.05;spot.shadow.camera.far=35;
   const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xffe2a8,side:THREE.DoubleSide,transparent:true,opacity:.7}));mesh.userData.lightId=l.id;
   const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineDashedMaterial({color:0xc7ec9d,dashSize:.09,gapSize:.07,transparent:true,opacity:.8}));
   group.add(area,spot,target);helpers.add(mesh,line);nodes.push({id:l.id,area,spot,target,mesh,line});
  }
  syncScene();
 }
 function syncScene(){
  group.visible=active()&&ready;helpers.visible=active()&&tab==='lighting'&&$('#light-show-shapes').checked;
  for(const [light,visible]of originalLights)light.visible=active()&&ready?false:visible;
  for(const n of nodes){const l=rig.lights.find(l=>l.id===n.id),on=l.enabled;
   n.area.visible=on&&l.type==='diffuse';n.spot.visible=on&&l.type==='spot';
   n.area.color.set(l.color);n.area.intensity=l.power*.22;n.area.width=l.width;n.area.height=l.height;n.area.position.fromArray(l.position);n.area.lookAt(...l.target);n.area.rotateZ(l.roll*Math.PI/180);
   n.spot.color.set(l.color);n.spot.intensity=l.power*.8;n.spot.distance=35;n.spot.decay=2;n.spot.angle=l.beam*Math.PI/360;n.spot.penumbra=l.edge/100;n.spot.position.fromArray(l.position);n.target.position.fromArray(l.target);
   n.mesh.position.copy(n.area.position);n.mesh.quaternion.copy(n.area.quaternion);n.mesh.scale.set(l.width,l.height,1);n.mesh.material.color.set(l.id===selected?'#c7ec9d':l.color);n.mesh.material.opacity=on?.75:.2;
   const a=n.line.geometry.attributes.position;a.setXYZ(0,...l.position);a.setXYZ(1,...l.target);a.needsUpdate=true;n.line.geometry.computeBoundingSphere();n.line.computeLineDistances();n.line.visible=l.id===selected;
  }
  api.invalidate();
 }
 function list(){const picker=$('#light-picker');picker.replaceChildren(...rig.lights.map(l=>{const o=document.createElement('option');o.value=l.id;o.textContent=l.name+(l.enabled?'':' · Off');return o;}));picker.value=selected||'';picker.disabled=!rig.lights.length;$('#light-add').disabled=rig.lights.length>=6;}
 const mapping={x:['position',0,FT],y:['position',1,FT],z:['position',2,FT],tx:['target',0,FT],ty:['target',1,FT],tz:['target',2,FT]};
 function sync(){list();const l=current();$('#light-editor').hidden=!l;if(!l){syncScene();return;}
  $('#light-name').value=l.name;$('#light-enabled').textContent=l.enabled?'On':'Off';$('#light-enabled').setAttribute('aria-pressed',l.enabled);
  panel.querySelectorAll('[data-light-type]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.lightType===l.type));
  for(const input of panel.querySelectorAll('[data-light-field]')){const k=input.dataset.lightField,m=mapping[k],v=m?l[m[0]][m[1]]/m[2]:['width','height'].includes(k)?l[k]/IN:l[k];input.value=v;$('#light-'+k+'-value').textContent=Math.round(v*100)/100;}
  $('#light-ratio').textContent='Aspect ratio '+(l.width/l.height).toFixed(2)+' : 1';$('#light-lock').setAttribute('aria-pressed',locked);$('#light-lock').textContent=locked?'Ratio locked':'Lock ratio';$('#light-color').value=l.color;$('#light-spot-controls').hidden=l.type!=='spot';$('#light-duplicate').disabled=rig.lights.length>=6;
  $('#light-size-note').textContent=l.type==='diffuse'?'The rectangular surface emits light. Wider shapes create softboxes and narrow shapes create strips.':'Size changes the source marker. Beam angle and edge feather control the spotlight coverage.';
  syncScene();
 }
 function commit(next){try{rig=normalizeLightingRig(next);sync();persist();}catch(e){status(e.message);sync();}}
 function edit(change){const next=structuredClone(rig),l=next.lights.find(l=>l.id===selected);if(l){change(l);commit(next);}}
 function cancelPick(){picking=null;$('#light-place').setAttribute('aria-pressed','false');$('#light-aim').setAttribute('aria-pressed','false');api.renderer.domElement.style.cursor='';document.querySelector('#light-pick-banner')?.remove();}
 function selectTab(next){tab=next;try{localStorage.setItem('rc-set-shot-controls',next);}catch{}if(next==='camera'&&overview){restoreShot(overview);overview=null;$('#light-return').hidden=true;}cameraPanel.hidden=next!=='camera';panel.hidden=next!=='lighting';cancelPick();for(const b of tabs.children){const on=b.id==='shot-tab-'+next;b.setAttribute('aria-selected',on);b.tabIndex=on?0:-1;}syncScene();}
 for(const name of ['camera','lighting'])document.querySelector('#shot-tab-'+name).onclick=()=>selectTab(name);
 tabs.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();selectTab(e.key==='Home'?'camera':e.key==='End'?'lighting':tab==='camera'?'lighting':'camera');document.querySelector('#shot-tab-'+tab).focus();};
 $('#light-picker').onchange=e=>{selected=e.target.value;locked=false;cancelPick();sync();};
 $('#light-name').onchange=e=>edit(l=>l.name=e.target.value.trim());$('#light-enabled').onclick=()=>edit(l=>l.enabled=!l.enabled);
 panel.querySelectorAll('[data-light-type]').forEach(b=>b.onclick=()=>edit(l=>l.type=b.dataset.lightType));
 panel.querySelectorAll('[data-light-field]').forEach(input=>input.oninput=()=>edit(l=>{const k=input.dataset.lightField,v=+input.value,m=mapping[k];if(m)l[m[0]][m[1]]=v*m[2];else if(['width','height'].includes(k)){const other=k==='width'?'height':'width',ratio=l[other]/l[k];l[k]=v*IN;if(locked){l[other]=l[k]*ratio;if(l[other]<3*IN){l[other]=3*IN;l[k]=l[other]/ratio;}if(l[other]>144*IN){l[other]=144*IN;l[k]=l[other]/ratio;}}}else l[k]=v;}));
 $('#light-lock').onclick=()=>{locked=!locked;sync();};$('#light-color').oninput=e=>edit(l=>l.color=e.target.value);
 panel.querySelectorAll('[data-light-preset]').forEach(b=>b.onclick=()=>{locked=false;edit(l=>{l.type='diffuse';const [w,h]={softbox:[36,48],strip:[12,48],square:[48,48]}[b.dataset.lightPreset];l.width=w*IN;l.height=h*IN;});});
 panel.querySelectorAll('[data-light-edge]').forEach(b=>b.onclick=()=>edit(l=>l.edge=+b.dataset.lightEdge));
 function add(copy=false){if(rig.lights.length>=6)return;const l=structuredClone(copy&&current()?current():defaultLightingRig().lights[0]);l.id=crypto.randomUUID();l.name=copy?l.name.slice(0,33)+' copy':'Light '+(rig.lights.length+1);l.position[0]=Math.min(6,l.position[0]+.5);selected=l.id;rig.lights.push(l);rebuild();sync();persist();}
 $('#light-add').onclick=()=>add();$('#light-duplicate').onclick=()=>add(true);
 let removed=null;$('#light-remove').onclick=()=>{removed={light:current(),index:rig.lights.findIndex(l=>l.id===selected)};rig.lights=rig.lights.filter(l=>l.id!==selected);selected=rig.lights[0]?.id;cancelPick();rebuild();sync();persist();status('Light removed. ');const undo=document.createElement('button');undo.textContent='Undo';undo.onclick=()=>{if(!removed||rig.lights.length>=6)return;rig.lights.splice(removed.index,0,removed.light);selected=removed.light.id;removed=null;rebuild();sync();persist();status('Light restored.');};$('#light-status').append(undo);};
 $('#light-show-shapes').onchange=syncScene;
 $('#light-reset').onclick=()=>{$('#light-reset-confirm').hidden=false;$('#light-reset-cancel').focus();};$('#light-reset-cancel').onclick=()=>{$('#light-reset-confirm').hidden=true;};$('#light-reset-yes').onclick=()=>{rig=defaultLightingRig();selected=rig.lights[0].id;locked=false;cancelPick();$('#light-reset-confirm').hidden=true;rebuild();sync();persist();status('Soft three-point setup restored.');};
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
  if(!picking){if(helpers.visible){const hit=ray.intersectObjects(nodes.map(n=>n.mesh))[0];if(hit){selected=hit.object.userData.lightId;locked=false;sync();}}return;}
  let hit;if(picking==='target')hit=ray.intersectObjects([api.getSet(),api.getFloor()].filter(Boolean),true)[0]?.point;
  hit??=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());
  if(!hit||Math.abs(hit.x)>6.096||hit.z< -3.048||hit.z>7.62){status('Tap closer to the set, or use the position sliders.');return;}
  const key=picking;edit(l=>{l[key]=[hit.x,key==='position'?l.position[1]:Math.max(0,hit.y),hit.z];});cancelPick();status(key==='position'?'Light placed. Adjust its height below.':'Aim updated.');
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape')cancelPick();});
 api.lighting={get:()=>structuredClone(rig),set:raw=>{rig=normalizeLightingRig(raw);selected=rig.lights[0]?.id;locked=false;cancelPick();rebuild();sync();persist();}};
 const baseMode=api.setMode;api.setMode=m=>{cancelPick();const r=baseMode(m);if(m==='cameras')initialize();syncScene();return r;};
 syncScene();sync();
 try{if(localStorage.getItem('rc-set-shot-controls')==='lighting')selectTab('lighting');}catch{}
}
