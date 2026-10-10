// The one place the set is designed. Walls, platform and floor each follow the same pattern:
// choose it, size it, color it. Explore shows the editor open; the Build and Pricing guides show a
// one-line summary per part with an Edit button that opens the same editor in place.
import {mats} from './model.js';
import {platformPlan} from './platform.js';
// The design a first visit opens with, and what Revert to default restores in the Pricing guide.
export const defaultDesign={height:120,angle:45,wallColor:'#34383b',platformShape:'square',platformAngle:90,platformBack:12,platformSide:12,platformColor:'#34383b',floor:'charcoal',floorColor:'#34383b',figures:'rap',figureScale:1};
export const presets=[['Charcoal','#34383b'],['White','#ecece7'],['Warm gray','#96918a'],['Navy','#26364d'],['Forest','#344c40'],['Black','#181a1c']];
export const colorName=c=>presets.find(p=>p[1]===c)?.[0]||(c==='#3c4041'?'Charcoal':'Custom');
export const gapText=v=>v===0?'Flush':v%12?`${v>=12?Math.floor(v/12)+'′ ':''}${v%12}″`:`${v/12}′`;
const surfaces={wall:{key:'wallColor',label:'wall'},platform:{key:'platformColor',label:'platform'},floor:{key:'floorColor',label:'floor'}};
const choice=(attr,label,items)=>`<div class="choice" role="group" aria-label="${label}">${items.map(([v,t,sub])=>`<button type="button" ${attr}="${v}" aria-pressed="false"><strong>${t}</strong>${sub?`<span>${sub}</span>`:''}</button>`).join('')}</div>`;
const colorField=surface=>`<div class="field color-field" data-surface="${surface}"><div class="field-label"><span>Color</span><output></output></div><div class="swatches" role="group" aria-label="${surfaces[surface].label} color">${presets.map(([n,c])=>`<button type="button" class="swatch" data-color="${c}" style="--c:${c}" aria-label="${n}" title="${n}" aria-pressed="false"></button>`).join('')}<button type="button" class="swatch custom" aria-label="Custom ${surfaces[surface].label} color" title="Custom" aria-expanded="false"></button></div><div class="custom-panel" hidden></div></div>`;
// Color wheel helpers (hue and saturation on the wheel, brightness on a slider).
function rgb(h,s,v){let f=n=>{let k=(n+h*6)%6;return Math.round(255*v*(1-s*Math.max(0,Math.min(k,4-k,1))))};return[f(5),f(3),f(1)];}
function hsv(hex){let [r,g,b]=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255),mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,h=0;if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h=(h/6+1)%1;}return[h,mx?d/mx:0,mx];}
const hex=c=>'#'+c.map(n=>n.toString(16).padStart(2,'0')).join('');

