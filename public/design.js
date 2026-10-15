import {cycloramaGaps,cycloramaCornerSides} from './cyclorama.js';
// The one place the set is designed. Explore shows it as an accordion: each part of the set is one row whose
// header reads its current setting, so the closed panel is the design summary. The Build guide shows a one-line
// summary with an Edit button that opens the same accordion in place.
import {mats} from './model.js';
import {platformPlan,footprint,PLATFORM} from './platform.js';
// The design a first visit opens with, and what Revert to default restores in the Pricing guide.
export const defaultDesign={floorLip:false,seamlessCorners:false,seamlessCornerSide:'both',seamlessPerimeter:false,height:120,angle:45,wallColor:'#34383b',platformShape:'square',platformAngle:90,platformBack:12,platformSide:12,platformFront:0,platformColor:'#34383b',floor:'charcoal',floorColor:'#34383b',figures:'rap',figureScale:1};
export const presets=[['Charcoal','#34383b'],['White','#ecece7'],['Warm gray','#96918a'],['Navy','#26364d'],['Forest','#344c40'],['Black','#181a1c']];
export const colorName=c=>presets.find(p=>p[1]===c)?.[0]||(c==='#3c4041'?'Charcoal':'Custom');
export const gapText=v=>v===0?'Flush':v%12?`${v>=12?Math.floor(v/12)+'′ ':''}${v%12}″`:`${v/12}′`;
const surfaces={wall:{key:'wallColor',label:'wall'},platform:{key:'platformColor',label:'platform'},floor:{key:'floorColor',label:'floor'}};

// Small plan-view icons (back wall at the top) so the choices read without captions.
const icon=body=>`<svg class="choice-icon" viewBox="0 0 40 28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const corner=(l,r)=>icon(`<path d="M6 25V${l?12:4}${l?'Q6 4 14 4':''}H${r?26:34}${r?'Q34 4 34 12':''}V25"/>`+(l?'<path d="M6 12Q6 4 14 4" stroke="#6aa13b" stroke-width="3.2"/>':'')+(r?'<path d="M26 4Q34 4 34 12" stroke="#6aa13b" stroke-width="3.2"/>':''));
const sweep=on=>icon(on?'<path d="M8 4V14Q8 24 18 24H34"/><path d="M8 14Q8 24 18 24" stroke="#6aa13b" stroke-width="3.2"/>':'<path d="M8 4V24H34"/>');
const shapeIcon={none:icon('<path d="M4 6H36M4 6l-1 18M36 6l1 18" opacity=".35"/><path d="M12 14h16" stroke-dasharray="2 3"/>'),angled:icon('<path d="M4 6H36M4 6l-1 18M36 6l1 18" opacity=".35"/><path d="M10 10H30L33 23H7Z" fill="currentColor" fill-opacity=".18"/>'),square:icon('<path d="M4 6H36M4 6l-1 18M36 6l1 18" opacity=".35"/><path d="M9 10H31V23H9Z" fill="currentColor" fill-opacity=".18"/>')};
const choice=(attr,label,items)=>`<div class="choice" role="group" aria-label="${label}">${items.map(([v,t,art])=>`<button type="button" ${attr}="${v}" aria-pressed="false"${art?' class="has-icon"':''}>${art||''}<strong>${t}</strong></button>`).join('')}</div>`;
const colorField=surface=>`<div class="field color-field" data-surface="${surface}"><div class="field-label"><span>Color</span><output></output></div><div class="swatches" role="group" aria-label="${surfaces[surface].label} color">${presets.map(([n,c])=>`<button type="button" class="swatch" data-color="${c}" style="--c:${c}" aria-label="${n}" title="${n}" aria-pressed="false"></button>`).join('')}<button type="button" class="swatch custom" aria-label="Custom ${surfaces[surface].label} color" title="Custom" aria-expanded="false"></button></div><div class="custom-panel" hidden></div></div>`;
const slider=(id,label,attrs)=>`<div class="field slider-field"><label class="field-label" for="${id}"><span>${label}</span><output for="${id}"></output></label><input id="${id}" type="range" ${attrs}></div>`;
const section=(key,title,body)=>`<section class="acc-item" data-section="${key}"><h3 class="acc-heading"><button type="button" class="acc-head" id="acc-${key}-head" aria-expanded="false" aria-controls="acc-${key}"><span class="acc-title">${title}</span><span class="acc-value" id="${key}-value"></span><span class="acc-dot" aria-hidden="true"></span><svg class="acc-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button></h3><div class="acc-body" id="acc-${key}" role="region" aria-labelledby="acc-${key}-head" hidden>${body}</div></section>`;
// Color wheel helpers (hue and saturation on the wheel, brightness on a slider).
function rgb(h,s,v){let f=n=>{let k=(n+h*6)%6;return Math.round(255*v*(1-s*Math.max(0,Math.min(k,4-k,1))))};return[f(5),f(3),f(1)];}
function hsv(hex){let [r,g,b]=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255),mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,h=0;if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h=(h/6+1)%1;}return[h,mx?d/mx:0,mx];}
const hex=c=>'#'+c.map(n=>n.toString(16).padStart(2,'0')).join('');

