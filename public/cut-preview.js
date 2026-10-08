import * as T from 'three';
import {panel,platformParts,dispose,inch} from './model.js';
import {platformPlan} from './platform.js';
import {matchesCutPart} from './cut-selection.js';
export function installCutPreview(api){
 const list=document.querySelector('#cut-list'),details=document.querySelector('#cut-details');let preview=null,saved=null,active=null;
 const cue=document.createElement('div');cue.className='cut-preview-cue';cue.hidden=true;const label=document.createElement('span'),reset=document.createElement('button');reset.type='button';reset.textContent='Return to model';cue.append(label,reset);document.querySelector('.viewport').append(cue);
 function clear(){if(!preview)return;dispose(preview);preview=null;api.cutInspectionActive=false;for(const [o,visible]of saved.objects)if(o.parent===api.scene)o.visible=visible;api.camera.position.copy(saved.position);api.camera.far=saved.far;api.camera.updateProjectionMatrix();api.orbit.enableDamping=false;api.orbit.target.copy(saved.target);api.orbit.minDistance=saved.min;api.orbit.maxDistance=saved.max;api.orbit.update();api.orbit.enableDamping=true;saved=null;active=null;cue.hidden=true;list.querySelectorAll('[data-cut-part]').forEach(r=>{r.classList.remove('cut-selected');r.querySelector('button').setAttribute('aria-pressed','false')});api.invalidate();}
 function show(row){const key=JSON.stringify(row.dataset);if(key===active){clear();return;}clear();
  const selection={family:row.dataset.cutFamily,part:row.dataset.cutPart,length:row.dataset.cutLength===undefined?null:Number(row.dataset.cutLength)};
  const source=selection.family==='panel'?panel(api.state.height):platformParts(platformPlan(api.state.angle,api.state.platformBack,api.state.platformSide,api.state.platformAngle));
  const selected=source.children.filter(o=>o.isMesh&&matchesCutPart(selection,o.name,o.userData.cutLength));if(!selected.length){dispose(source);return;}
  saved={objects:api.scene.children.filter(o=>o.isGroup).map(o=>[o,o.visible]),position:api.camera.position.clone(),target:api.orbit.target.clone(),far:api.camera.far,min:api.orbit.minDistance,max:api.orbit.maxDistance};saved.objects.forEach(([o])=>o.visible=false);
  active=key;api.cutInspectionActive=true;preview=source;preview.name='Cut-list part inspection';api.scene.add(preview);
  const highlighted=new T.Box3();for(const o of source.children){if(!o.isMesh)continue;const hit=selected.includes(o);o.material=o.material.clone();o.material.transparent=!hit;o.material.opacity=hit?1:.06;o.material.depthWrite=hit;o.castShadow=hit;o.receiveShadow=false;
   if(hit){o.position.add(new T.Vector3(.10,.12,.45));o.material.color.lerp(new T.Color('#b8e67c'),.65);o.material.emissive.set('#344e18');o.material.emissiveIntensity=.25;const edge=new T.LineSegments(new T.EdgesGeometry(o.geometry),new T.LineBasicMaterial({color:0x456a22}));edge.raycast=()=>{};o.add(edge);o.geometry.computeBoundingBox();o.updateMatrixWorld(true);highlighted.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}
  }
  const center=highlighted.getCenter(new T.Vector3()),dir=new T.Vector3(.18,.22,1).normalize(),right=new T.Vector3().crossVectors(api.camera.up,dir).normalize(),up=new T.Vector3().crossVectors(dir,right).normalize(),tan=Math.tan(api.camera.fov*Math.PI/360);let distance=.8;
  for(const x of [highlighted.min.x,highlighted.max.x])for(const y of [highlighted.min.y,highlighted.max.y])for(const z of [highlighted.min.z,highlighted.max.z]){const d=new T.Vector3(x,y,z).sub(center);distance=Math.max(distance,d.dot(dir)+Math.abs(d.dot(right))/(tan*Math.max(.2,api.camera.aspect)),d.dot(dir)+Math.abs(d.dot(up))/tan);}distance*=1.25;
  api.orbit.enableDamping=false;api.orbit.target.copy(center);api.camera.position.copy(center).addScaledVector(dir,distance);api.orbit.minDistance=.3;api.orbit.maxDistance=Math.max(22,distance*2);api.camera.far=Math.max(60,distance*3);api.camera.updateProjectionMatrix();api.camera.lookAt(center);api.orbit.update();api.orbit.enableDamping=true;
  label.textContent=`${selection.part} · ${selected.length} ${selection.part==='Fascia strips'?'installed pieces':selected.length===1?'piece':'pieces'}`;cue.hidden=false;row.classList.add('cut-selected');row.querySelector('button').setAttribute('aria-pressed','true');api.invalidate();
 }
 list.addEventListener('click',e=>{const row=e.target.closest('[data-cut-part]');if(row)show(row)});reset.onclick=clear;details.addEventListener('toggle',()=>{if(!details.open)clear()});document.addEventListener('keydown',e=>{if(e.key==='Escape')clear()});window.addEventListener('comment-scene-reset',clear);window.addEventListener('set-configured',clear);
 api.clearCutInspection=clear;
 new ResizeObserver(()=>{if(preview){const row=list.querySelector('.cut-selected');if(row){active=null;show(row)}}}).observe(document.querySelector('#canvas-wrap'));
 const oldMode=api.setMode;api.setMode=m=>{clear();oldMode(m)};document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>api.setMode(b.dataset.mode));
 const oldStep=api.setStep;api.setStep=n=>{clear();return oldStep(n)};
}