// One line naming a design, used by the guides' summary and the approvals list.
export const designLine=d=>[`${d.height/12}′ walls at ${d.angle}°`,d.platformShape!=='none'?`${d.platformShape} platform`:'no platform',d.floor==='none'?'no floor':d.floor==='wood'?'oak floor':'painted floor'].join(' · ');
export function installDesign(api){
 const S=api.state,host=document.querySelector('#design');if(!host)return;
 host.innerHTML=`<div class="design-head"><div><span class="eyebrow">YOUR SET</span><h2 id="design-title">Design</h2></div><span id="panel-count" class="design-meta">8 panels</span><button type="button" id="design-toggle" class="edit-button" aria-expanded="false" aria-controls="design-editor">Edit</button></div>
<p id="design-line" class="design-line"></p><ul id="design-summary" class="design-summary" aria-label="Design summary"></ul>
<div id="design-editor">
<section class="design-group" aria-labelledby="walls-heading"><div class="group-head"><h3 id="walls-heading">Walls</h3><span id="walls-meta"></span></div>
<div class="field"><span class="field-label">Height</span>${choice('data-height','Wall height',[[96,'8′ tall','8 × 4 panels'],[120,'10′ tall','10 × 4 panels']])}</div>
<div class="field"><label class="field-label" for="angle"><span>Wing angle</span><output id="angle-value" for="angle">45°</output></label><input id="angle" type="range" min="0" max="90" step="1" value="45" aria-label="Wing angle, straight to fully inward"><div class="presets"><button type="button" data-angle="0">0° straight</button><button type="button" data-angle="45">45°</button><button type="button" data-angle="90">90° square</button></div></div>
${colorField('wall')}</section>
<section class="design-group" aria-labelledby="platform-heading"><div class="group-head"><h3 id="platform-heading">Platform</h3><span id="platform-meta"></span></div>
<div class="field"><span class="field-label">Shape</span>${choice('data-platform-shape','Platform shape',[['none','None'],['angled','Angled','Follows walls'],['square','Square','Straight sides']])}</div>
<div data-platform-on>
<div class="field" data-platform-angled><label class="field-label" for="platform-angle"><span>Side angle</span><output for="platform-angle"></output></label><input id="platform-angle" data-platform-angle type="range" min="0" max="90" step="1" value="45" aria-label="Platform side angle; never wider than the walls"><p class="hint" id="platform-angle-note"></p></div>
<div class="field"><label class="field-label" for="platform-back"><span>From back wall</span><output for="platform-back"></output></label><input id="platform-back" data-platform-gap="back" type="range" min="0" max="48" step="1" value="12" aria-label="Platform distance from the back wall, flush to 4 feet"></div>
<div class="field"><label class="field-label" for="platform-side"><span>From side walls</span><output for="platform-side"></output></label><input id="platform-side" data-platform-gap="side" type="range" min="0" max="48" step="1" value="12" aria-label="Platform distance from the side walls, flush to 4 feet"></div>
${colorField('platform')}</div></section>
<section class="design-group" aria-labelledby="floor-heading"><div class="group-head"><h3 id="floor-heading">Floor</h3><span id="floor-meta"></span></div>
<div class="field"><span class="field-label">Finish</span>${choice('data-floor','Floor finish',[['none','None'],['wood','Oak','Laminate'],['charcoal','Painted','2-layer plywood + skim']])}</div>
<p class="hint" id="floor-note"></p>
<div data-floor-painted>${colorField('floor')}</div></section>
</div>`;
 const q=s=>host.querySelector(s),all=s=>host.querySelectorAll(s);
 let open=false;
 const angleText=()=>S.platformShape==='square'?'Square':S.platformAngle===S.angle?`Angled · matches walls`:`Angled · ${S.platformAngle}°`;
 function summary(){
  const plan=S.platformShape!=='none'?platformPlan(S.angle,S.platformBack,S.platformSide,S.platformAngle):null,gaps=S.platformBack===S.platformSide?`${gapText(S.platformBack).toLowerCase()} from walls`:`${gapText(S.platformBack).toLowerCase()} back · ${gapText(S.platformSide).toLowerCase()} sides`;
  const rows=[['Walls',`${S.height/12}′ tall · ${S.angle}° wings`,S.wallColor],['Platform',plan?`${angleText()} · ${gaps} · ${plan.deckArea.toFixed(0)} sq ft`:'None',plan&&S.platformColor],['Floor',S.floor==='none'?'None':`${S.floor==='wood'?'Oak laminate':'Painted double-layer plywood + skim'}${plan?' · under the platform':''}`,S.floor==='charcoal'?S.floorColor:S.floor==='wood'?'oak':null]];
  q('#design-summary').replaceChildren(...rows.map(([k,v,c])=>{const li=document.createElement('li'),dot=document.createElement('span'),t=document.createElement('strong'),d=document.createElement('span');dot.className='dot'+(c==='oak'?' oak':'')+(c?'':' empty');if(c&&c!=='oak')dot.style.background=c;t.textContent=k;d.textContent=v+(c&&c!=='oak'?` · ${colorName(c)}`:'');li.append(dot,t,d);return li;}));
  q('#design-line').textContent=designLine(S);
  q('#walls-meta').textContent=`${S.height/12}′ × 4′ panels · 16′ back wall`;
  q('#platform-meta').textContent=plan?`10″ tall · ${plan.counts.modules} modules`:'Not included';
  q('#floor-meta').textContent=S.floor==='none'?'Not included':S.floor==='wood'?'Click-lock oak laminate':'Painted plywood overlay';
 }
 function refresh(){
  for(const b of all('[data-height]')){const a=+b.dataset.height===S.height;b.setAttribute('aria-pressed',a);}
  for(const b of all('[data-floor]'))b.setAttribute('aria-pressed',b.dataset.floor===S.floor);
  for(const b of all('[data-platform-shape]'))b.setAttribute('aria-pressed',b.dataset.platformShape===S.platformShape);
  for(const b of all('[data-angle]'))b.classList.toggle('active',+b.dataset.angle===S.angle);
  if(document.activeElement!==q('#angle'))q('#angle').value=S.angle;q('#angle-value').textContent=S.angle+'°';
  const on=S.platformShape!=='none';q('[data-platform-on]').hidden=!on;q('[data-platform-angled]').hidden=S.platformShape!=='angled';
  const pa=q('#platform-angle');pa.value=S.platformAngle;host.querySelector('output[for="platform-angle"]').textContent=S.platformAngle===S.angle?'Matches walls':S.platformAngle+'°';
  q('#platform-angle-note').textContent=S.platformAngle===S.angle?`Turn it further in than the ${S.angle}° walls for a squarer platform. It can never open wider than the walls.`:`${S.platformAngle-S.angle}° further in than the walls. Bringing the walls in pushes it in too.`;
  for(const i of all('[data-platform-gap]')){const v=S[i.dataset.platformGap==='back'?'platformBack':'platformSide'];if(document.activeElement!==i)i.value=v;host.querySelector(`output[for="${i.id}"]`).textContent=gapText(v);}
  q('[data-floor-painted]').hidden=S.floor!=='charcoal';
  q('#floor-note').textContent=S.floor==='none'?(on?'The platform stands on the existing floor.':'The walls stand on the existing floor.'):(on?'Covers the whole 8′-deep footprint, wall to wall. The platform sits on top of it.':'Covers the 8′-deep footprint between the walls.');
  for(const f of all('.color-field')){const c=S[surfaces[f.dataset.surface].key];f.querySelector('output').textContent=colorName(c);let match=false;for(const b of f.querySelectorAll('.swatch[data-color]')){const p=b.dataset.color===c;match||=p;b.setAttribute('aria-pressed',p);}const custom=f.querySelector('.swatch.custom');custom.classList.toggle('picked',!match);custom.style.setProperty('--c',match?'':c);syncWheel(f);}
  summary();applyColors();
 }
 function applyColors(){mats.charcoal.color.set(S.wallColor);mats.floorGray.color.set(S.floorColor);mats.platform.color.set(S.platformColor);api.scene.traverse(o=>{const s=o.isMesh&&o.material?.userData?.surface;if(s==='floor')o.material.color.set(S.floorColor);if(s==='platform')o.material.color.set(S.platformColor);});api.invalidate();}
 function setColor(surface,color){if(!/^#[0-9a-f]{6}$/i.test(color))throw Error('Use a six-digit hex color');S[surfaces[surface].key]=color.toLowerCase();refresh();window.dispatchEvent(new CustomEvent('surface-color-changed',{detail:{surface,color}}));}
 // Custom color: a wheel for hue and saturation, a brightness slider and a hex field, built on first open.
 function buildWheel(f){const panel=f.querySelector('.custom-panel'),surface=f.dataset.surface;panel.innerHTML=`<div class="wheel-wrap"><canvas width="220" height="220" tabindex="0" role="slider" aria-label="Color wheel: left and right adjust hue; up and down adjust saturation" aria-valuemin="0" aria-valuemax="359"></canvas><span class="wheel-cursor"></span></div><div class="color-fields"><label>Brightness <output></output><input type="range" min="0" max="100" value="100" class="brightness"></label><label>Hex color<input type="text" maxlength="7" spellcheck="false" autocomplete="off" class="hex-input"></label><span class="color-error" role="status"></span></div>`;
  const canvas=panel.querySelector('canvas'),ctx=canvas.getContext('2d'),img=ctx.createImageData(220,220);for(let y=0;y<220;y++)for(let x=0;x<220;x++){let dx=(x-110)/106,dy=(y-110)/106,r=Math.hypot(dx,dy);if(r<=1)img.data.set([...rgb((Math.atan2(dy,dx)/Math.PI/2+1)%1,r,1),255],(y*220+x)*4);}ctx.putImageData(img,0,0);
  const current=()=>hsv(S[surfaces[surface].key]),apply=(h,s,v)=>setColor(surface,hex(rgb(h,s,v)));
  const pick=e=>{const r=canvas.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/(r.width*.4818),dy=(e.clientY-r.top-r.height/2)/(r.height*.4818);let [,,v]=current();if(v<.05)v=.65;apply((Math.atan2(dy,dx)/Math.PI/2+1)%1,Math.min(1,Math.hypot(dx,dy)),v);};
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pick(e)});canvas.addEventListener('pointermove',e=>{if(canvas.hasPointerCapture(e.pointerId))pick(e)});
  canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();let [h,s,v]=current();if(e.key==='ArrowLeft')h=(h-1/72+1)%1;if(e.key==='ArrowRight')h=(h+1/72)%1;if(e.key==='ArrowUp')s=Math.min(1,s+.025);if(e.key==='ArrowDown')s=Math.max(0,s-.025);apply(h,s,v<.05?.65:v);});
  panel.querySelector('.brightness').oninput=e=>{const [h,s]=current();apply(h,s,+e.target.value/100);};
  panel.querySelector('.hex-input').addEventListener('change',e=>{let v=e.target.value.trim();if(!v.startsWith('#'))v='#'+v;if(/^#[0-9a-f]{3}$/i.test(v))v='#'+[...v.slice(1)].map(c=>c+c).join('');try{setColor(surface,v)}catch{e.target.setAttribute('aria-invalid','true');panel.querySelector('.color-error').textContent='Enter a color such as #34383B.';}});
  syncWheel(f);}
 function syncWheel(f){const panel=f.querySelector('.custom-panel');if(!panel.firstChild)return;const c=S[surfaces[f.dataset.surface].key],[h,s,v]=hsv(c),cur=panel.querySelector('.wheel-cursor');cur.style.left=`${50+Math.cos(h*Math.PI*2)*s*48.18}%`;cur.style.top=`${50+Math.sin(h*Math.PI*2)*s*48.18}%`;panel.querySelector('.brightness').value=Math.round(v*100);panel.querySelector('.color-fields output').textContent=Math.round(v*100)+'%';const hexInput=panel.querySelector('.hex-input');if(document.activeElement!==hexInput)hexInput.value=c.toUpperCase();hexInput.removeAttribute('aria-invalid');panel.querySelector('.color-error').textContent='';panel.querySelector('canvas').setAttribute('aria-valuenow',Math.round(h*359));}
 // Explore edits the design directly; the guides keep it folded to a summary until Edit is pressed.
 function layout(){const explore=S.mode==='finished';host.classList.toggle('collapsed',!explore&&!open);q('#design-toggle').hidden=explore;q('#design-toggle').textContent=open?'Done':'Edit';q('#design-toggle').setAttribute('aria-expanded',explore||open);q('#design-summary').hidden=explore;q('#design-line').hidden=explore;q('#design-editor').hidden=!explore&&!open;}
 q('#design-toggle').onclick=()=>{open=!open;layout();if(!open)host.scrollIntoView({block:'nearest'});};
 let lastMode=S.mode;new MutationObserver(()=>{if(S.mode!==lastMode){lastMode=S.mode;open=false;}layout();}).observe(document.body,{attributes:true,attributeFilter:['class']});
 host.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!host.contains(b))return;
  if(b.dataset.height)api.configure({height:+b.dataset.height});
  else if(b.dataset.angle)api.configure({angle:+b.dataset.angle});
  else if(b.dataset.floor)api.configure({floor:b.dataset.floor});
  else if(b.dataset.platformShape)api.configure({platformShape:b.dataset.platformShape});
  else if(b.dataset.color)setColor(b.closest('.color-field').dataset.surface,b.dataset.color);
  else if(b.classList.contains('custom')){const f=b.closest('.color-field'),panel=f.querySelector('.custom-panel'),show=panel.hidden;panel.hidden=!show;b.setAttribute('aria-expanded',show);if(show&&!panel.firstChild)buildWheel(f);}});
 let timer;
 host.addEventListener('input',e=>{const i=e.target;clearTimeout(timer);
  if(i.id==='angle'){const a=+i.value;q('#angle-value').textContent=a+'°';api.previewAngle?.(a);timer=setTimeout(()=>api.configure({angle:a}),65);}
  else if(i.dataset.platformAngle!==undefined){const v=Math.max(S.angle,+i.value);if(v!==+i.value)i.value=v;timer=setTimeout(()=>api.configure({platformAngle:v}),65);}
  else if(i.dataset.platformGap){const v=+i.value,key=i.dataset.platformGap==='back'?'platformBack':'platformSide';host.querySelector(`output[for="${i.id}"]`).textContent=gapText(v);timer=setTimeout(()=>api.configure({[key]:v}),65);}});
 api.setWallColor=c=>setColor('wall',c);api.setFloorColor=c=>setColor('floor',c);api.setPlatformColor=c=>setColor('platform',c);
 window.addEventListener('set-configured',refresh);refresh();layout();
}
