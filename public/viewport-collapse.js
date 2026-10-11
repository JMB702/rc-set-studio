// On phones the pinned 3D view collapses as you scroll: it is sticky at a negative offset, so it slides up until only
// a strip remains, without resizing anything (no layout jumps). The progress ring moves into that strip. Pinned
// summaries below use --viewport-strip as their top offset.
export const STRIP=56;
export function installViewportCollapse(){
 const vp=document.querySelector('.viewport'),root=document.documentElement;let queued=false;
 function sync(){queued=false;
  const pinned=matchMedia('(max-width:850px)').matches&&getComputedStyle(vp).position==='sticky'&&vp.offsetHeight>STRIP+40;
  if(!pinned){vp.style.removeProperty('top');root.style.setProperty('--viewport-strip','0px');document.body.classList.remove('viewport-collapsed');window.dispatchEvent(new Event('viewport-strip-changed'));return;}
  const offset=STRIP-vp.offsetHeight;vp.style.top=offset+'px';root.style.setProperty('--viewport-strip',STRIP+'px');
  const collapsed=vp.getBoundingClientRect().top<=offset+1;
  if(collapsed!==document.body.classList.contains('viewport-collapsed')){document.body.classList.toggle('viewport-collapsed',collapsed);window.dispatchEvent(new Event('viewport-strip-changed'));}
 }
 const queue=()=>{if(!queued){queued=true;requestAnimationFrame(sync);}};
 addEventListener('scroll',queue,{passive:true});addEventListener('resize',queue);new ResizeObserver(queue).observe(vp);
 // Modes change the viewport's size and stickiness through body classes.
 new MutationObserver(queue).observe(document.body,{attributes:true,attributeFilter:['class']});
 sync();
}
