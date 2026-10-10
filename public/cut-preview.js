import * as T from 'three';
import {matchesCutPart} from './cut-selection.js';
// Highlight existing scene meshes in place. No camera, geometry transforms,
// visibility changes or replacement assembly are involved.
export function installCutPreview(api){
 const list=document.querySelector('#cut-list'),details=document.querySelector('#cut-details');let active=null,restores=[],overlays=[];
 function clear(){for(const [o,original,highlight]of restores){if(o.material===highlight)o.material=original;highlight.dispose();}restores=[];for(const o of overlays){o.removeFromParent();o.geometry.dispose();o.material.dispose();}overlays=[];active=null;list.querySelectorAll('[data-cut-part]').forEach(r=>{r.classList.remove('cut-selected');r.querySelector('button').setAttribute('aria-pressed','false')});api.invalidate();}
 function show(row){const key=JSON.stringify(row.dataset);if(key===active){clear();return;}clear();
  const selection={family:row.dataset.cutFamily,part:row.dataset.cutPart,deckId:row.dataset.cutDeck,length:row.dataset.cutLength===undefined?null:Number(row.dataset.cutLength)};
  const candidates=[];api.scene.traverse(o=>{if(!o.isMesh||o.userData.guideDecoration)return;const progress=api.constructionView&&!api.constructionView.completed;for(let p=o;p;p=p.parent){const visible=p.userData.progressOnly?progress:p.userData.completeOnly?!progress:p.visible;if(!visible)return;}candidates.push(o);});
  for(const o of candidates){
   if(matchesCutPart(selection,o.name,o.userData.cutLength,o.userData.deckId)){
    const original=o.material;if(Array.isArray(original))continue;const highlighted=original.clone();highlighted.color?.lerp(new T.Color('#b8e67c'),.65);highlighted.emissive?.set('#456326');highlighted.emissiveIntensity=.45;o.material=highlighted;restores.push([o,original,highlighted]);if(selection.deckId){const edge=new T.LineSegments(new T.EdgesGeometry(o.geometry),new T.LineBasicMaterial({color:'#62882f',depthTest:false}));edge.userData.guideDecoration=true;edge.raycast=()=>{};o.add(edge);overlays.push(edge);}
   }else if(selection.family==='panel'&&o.userData.commentParts){
    const parts=o.userData.commentParts.filter(p=>matchesCutPart(selection,p.label));if(!parts.length)continue;
    const g=new T.BufferGeometry();for(const [name,a]of Object.entries(o.geometry.attributes)){const values=[];for(const p of parts)for(let i=p.start*3;i<(p.start+p.count)*3;i++)for(let j=0;j<a.itemSize;j++)values.push(a.array[i*a.itemSize+j]);g.setAttribute(name,new T.Float32BufferAttribute(values,a.itemSize));}
    const m=new T.MeshStandardMaterial({color:0xb8e67c,emissive:0x456326,emissiveIntensity:.35,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});const mark=new T.Mesh(g,m);mark.userData.guideDecoration=true;mark.raycast=()=>{};o.add(mark);overlays.push(mark);
   }
  }
  active=key;row.classList.add('cut-selected');row.querySelector('button').setAttribute('aria-pressed','true');row.querySelector('button').title=restores.length||overlays.length?'Click again to clear highlight':'This part is not visible in the current build step or view.';api.invalidate();
 }
 list.addEventListener('click',e=>{const row=e.target.closest('[data-cut-part]');if(row)show(row)});details.addEventListener('toggle',()=>{if(!details.open)clear()});document.addEventListener('keydown',e=>{if(e.key==='Escape')clear()});window.addEventListener('comment-scene-reset',clear);window.addEventListener('set-configured',clear);
 api.clearCutInspection=clear;const oldMode=api.setMode;api.setMode=m=>{clear();oldMode(m)};document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>api.setMode(b.dataset.mode));const oldStep=api.setStep;api.setStep=n=>{clear();return oldStep(n)};
}
