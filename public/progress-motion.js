// CSS sticky positioning and browser-owned animations never chase scroll events in JS.
export function mountProgressMotion(hero,host,aside){
 const holder=document.createElement('div');holder.className='pj-progress-holder';hero.before(holder);
 const mini=hero.cloneNode(true);mini.classList.add('pj-progress-mini');mini.setAttribute('aria-hidden','true');mini.insertAdjacentHTML('afterbegin','<div class="pj-morph-background"><div></div></div><div class="pj-morph-bloom"></div>');holder.append(mini);hero.style.visibility='hidden';
 const marker=document.createElement('span');marker.className='pj-progress-marker';hero.append(marker);
 const viewport=document.querySelector('.viewport');let animations=[],observer,signature='',disposed=false;
 function setup(){
  if(disposed||host.hidden)return;const rect=hero.getBoundingClientRect();if(!rect.width)return;
  const scrolls=aside.scrollHeight>aside.clientHeight&&/auto|scroll/.test(getComputedStyle(aside).overflowY),mobile=matchMedia('(max-width:850px)').matches,top=scrolls?0:mobile&&getComputedStyle(viewport).position==='sticky'?viewport.getBoundingClientRect().height:0,source=scrolls?aside:document.scrollingElement,start=rect.top+source.scrollTop-(scrolls?aside.getBoundingClientRect().top:top),reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const key=[rect.width,rect.height,top,start,reduced].join('|');if(key===signature)return;signature=key;animations.forEach(a=>a.cancel());animations=[];observer?.disconnect();
  const rr=hero.querySelector('.pj-ring').getBoundingClientRect(),lr=hero.querySelector('.pj-stage-legend').getBoundingClientRect(),ring=mini.querySelector('.pj-ring'),caption=mini.querySelector('.pj-progress-caption'),legend=mini.querySelector('.pj-stage-legend'),bg=mini.querySelector('.pj-morph-background');
  holder.style.top=top+'px';mini.style.width=rect.width+'px';mini.style.height=rect.height+'px';caption.style.width=rect.width-102+'px';legend.style.left=lr.left-rect.left+'px';legend.style.top=lr.top-rect.top+'px';legend.style.width=lr.width+'px';
  let native=!reduced&&typeof ScrollTimeline==='function'&&CSS.supports('animation-range-start','1px');let timeline=native?new ScrollTimeline({source,axis:'block'}):null;
  const tracks=new Map(),add=(el,style,offset)=>{if(!tracks.has(el))tracks.set(el,[]);tracks.get(el).push({...style,offset});},translate=(x,y)=>`translate3d(${x}px,${y}px,0)`;
  for(let j=0;j<=40;j++){const raw=j/40,t=raw*raw*(3-2*raw),mix=(a,b)=>a+(b-a)*t,collapse=Math.max(0,(t-.42)/.58),rise=Math.max(0,Math.min(1,(t-.6)/.4)),lift=rise*rise*(3-2*rise),below=mix(rr.top-rect.top,10)+mix(rr.width,64)+mix(-3,8);
   add(bg,{transform:`scaleY(${(rect.height+(84-rect.height)*collapse)/rect.height})`},raw);add(bg.firstElementChild,{opacity:t},raw);
   add(ring,{transform:translate(mix(rr.left-rect.left,14),mix(rr.top-rect.top,10))+` scale(${mix(1,64/rr.width)})`},raw);
   add(ring.querySelector('svg'),{transform:`rotate(${reduced?0:t*36}deg)`},raw);add(ring.querySelector('strong'),{transform:`scale(${mix(1,79/61)})`},raw);add(ring.querySelector('div>span'),{opacity:1-t},raw);
   add(caption,{transform:translate(mix(51,90)+4*t*(1-t)*Math.min(90,rect.width*.25),below+(15-below)*lift)+` scale(${1-.25*4*t*(1-t)})`},raw);add(caption.querySelector('p'),{transform:translate(0,-9*t)},raw);
   add(legend,{opacity:Math.max(0,1-(t-.38)/.04)},raw);
   const rows=[...legend.children];rows.forEach((row,i)=>{const phase=Math.max(0,Math.min(1,(t-(rows.length-1-i)*.065)/.22)),exit=phase*phase*(3-2*phase);add(row,{transform:translate(reduced?0:-exit*(lr.width+30),reduced?0:-exit*10),opacity:1-exit},raw);});
   add(mini.querySelector('.pj-morph-bloom'),{opacity:Math.max(0,(raw-.94)/.06)},raw);
  }
  function create(){for(const [el,frames]of tracks){const a=el.animate(frames,native?{timeline,rangeStart:start+'px',rangeEnd:(start+240)+'px',fill:'both',easing:'linear'}:{duration:reduced?1:450,fill:'both',easing:'linear'});if(!native){a.pause();a.currentTime=source.scrollTop>start+80?(reduced?1:450):0;}animations.push(a);}}
  try{create();}catch{animations.forEach(a=>a.cancel());animations=[];native=false;timeline=null;create();}
  holder.dataset.motion=native?'scroll-timeline':'threshold-animation';
  if(!native){let compact=source.scrollTop>start+80;observer=new IntersectionObserver(entries=>{const next=entries[0].boundingClientRect.top<(scrolls?aside.getBoundingClientRect().top:top);if(next===compact)return;compact=next;for(const a of animations){a.playbackRate=next?1:-1;a.play();}},{root:scrolls?aside:null,rootMargin:`-${top}px 0px 0px 0px`,threshold:0});observer.observe(marker);}
 }
 const resize=new ResizeObserver(setup);resize.observe(hero);resize.observe(viewport);window.addEventListener('resize',setup);window.addEventListener('studio-view-changed',setup);setup();
 return ()=>{disposed=true;animations.forEach(a=>a.cancel());observer?.disconnect();resize.disconnect();window.removeEventListener('resize',setup);window.removeEventListener('studio-view-changed',setup);holder.remove();};
}
