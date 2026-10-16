// Explore set has two tabs: the 3D set (viewer + design panel, unchanged) and Photos, a dated
// timeline of the real build. Photos come from data/build-photos.json; every image is a resized,
// metadata-free WebP in photos/build/ with 480–2400 px widths, so phones download only what they show.
const MANIFEST='data/build-photos.json',DIR='photos/build/';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const day=iso=>new Date(iso.slice(0,10)+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
const time=iso=>new Date(iso+':00').toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
const srcset=p=>Object.entries(p.src).map(([w,f])=>`${DIR}${f} ${w}w`).join(', ');
const smallest=p=>DIR+p.src[Object.keys(p.src).sort((a,b)=>a-b)[0]];

// Group photos into stages in the manifest's order; a stage's date range comes from its photos.
export function photoTimeline(data){
 const photos=[...data.photos].sort((a,b)=>a.taken.localeCompare(b.taken));
 return data.stages.map(s=>({...s,photos:photos.filter(p=>p.stage===s.id)})).filter(s=>s.photos.length)
  .map(s=>({...s,first:s.photos[0].taken,last:s.photos.at(-1).taken}));
}
// "October 8–15, 2026" for one month, "September 28 – October 3, 2026" across two.
export function span(a,b){const m=d=>new Date(d.slice(0,10)+'T12:00:00').toLocaleDateString('en-US',{month:'long'}),y=b.slice(0,4),da=+a.slice(8,10),db=+b.slice(8,10);return m(a)===m(b)?`${m(a)} ${da}–${db}, ${y}`:`${m(a)} ${da} – ${m(b)} ${db}, ${y}`;}
export function dateRange(a,b){const x=day(a),y=day(b);return x===y?x:`${x} – ${y}`;}

export function installExplorePhotos(api){
 const aside=document.querySelector('.controls'),tabs=document.createElement('div'),panel=document.createElement('section');
 tabs.id='explore-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Explore set');
 tabs.innerHTML=[['model','3D set'],['photos','Build photos']].map(([id,label])=>`<button type="button" role="tab" id="explore-tab-${id}" data-explore-tab="${id}" aria-controls="${id==='photos'?'explore-photos':'design'}">${label}</button>`).join('');
 panel.id='explore-photos';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','explore-tab-photos');panel.tabIndex=-1;panel.hidden=true;
 aside.prepend(tabs);tabs.after(panel);
 const box=document.createElement('dialog');box.id='photo-lightbox';box.setAttribute('aria-label','Build photo');
 box.innerHTML=`<div class="lb-top"><span class="lb-count" aria-live="polite"></span><button type="button" class="lb-close" aria-label="Close photo">×</button></div>
<div class="lb-stage"><button type="button" class="lb-nav lb-prev" aria-label="Previous photo">‹</button><div class="lb-track"><img alt="" decoding="async"></div><button type="button" class="lb-nav lb-next" aria-label="Next photo">›</button></div>
<div class="lb-caption"><span class="lb-eyebrow"></span><h3></h3><p></p></div>`;
 document.body.append(box);
 let chipObserver=null,selected='model',data=null,loading=null,flat=[],index=0;
 try{if(sessionStorage.getItem('rc-explore-tab')==='photos')selected='photos';}catch{}
 if(location.hash.startsWith('#photos'))selected='photos';

 function layout(){
  const on=api.state.mode==='finished',photos=on&&selected==='photos';
  tabs.hidden=!on;panel.hidden=!photos;document.body.classList.toggle('explore-photos',photos);
  tabs.querySelectorAll('[data-explore-tab]').forEach(b=>{const a=b.dataset.exploreTab===selected;b.setAttribute('aria-selected',String(a));b.tabIndex=a?0:-1;});
  // #photos in the address names the Photos tab only while it is showing, so a shared link opens it.
  const hashed=location.hash.startsWith('#photos');
  if(photos&&!hashed)history.replaceState(null,'','#photos');else if(!photos&&hashed)history.replaceState(null,'',location.pathname+location.search);
  if(photos)load();else api.invalidate?.();
 }
 function select(value,focus){
  if(value===selected){if(focus)tabs.querySelector(`[data-explore-tab="${value}"]`).focus();return;}
  selected=value;try{sessionStorage.setItem('rc-explore-tab',value);}catch{}
  layout();window.scrollTo({top:0});
  window.dispatchEvent(new Event('explore-tab-changed'));
  if(focus)tabs.querySelector(`[data-explore-tab="${value}"]`).focus();
 }
 tabs.onclick=e=>{const b=e.target.closest('[data-explore-tab]');if(b)select(b.dataset.exploreTab);};
 tabs.onkeydown=e=>{const keys={ArrowRight:1,ArrowLeft:1,Home:1,End:1};if(!keys[e.key])return;e.preventDefault();select(e.key==='Home'?'model':e.key==='End'?'photos':selected==='model'?'photos':'model',true);};

 async function load(){
  if(data||loading)return loading;
  panel.innerHTML='<p class="ph-loading" role="status">Loading build photos…</p>';
  loading=fetch(MANIFEST).then(r=>{if(!r.ok)throw Error('Could not load the build photos.');return r.json();})
   .then(d=>{data=d;render();const m=location.hash.match(/^#photos\/(.+)$/);if(m){const i=flat.findIndex(p=>p.id===decodeURIComponent(m[1]));if(i>=0)open(i);}})
   .catch(e=>{loading=null;panel.innerHTML=`<p class="ph-error" role="alert">${escape(e.message)}</p><button type="button" class="ph-retry">Try again</button>`;panel.querySelector('.ph-retry').onclick=load;});
  return loading;
 }

 function render(){
  const stages=photoTimeline(data);flat=stages.flatMap(s=>s.photos);
  const first=flat[0].taken,last=flat.at(-1).taken;
  panel.innerHTML=`<div class="ph-hero">
<span class="ph-eyebrow">Build progress</span><h2>From one panel to a standing set.</h2>
<p>${flat.length} photos from the shop floor, ${escape(span(first,last))}. Tap any photo to see it full screen.</p>
<button type="button" class="ph-latest">See the latest photo →</button>
</div>
<nav class="ph-stages" aria-label="Build stages"><ol>${stages.map((s,i)=>`<li><a href="#ph-stage-${s.id}" data-stage="${s.id}"><b>${i+1}</b><span>${escape(s.title)}</span></a></li>`).join('')}</ol></nav>
<ol class="ph-timeline">${stages.map((s,i)=>`<li class="ph-stage" id="ph-stage-${s.id}">
<div class="ph-stage-head"><span class="ph-dot" aria-hidden="true">${i+1}</span><div><time datetime="${s.first.slice(0,10)}">${escape(dateRange(s.first,s.last))}</time><h3>${escape(s.title)}</h3><p>${escape(s.summary)}</p></div></div>
<div class="ph-grid">${s.photos.map(p=>{const n=flat.indexOf(p),wide=p.width>p.height;const lead=!wide&&p===s.photos[0]&&s.photos.length%2===1;return `<figure class="ph-item${wide?' wide':''}${lead?' lead':''}" style="--ar:${p.width}/${p.height}">
<button type="button" data-photo="${n}" aria-label="Open photo ${n+1} of ${flat.length}: ${escape(p.title)}"><img src="${smallest(p)}" srcset="${srcset(p)}" sizes="${wide?'(max-width:600px) 100vw, (max-width:1100px) 66vw, 720px':'(max-width:600px) 50vw, (max-width:1100px) 33vw, 360px'}" width="${p.width}" height="${p.height}" alt="${escape(p.caption)}" loading="${n<4?'eager':'lazy'}" decoding="async" style="background-image:url(${p.placeholder})"></button>
<figcaption><strong>${escape(p.title)}</strong><span>${escape(day(p.taken))} · ${escape(time(p.taken))}</span></figcaption></figure>`;}).join('')}</div>
</li>`).join('')}</ol>
<p class="ph-foot">The build is still going. New photos land here as each stage finishes.</p>`;
  panel.querySelectorAll('.ph-grid img').forEach(img=>{const done=()=>img.classList.add('loaded');if(img.complete)done();else img.addEventListener('load',done,{once:true});});
  panel.querySelector('.ph-latest').onclick=()=>open(flat.length-1);
  // The chip for the stage being read lights up and stays in view in the chip row.
  const chips=panel.querySelector('.ph-stages ol');chipObserver?.disconnect();
  chipObserver=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){const id=e.target.id.slice(9);chips.querySelectorAll('a').forEach(a=>a.toggleAttribute('aria-current',a.dataset.stage===id));const a=chips.querySelector(`[data-stage="${id}"]`);chips.scrollTo({left:a.offsetLeft-chips.clientWidth/2+a.offsetWidth/2,behavior:'smooth'});}},{rootMargin:'-30% 0px -60% 0px'});
  panel.querySelectorAll('.ph-stage').forEach(el=>chipObserver.observe(el));
  panel.onclick=e=>{
   const b=e.target.closest('[data-photo]');if(b){open(+b.dataset.photo);return;}
   const a=e.target.closest('[data-stage]');if(a){e.preventDefault();document.getElementById('ph-stage-'+a.dataset.stage).scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
  };
 }

 // Lightbox: arrow keys, buttons, or a horizontal swipe step through every photo in build order.
 const img=box.querySelector('img'),track=box.querySelector('.lb-track');
 const sizes='(min-aspect-ratio: 1/1) 90vw, 100vw';
 function show(i){
  index=(i+flat.length)%flat.length;const p=flat[index],stage=data.stages.find(s=>s.id===p.stage);
  // Start from the grid thumbnail the browser already has, so the photo appears at once and sharpens.
  const thumb=panel.querySelector(`[data-photo="${index}"] img`),ready=thumb?.complete&&thumb.naturalWidth?thumb.currentSrc:'';
  img.classList.remove('loaded');img.classList.toggle('from-thumb',!!ready);img.style.backgroundImage=`url(${ready||p.placeholder})`;img.width=p.width;img.height=p.height;
  img.sizes=sizes;img.srcset=srcset(p);img.src=smallest(p);img.alt=p.caption;
  if(img.complete)img.classList.add('loaded');
  box.querySelector('.lb-count').textContent=`${index+1} / ${flat.length}`;
  box.querySelector('.lb-eyebrow').textContent=`${stage?.title||''} · ${day(p.taken)}, ${time(p.taken)}`;
  box.querySelector('h3').textContent=p.title;box.querySelector('.lb-caption p').textContent=p.caption;
  history.replaceState(null,'','#photos/'+encodeURIComponent(p.id));
  for(const n of [index+1,index-1]){const q=flat[(n+flat.length)%flat.length],pre=new Image();pre.sizes=sizes;pre.srcset=srcset(q);}
 }
 img.addEventListener('load',()=>img.classList.add('loaded'));
 let opener=null;
 function open(i){opener=document.activeElement;show(i);if(!box.open)box.showModal();document.body.classList.add('lightbox-open');box.querySelector('.lb-close').focus({preventScroll:true});}
 box.addEventListener('close',()=>{document.body.classList.remove('lightbox-open');if(selected==='photos')history.replaceState(null,'','#photos');const back=panel.querySelector(`[data-photo="${index}"]`)||opener;back?.focus({preventScroll:true});back?.scrollIntoView?.({block:'nearest'});});
 box.querySelector('.lb-close').onclick=()=>box.close();
 box.querySelector('.lb-prev').onclick=()=>show(index-1);
 box.querySelector('.lb-next').onclick=()=>show(index+1);
 box.addEventListener('click',e=>{if(e.target===box||e.target.classList.contains('lb-stage'))box.close();});
 box.addEventListener('keydown',e=>{
  if(e.key==='ArrowRight'){e.preventDefault();show(index+1);}
  else if(e.key==='ArrowLeft'){e.preventDefault();show(index-1);}
  else if(e.key==='Home'){e.preventDefault();show(0);}
  else if(e.key==='End'){e.preventDefault();show(flat.length-1);}
 });
 let drag=null;
 track.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;drag={x:e.clientX,y:e.clientY,id:e.pointerId,dx:0,dy:0};track.setPointerCapture(e.pointerId);track.style.transition='none';});
 track.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;drag.dx=e.clientX-drag.x;drag.dy=e.clientY-drag.y;const down=drag.dy>0&&Math.abs(drag.dy)>Math.abs(drag.dx);track.style.transform=down?`translateY(${drag.dy}px)`:`translateX(${drag.dx}px)`;track.style.opacity=down?String(Math.max(.4,1-drag.dy/400)):'';});
 const end=e=>{if(!drag||e.pointerId!==drag.id)return;const {dx,dy}=drag;drag=null;track.style.transition='';track.style.transform='';track.style.opacity='';
  if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy))show(index+(dx<0?1:-1));else if(dy>90&&dy>Math.abs(dx))box.close();};
 track.addEventListener('pointerup',end);track.addEventListener('pointercancel',end);

 // On phones the 3D viewer is pinned to the top of the screen; keep the tabs pinned just under it so the
 // Build photos tab stays reachable however far the design panel is scrolled.
 const viewport=document.querySelector('.viewport'),pin=()=>{const v=getComputedStyle(viewport),pinned=v.position==='sticky'&&v.display!=='none';document.documentElement.style.setProperty('--explore-tabs-top',(pinned?Math.round(viewport.offsetHeight):0)+'px');};
 new ResizeObserver(pin).observe(viewport);window.addEventListener('resize',pin);window.addEventListener('explore-tab-changed',pin);pin();
 const baseMode=api.setMode;api.setMode=m=>{const r=baseMode(m);layout();return r;};
 if(selected==='photos'&&location.hash.startsWith('#photos')&&api.state.mode!=='finished')api.setMode('finished');
 layout();
 api.explorePhotos={select,open:i=>load().then(()=>open(i)),get tab(){return selected;}};
}