// One line naming a design, used by the guides' summary and the approvals list.
// Rounded corners: 'both', or the one wing corner ('left'/'right' seen from the front of the set).
export const cornerText=d=>{const side=d.seamlessCornerSide??'both';return side==='both'?'rounded corners':`rounded ${side} corner`;};
export const designLine=d=>[...(d.seamlessCorners?[cornerText(d)+(d.angle===0?' (straight walls)':'')]:[]),...(d.seamlessPerimeter?['rounded perimeter']:[]),`${d.height/12}′ walls at ${d.angle}°`,d.platformShape!=='none'?`${d.platformShape} platform${d.platformFront?` ${gapText(d.platformFront)} back from the floor edge`:''}`:'no platform',d.floor==='none'?'no floor':d.floor==='wood'?'oak floor':'painted floor',...(d.floor==='charcoal'&&d.floorLip?['12″ front joining lip']:[])].join(' · ');

// Top-down plan of the floor, walls and platform with the three platform distances drawn on it.
// The view is cropped to the platform plus a margin, so wide wing angles do not shrink the drawing.
function planSVG(S,plan){
 const a=S.angle*Math.PI/180,c=Math.cos(a)*96,s=Math.sin(a)*96,fp=footprint(S.angle),lip=S.floor==='charcoal'&&S.floorLip?12:0,full=96+c;
 const o=plan.outline,xs=o.map(p=>Math.abs(p[0])),X=Math.min(full,Math.max(...xs)+40),top=-8,bottom=96+lip+8,W=2*X,H=bottom-top,f=W/15;
 const pt=p=>`${p[0].toFixed(1)},${p[1].toFixed(1)}`,poly=pg=>pg.map(pt).join(' ');
 const label=(x,y,text,anchor='start')=>{y=Math.max(top+f*.6,Math.min(bottom-f*.6,y));x=anchor==='middle'?Math.max(-X+f,Math.min(X-f,x)):x;return `<text class="plan-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle">${text}</text>`;};
 const zs=o.map(p=>p[1]),zMin=Math.min(...zs),zMax=Math.max(...zs);
 let out=`<svg class="plan" viewBox="${-X} ${top} ${W} ${H}" style="font-size:${f.toFixed(1)}px" role="img" aria-label="Top-down plan: platform ${gapText(plan.back)} from the back wall, ${gapText(plan.side)} from the side walls, ${gapText(plan.front)} from the floor front">`;
 out+=`<polygon class="plan-floor${S.floor==='none'?' bare':''}" points="${poly(fp)}"/>`;
 if(lip)out+=`<rect class="plan-lip" x="${-full}" y="96" width="${2*full}" height="${lip}"/>`;
 out+=`<polyline class="plan-wall" points="${pt([-full,s])} ${pt([-96,0])} ${pt([96,0])} ${pt([full,s])}"/>`;
 out+=`<polygon class="plan-platform" points="${poly(o)}" style="--c:${S.platformColor}"/>`;
 // Back and front distances run down the centerline; each label sits beside its line.
 const gx=f*.45,mark=(z0,z1,text)=>(z1-z0>.5?`<line class="plan-dim" x1="0" y1="${z0}" x2="0" y2="${z1}"/>`:'')+label(gx,(z0+z1)/2,text);
 out+=mark(0,zMin,gapText(plan.back))+mark(zMax,96,gapText(plan.front));
 // Side clearance: from the middle of the platform edge nearest the right wing (or its nearest corner), square to that wing.
 const n=[-Math.sin(a),Math.cos(a)],u=[Math.cos(a),Math.sin(a)],k=-96*Math.sin(a),d=p=>n[0]*p[0]+n[1]*p[1]-k,dMin=Math.min(...o.map(d));
 const on=o.filter(p=>Math.abs(d(p)-dMin)<.01),along=p=>p[0]*u[0]+p[1]*u[1],lo=on.reduce((x,p)=>along(p)<along(x)?p:x),hi=on.reduce((x,p)=>along(p)>along(x)?p:x),near=[(lo[0]+hi[0])/2,(lo[1]+hi[1])/2];
 const foot=[near[0]-n[0]*dMin,near[1]-n[1]*dMin],m=[(near[0]+foot[0])/2,(near[1]+foot[1])/2];
 if(dMin>.5)out+=`<line class="plan-dim" x1="${near[0]}" y1="${near[1]}" x2="${foot[0]}" y2="${foot[1]}"/>`;
 out+=label(m[0]-u[0]*f*.8,m[1]-u[1]*f*.8,gapText(plan.side),'middle');
 return out+'</svg>';
}

