// Clothing colors for the scale figures: one card per person in the current scene, each with a
// shirt row and a pants (or shorts) row. Swatches apply instantly; the last swatch opens the
// device color picker. Colors live in state.clothing, so a person keeps their outfit across scenes.
import {figurePeople,sceneCast} from './podcast.js';

const palette=[['White','#ecebe6'],['Black','#1d1f21'],['Gray','#8a8d8f'],['Navy','#26364d'],['Royal blue','#3559b5'],['Red','#b3372f'],['Orange','#e8641f'],['Olive','#5f6b3a'],['Tan','#b59a72']];
const skin={host:'#d8ab8b',woman:'#d8ab8b',rapper:'#5b3a29'};
const sides=['Left','Right'];
// Skip palette colors that look the same as a person's original (the original swatch already covers them).
const rgbOf=c=>c.slice(1).match(/../g).map(x=>parseInt(x,16)),far=(a,b)=>Math.hypot(...rgbOf(a).map((n,i)=>n-rgbOf(b)[i]))>24;
const name=(id,part,c)=>c===figurePeople[id][part]?'Original':palette.find(p=>p[1]===c)?.[0]||'Custom';

// A small front-on figure tinted with the person's current clothes, so each card reads at a glance.
function silhouette(id){
 const shorts=figurePeople[id].lower==='Shorts';
 return `<svg class="wear-figure" viewBox="0 0 28 48" aria-hidden="true"><circle cx="14" cy="6" r="4.6" fill="${skin[id]}"/><path class="wear-shirt" d="M6 13.5q0-2.5 3-2.5h10q3 0 3 2.5V27H6z"/><rect class="wear-arm" x="2.4" y="12" width="3.4" height="13" rx="1.7"/><rect class="wear-arm" x="22.2" y="12" width="3.4" height="13" rx="1.7"/><path class="wear-pants" d="M6.5 26.5h15V${shorts?36:46}h-6.6L14 31l-.9 ${shorts?5:15}H6.5z"/>${shorts?`<rect x="7.3" y="36" width="4.6" height="10" fill="${skin[id]}"/><rect x="16.1" y="36" width="4.6" height="10" fill="${skin[id]}"/>`:''}</svg>`;
}
function row(id,part){
 const p=figurePeople[id],label=part==='shirt'?'Shirt':p.lower,colors=[['Original',p[part]],...palette.filter(([,c])=>far(c,p[part]))];
 return `<div class="wear-row" data-part="${part}"><div class="field-label"><span>${label}</span><output></output></div><div class="swatches wear-swatches" role="group" aria-label="${p.label} ${label.toLowerCase()} color">${colors.map(([n,c])=>`<button type="button" class="swatch${n==='Original'?' original':''}" data-wear="${c}" style="--c:${c}" aria-label="${n}${n==='Original'?` (${c})`:''}" title="${n}" aria-pressed="false"></button>`).join('')}<label class="swatch custom" title="Custom color"><input type="color" aria-label="Custom ${label.toLowerCase()} color for the ${p.label.toLowerCase()}"></label></div></div>`;
}
function card(id,i){
 return `<div class="wear-card" data-person="${id}">${silhouette(id)}<div class="wear-body"><div class="wear-head"><div><strong>${figurePeople[id].label}</strong><span>${sides[i]} from the front</span></div><button type="button" class="wear-reset">Reset</button></div>${row(id,'shirt')}${row(id,'pants')}</div></div>`;
}

export function installClothing(api){
 const S=api.state,host=document.querySelector('#clothing');if(!host)return;
 let cast='';
 function refresh(){
  const ids=sceneCast[S.figures]||[];
  if(ids.join()!==cast){cast=ids.join();host.innerHTML=`<div class="field-label"><span>Clothing</span></div>${ids.map(card).join('')}`;}
  for(const c of host.querySelectorAll('.wear-card')){
   const id=c.dataset.person,wear=S.clothing[id];
   c.querySelector('.wear-shirt').setAttribute('fill',wear.shirt);c.querySelectorAll('.wear-arm').forEach(a=>a.setAttribute('fill',wear.shirt));c.querySelector('.wear-pants').setAttribute('fill',wear.pants);
   c.querySelector('.wear-reset').hidden=wear.shirt===figurePeople[id].shirt&&wear.pants===figurePeople[id].pants;
   for(const r of c.querySelectorAll('.wear-row')){
    const part=r.dataset.part,color=wear[part];let match=false;
    r.querySelector('output').textContent=name(id,part,color);
    for(const b of r.querySelectorAll('[data-wear]')){const on=b.dataset.wear===color;match||=on;b.setAttribute('aria-pressed',on);}
    const custom=r.querySelector('.custom'),input=custom.querySelector('input');custom.classList.toggle('picked',!match);custom.style.setProperty('--c',match?'':color);if(document.activeElement!==input)input.value=color;
   }
  }
 }
 const set=(id,part,color)=>api.configure({clothing:{[id]:{[part]:color}}});
 host.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const c=b.closest('.wear-card'),id=c.dataset.person;
  if(b.dataset.wear)set(id,b.closest('.wear-row').dataset.part,b.dataset.wear);
  else if(b.classList.contains('wear-reset')){const p=figurePeople[id];api.configure({clothing:{[id]:{shirt:p.shirt,pants:p.pants}}});c.querySelector('.wear-swatches button')?.focus();}});
 // The device picker streams colors while it is open; apply at most once a frame.
 let pending=null;
 host.addEventListener('input',e=>{const i=e.target;if(i.type!=='color')return;const first=!pending;pending=[i.closest('.wear-card').dataset.person,i.closest('.wear-row').dataset.part,i.value];if(first)requestAnimationFrame(()=>{set(...pending);pending=null;});});
 api.setClothing=(id,part,color)=>set(id,part,color);
 window.addEventListener('set-configured',refresh);refresh();
}
