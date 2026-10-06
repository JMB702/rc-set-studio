export function installPricingSwipe(article,content,deleteButton,actionsButton){
 let start=null,dragging=false,suppressClick=false;
 const width=88;
 function reveal(open){article.dataset.reveal=String(open);article.style.setProperty('--price-offset',open?'-88px':'0px');deleteButton.tabIndex=open?0:-1;deleteButton.setAttribute('aria-hidden',String(!open));actionsButton.setAttribute('aria-expanded',String(open));}
 function closeOthers(){article.parentElement?.querySelectorAll('.price-item[data-reveal="true"]').forEach(row=>{if(row!==article)row.dispatchEvent(new Event('close-price-actions'))});}
 article.addEventListener('close-price-actions',()=>reveal(false));
 actionsButton.onclick=()=>{const open=article.dataset.reveal!=='true';closeOthers();reveal(open);if(open)deleteButton.focus();};
 content.addEventListener('pointerdown',e=>{if(e.button!==0)return;start={x:e.clientX,y:e.clientY,id:e.pointerId,offset:article.dataset.reveal==='true'?-width:0};dragging=false;});
 content.addEventListener('pointermove',e=>{if(!start||e.pointerId!==start.id)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;
  if(!dragging){if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){start=null;return;}if(Math.abs(dx)<12||Math.abs(dx)<=Math.abs(dy))return;dragging=true;closeOthers();content.setPointerCapture(e.pointerId);article.classList.add('swiping');}
  article.style.setProperty('--price-offset',Math.max(-width,Math.min(0,start.offset+dx))+'px');
 });
 function end(e){if(!start)return;const offset=start.offset+e.clientX-start.x;start=null;article.classList.remove('swiping');if(dragging){suppressClick=true;reveal(offset<-width/2);setTimeout(()=>suppressClick=false,250);}dragging=false;}
 content.addEventListener('pointerup',end);content.addEventListener('pointercancel',()=>{start=null;dragging=false;article.classList.remove('swiping');reveal(article.dataset.reveal==='true')});
 content.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
 article.addEventListener('keydown',e=>{if(e.key==='Escape')reveal(false);if(e.key==='ArrowLeft'&&e.target===actionsButton){e.preventDefault();closeOthers();reveal(true);deleteButton.focus();}});
 reveal(false);
}
