// One shared load animation per document; polling and edits never restart it.
export function createProgressIntro({paint,now=()=>performance.now(),requestFrame=fn=>requestAnimationFrame(fn),reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches,duration=1400}){
 let started=null,finished=false,pending=false;
 const fraction=()=>finished?1:started===null?0:1-(1-Math.min(1,Math.max(0,(now()-started)/duration)))**3;
 function refresh(){paint(fraction());}
 function tick(){pending=false;if(reduced()||now()-started>=duration)finished=true;refresh();if(!finished){pending=true;requestFrame(tick);}}
 function start(){if(started!==null){refresh();return;}started=now();finished=reduced();refresh();if(!finished&&!pending){pending=true;requestFrame(tick);}}
 return {start,refresh};
}