export function installDesign(api){
 const S=api.state,host=document.querySelector('#design');if(!host)return;
 host.innerHTML=`<div class="design-head"><h2 id="design-title">Your set</h2><span id="panel-count" class="design-meta">8 panels</span><button type="button" id="design-toggle" class="edit-button" aria-expanded="false" aria-controls="design-editor">Edit</button></div>
<p id="design-line" class="design-line"></p>
<div id="design-editor" class="acc">
${section('walls','Walls',`<div class="field"><span class="field-label">Height</span>${choice('data-height','Wall height',[[96,'8′'],[120,'10′']])}</div>
<div class="field slider-field"><label class="field-label" for="angle"><span>Wing angle</span><output id="angle-value" for="angle">45°</output></label><input id="angle" type="range" min="0" max="90" step="1" value="45" aria-label="Wing angle, straight to fully inward"><div class="ticks"><button type="button" data-angle="0">0°</button><button type="button" data-angle="45">45°</button><button type="button" data-angle="90">90°</button></div></div>
${colorField('wall')}`)}
${section('corners','Rounded corners',`<div class="field"><span class="field-label">Wall corners</span>${choice('data-seamless-corners','Rounded wall corners, as you face the back wall',[['false','None',corner(0,0)],['left','Left',corner(1,0)],['right','Right',corner(0,1)],['both','Both',corner(1,1)]])}</div>
<div class="field"><span class="field-label">Wall to floor</span>${choice('data-seamless-perimeter','Wall to floor edge',[['false','Square',sweep(0)],['true','Curved',sweep(1)]])}</div>`)}
${section('platform','Platform',`<div class="field"><span class="field-label">Shape</span>${choice('data-platform-shape','Platform shape',[['none','None',shapeIcon.none],['angled','Angled',shapeIcon.angled],['square','Square',shapeIcon.square]])}</div>
<div data-platform-on><div class="plan-wrap" id="platform-plan"></div>
${slider('platform-back','From back wall','data-platform-gap="back" min="0" max="48" step="1" value="12"')}
${slider('platform-side','From side walls','data-platform-gap="side" min="0" max="48" step="1" value="12"')}
${slider('platform-front','From floor front','data-platform-gap="front" min="0" max="48" step="1" value="0"')}
<div data-platform-angled>${slider('platform-angle','Side angle','data-platform-angle min="0" max="90" step="1" value="45"')}</div>
${colorField('platform')}</div>`)}
${section('floor','Floor',`<div class="field"><span class="field-label">Finish</span>${choice('data-floor','Floor finish',[['none','None'],['wood','Oak'],['charcoal','Painted']])}</div>
<div data-floor-painted><div class="field"><span class="field-label">Front lip</span>${choice('data-floor-lip','Front joining lip',[['false','None'],['true','12″']])}</div>${colorField('floor')}</div>`)}
</div>`;
 const q=s=>host.querySelector(s),all=s=>host.querySelectorAll(s);
 let open=false;
 const dot=(key,color)=>{const d=q(`[data-section="${key}"] .acc-dot`);d.hidden=!color;d.classList.toggle('oak',color==='oak');d.style.background=color&&color!=='oak'?color:'';};
 function summary(plan){
  const sides=cycloramaCornerSides(S);
  q('#walls-value').textContent=`${S.height/12}′ · ${S.angle}° · ${colorName(S.wallColor)}`;dot('walls',S.wallColor);
  q('#corners-value').textContent=[!S.seamlessCorners?'None':sides.length===1?`${sides[0][0].toUpperCase()+sides[0].slice(1)} corner`:'Both corners',...(S.seamlessPerimeter?['Curved floor']:[])].join(' · ');dot('corners',null);
  q('#platform-value').textContent=plan?`${S.platformShape==='square'?'Square':'Angled'} · ${plan.deckArea.toFixed(0)} sq ft`:'None';dot('platform',plan&&S.platformColor);
  q('#floor-value').textContent=S.floor==='none'?'None':S.floor==='wood'?'Oak':`Painted${S.floorLip?' · 12″ lip':''}`;dot('floor',S.floor==='charcoal'?S.floorColor:S.floor==='wood'?'oak':null);
  q('#design-line').textContent=designLine(S);
 }
 function refresh(){
  for(const b of all('[data-seamless-corners]'))b.setAttribute('aria-pressed',String(S.seamlessCorners?b.dataset.seamlessCorners===(S.seamlessCornerSide??'both'):b.dataset.seamlessCorners==='false'));
  for(const b of all('[data-seamless-perimeter]'))b.setAttribute('aria-pressed',String(S.seamlessPerimeter===(b.dataset.seamlessPerimeter==='true')));
  for(const b of all('[data-height]'))b.setAttribute('aria-pressed',+b.dataset.height===S.height);
  for(const b of all('[data-floor]'))b.setAttribute('aria-pressed',b.dataset.floor===S.floor);
  for(const b of all('[data-platform-shape]'))b.setAttribute('aria-pressed',b.dataset.platformShape===S.platformShape);
  for(const b of all('[data-angle]'))b.setAttribute('aria-pressed',+b.dataset.angle===S.angle);
  if(document.activeElement!==q('#angle'))q('#angle').value=S.angle;q('#angle-value').textContent=S.angle+'°';
  const on=S.platformShape!=='none',plan=on?platformPlan(S.angle,S.platformBack,S.platformSide,S.platformAngle,S):null;
  q('[data-platform-on]').hidden=!on;q('[data-platform-angled]').hidden=S.platformShape!=='angled';
  const pa=q('#platform-angle');pa.min=S.angle;if(document.activeElement!==pa)pa.value=S.platformAngle;host.querySelector('output[for="platform-angle"]').textContent=S.platformAngle+'°';
  // Sliders show the distance actually built: curved corners and floors push the back and sides out to a minimum.
  if(plan){const g=cycloramaGaps(S),set={back:[plan.back,g.minimum,48],side:[plan.side,g.minimum,48],front:[plan.front,0,Math.min(48,96-plan.back-PLATFORM.minDepth)]};
   for(const i of all('[data-platform-gap]')){const [v,min,max]=set[i.dataset.platformGap];i.min=min;i.max=max;if(document.activeElement!==i)i.value=v;host.querySelector(`output[for="${i.id}"]`).textContent=gapText(v);}
   q('#platform-plan').innerHTML=planSVG(S,plan);}
  q('[data-floor-painted]').hidden=S.floor!=='charcoal';for(const b of all('[data-floor-lip]'))b.setAttribute('aria-pressed',String(S.floorLip===(b.dataset.floorLip==='true')));
  for(const f of all('.color-field')){const c=S[surfaces[f.dataset.surface].key];f.querySelector('output').textContent=colorName(c);let match=false;for(const b of f.querySelectorAll('.swatch[data-color]')){const p=b.dataset.color===c;match||=p;b.setAttribute('aria-pressed',p);}const custom=f.querySelector('.swatch.custom');custom.classList.toggle('picked',!match);custom.style.setProperty('--c',match?'':c);syncWheel(f);}
  summary(plan);applyColors();
 }
 function applyColors(){mats.charcoal.color.set(S.wallColor);mats.floorGray.color.set(S.floorColor);mats.platform.color.set(S.platformColor);api.scene.traverse(o=>{const s=o.isMesh&&o.material?.userData?.surface;if(s==='wall')o.material.color.set(S.wallColor);if(s==='floor')o.material.color.set(S.floorColor);if(s==='platform')o.material.color.set(S.platformColor);});api.invalidate();}
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
 // Accordion: one part open at a time; tapping the open header closes it. Explore opens on Walls.
 const sectionKey='rc-design-section';
 const items=()=>document.querySelectorAll('#design .acc-item, #figure-controls.acc-item');
 function expand(key){for(const item of items()){const on=item.dataset.section===key;item.classList.toggle('open',on);item.querySelector('.acc-head').setAttribute('aria-expanded',on);item.querySelector('.acc-body').hidden=!on;}try{sessionStorage.setItem(sectionKey,key||'');}catch{}api.invalidate();}
 document.addEventListener('click',e=>{const head=e.target.closest('.acc-head');if(head&&head.closest('#design, #figure-controls')){const item=head.closest('.acc-item');expand(item.classList.contains('open')?null:item.dataset.section);}});
 api.openDesignSection=key=>{if(S.mode!=='finished'&&!open){open=true;layout();}expand(key);};
 // Explore edits the design directly; the guides keep it folded to one line until Edit is pressed.
 function layout(){const explore=S.mode==='finished';host.classList.toggle('collapsed',!explore&&!open);q('#design-toggle').hidden=explore;q('#design-toggle').textContent=open?'Done':'Edit';q('#design-toggle').setAttribute('aria-expanded',explore||open);q('#design-line').hidden=explore;q('#design-editor').hidden=!explore&&!open;}
 q('#design-toggle').onclick=()=>{open=!open;layout();if(!open)host.scrollIntoView({block:'nearest'});};
 let lastMode=S.mode;new MutationObserver(()=>{if(S.mode!==lastMode){lastMode=S.mode;open=false;}layout();}).observe(document.body,{attributes:true,attributeFilter:['class']});
 host.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!host.contains(b)||b.classList.contains('acc-head'))return;
  if(b.dataset.seamlessCorners!==undefined)api.configure(b.dataset.seamlessCorners==='false'?{seamlessCorners:false}:{seamlessCorners:true,seamlessCornerSide:b.dataset.seamlessCorners});
  else if(b.dataset.seamlessPerimeter!==undefined)api.configure({seamlessPerimeter:b.dataset.seamlessPerimeter==='true'});
  else if(b.dataset.height)api.configure({height:+b.dataset.height});
  else if(b.dataset.angle)api.configure({angle:+b.dataset.angle});
  else if(b.dataset.floorLip!==undefined)api.configure({floorLip:b.dataset.floorLip==='true'});
  else if(b.dataset.floor)api.configure({floor:b.dataset.floor});
  else if(b.dataset.platformShape)api.configure({platformShape:b.dataset.platformShape});
  else if(b.dataset.color)setColor(b.closest('.color-field').dataset.surface,b.dataset.color);
  else if(b.classList.contains('custom')){const f=b.closest('.color-field'),panel=f.querySelector('.custom-panel'),show=panel.hidden;panel.hidden=!show;b.setAttribute('aria-expanded',show);if(show&&!panel.firstChild)buildWheel(f);}});
 let timer;
 const gapKeys={back:'platformBack',side:'platformSide',front:'platformFront'};
 host.addEventListener('input',e=>{const i=e.target;clearTimeout(timer);
  if(i.id==='angle'){const a=+i.value;q('#angle-value').textContent=a+'°';api.previewAngle?.(a);timer=setTimeout(()=>api.configure({angle:a}),65);}
  else if(i.dataset.platformAngle!==undefined){const v=Math.max(S.angle,+i.value);if(v!==+i.value)i.value=v;host.querySelector('output[for="platform-angle"]').textContent=v+'°';timer=setTimeout(()=>api.configure({platformAngle:v}),65);}
  else if(i.dataset.platformGap){const v=+i.value;host.querySelector(`output[for="${i.id}"]`).textContent=gapText(v);timer=setTimeout(()=>api.configure({[gapKeys[i.dataset.platformGap]]:v}),65);}});
 api.setWallColor=c=>setColor('wall',c);api.setFloorColor=c=>setColor('floor',c);api.setPlatformColor=c=>setColor('platform',c);
 window.addEventListener('set-configured',refresh);refresh();layout();
 let first='walls';try{const saved=sessionStorage.getItem(sectionKey);if(saved!==null)first=saved||null;}catch{}expand(first);
}
