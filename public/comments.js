import * as T from 'three';
const $=s=>document.querySelector(s);
export function installComments(api) {
  const panel=$('#comment-panel'),toggle=$('#comment-toggle'),form=$('#comment-form'),name=$('#comment-name'),body=$('#comment-body'),status=$('#comment-status'),list=$('#comment-list');
  let attachment=null,candidate=null,picking=false,outline=null,comments=[],nextBefore=null,loading=false,posting=false,draftId=crypto.randomUUID();
  try{name.value=decodeURIComponent(document.cookie.split('; ').find(c=>c.startsWith('rc_comment_name='))?.split('=').slice(1).join('=')||'');}catch{}
  const message=(text,error=false)=>{status.textContent=text;status.dataset.error=error;};
  function clearOutline(){if(outline){api.scene.remove(outline);outline.geometry.dispose();outline.material.dispose();outline=null;api.invalidate();}}
  function pickMode(on){picking=on;$('#comment-picker').hidden=!on;if(on){candidate=null;clearOutline();updateCandidate();}document.body.classList.toggle('picking-comment',on);$('#comment-pick').textContent=on?'Cancel picking':'Pick an element';$('#comment-pick-hint').hidden=!on;toggle.setAttribute('aria-label',on?'Cancel picking an element':'Comments');}
  function open(on){panel.hidden=!on;toggle.setAttribute('aria-expanded',String(on));if(on){load();name.value?body.focus():name.focus();}else{pickMode(false);toggle.focus();}}
  function updateCandidate(){ $('#comment-picker-label').textContent=candidate?candidate.label:'Click or tap a 3D element';$('#comment-picker-use').disabled=!candidate;}
  function cancelPicking(){pickMode(false);candidate=null;clearOutline();body.focus();}
  $('#comment-picker-cancel').onclick=cancelPicking;
  $('#comment-picker-use').onclick=()=>{if(!candidate)return;setAttachment(candidate);pickMode(false);candidate=null;message('Element attached. You can also remove it for a general comment.');body.focus();};
  toggle.onclick=()=>picking?cancelPicking():open(panel.hidden);
  $('#comment-close').onclick=()=>open(false);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(picking)cancelPicking();else if(!panel.hidden)open(false);}});
  function setAttachment(a){draftId=crypto.randomUUID();attachment=a;$('#comment-target').textContent=a?a.label:'General comment';$('#comment-clear').hidden=!a;}
  $('#comment-clear').onclick=()=>{setAttachment(null);clearOutline();};
  $('#comment-pick').onclick=()=>{if(picking)cancelPicking();else pickMode(true);message('');};
  function visible(o){for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;}
  function prefix(o){for(let p=o;p;p=p.parent)if(p.userData.commentPrefix)return p.userData.commentPrefix;return '';}
  function descriptor(o,part=null){const fig=o.parent?.userData.figures;if(fig)return {id:fig.commentId,label:fig.commentLabel,object:o.parent,part:null};const pre=prefix(o),key=part?.key||o.userData.commentKey,label=part?.label||o.name;if(!key)return null;return {id:(pre?pre+'/':'')+key,label:(pre?pre+' · ':'')+label,object:o,part};}
  function outlineElement(d){clearOutline();const o=d.object;api.scene.updateMatrixWorld(true);let box;
    if(d.part){const a=o.geometry.attributes.position;box=new T.Box3();for(let i=d.part.start*3;i<(d.part.start+d.part.count)*3;i++)box.expandByPoint(new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld));}
    else box=new T.Box3().setFromObject(o);
    outline=new T.Box3Helper(box,0x719b36);outline.material.depthTest=false;outline.material.transparent=true;outline.material.opacity=.95;outline.renderOrder=100;api.scene.add(outline);api.invalidate();
  }
  let down;
  const canvas=api.renderer.domElement;
  canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,id:e.pointerId};});
  canvas.addEventListener('pointerup',e=>{if(!picking||!down||down.id!==e.pointerId||Math.hypot(e.clientX-down.x,e.clientY-down.y)>7)return;
    const r=canvas.getBoundingClientRect(),ray=new T.Raycaster();api.scene.updateMatrixWorld(true);ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),api.camera);
    const hits=ray.intersectObjects(api.scene.children,true);let d;
    for(const hit of hits){if(!visible(hit.object))continue;let part=hit.object.userData.commentParts?.find(p=>hit.faceIndex>=p.start&&hit.faceIndex<p.start+p.count);d=descriptor(hit.object,part);if(d)break;}
    if(!d){$('#comment-picker-label').textContent=candidate?candidate.label+' · No element at that spot':'No element at that spot. Try another part.';return;}
    candidate={id:d.id,label:d.label,context:{...api.state,mode:api.state.mode==='build'?'build':'finished'}};outlineElement(d);updateCandidate();
  });
  canvas.addEventListener('pointercancel',()=>{down=null;});
  function resetSelection(){clearOutline();if(picking){candidate=null;updateCandidate();}}
  window.addEventListener('comment-scene-reset',resetSelection);
  window.addEventListener('set-configured',resetSelection);
  document.querySelectorAll('#comment-name,#comment-body').forEach(el=>el.addEventListener('input',()=>{draftId=crypto.randomUUID();}));
  async function request(url,options){let r;try{r=await fetch(url,options);}catch{throw Error('Unable to connect. Please try again.');}let data;try{data=await r.json();}catch{throw Error('Comments are temporarily unavailable. Please try again.');}if(!r.ok)throw Error(data.error||'Unable to save comments. Please try again.');return data;}
  function locate(c){pickMode(false);const config=c.context;api.configure({height:config.height,angle:config.angle,floor:config.floor,platformShape:config.platformShape??(config.floor==='platform'?'angled':'none'),platformBack:config.platformBack??12,platformSide:config.platformSide??12,platformAngle:config.platformAngle??config.angle,...(config.platformColor?{platformColor:config.platformColor}:{}),wallColor:config.wallColor||'#34383b',floorColor:config.floorColor||'#3c4041',figures:config.figures||'podcast',figureScale:config.figureScale||1});if(config.mode==='build')api.setStep(config.step);else api.setMode('finished');clearOutline();let found;
    api.scene.traverse(o=>{if(found||!visible(o))return;for(const part of o.userData.commentParts||[]){const d=descriptor(o,part);if(d?.id===c.elementId){found=d;break;}}if(!found){const d=descriptor(o);if(d?.id===c.elementId)found=d;}});
    if(found){outlineElement(found);const box=outline.box,center=box.getCenter(new T.Vector3()),shift=center.clone().sub(api.orbit.target);api.camera.position.add(shift);api.orbit.target.copy(center);api.orbit.update();api.invalidate();message('Showing '+c.elementLabel+'.');if(innerWidth<=850)open(false);}
    else message('This element is unavailable in this view. The original configuration has been restored.',true);
  }
  function render(){list.replaceChildren();for(const c of comments){const card=document.createElement('article');card.className='comment-card';const head=document.createElement('header'),author=document.createElement('strong'),time=document.createElement('time');author.textContent=c.name;time.dateTime=new Date(c.createdAt).toISOString();time.textContent=new Date(c.createdAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});head.append(author,time);const p=document.createElement('p');p.textContent=c.body;card.append(head,p);if(c.elementId){const b=document.createElement('button');b.className='element-link';b.textContent=c.elementLabel;b.title='Show this 3D element';b.onclick=()=>locate(c);card.append(b);}else{const s=document.createElement('small');s.textContent='General comment';card.append(s);}const ctx=document.createElement('small');ctx.textContent=`${c.context.height/12}′ panel · ${c.context.angle}° wings · ${[(c.context.platformShape&&c.context.platformShape!=='none'||c.context.floor==='platform')&&`${c.context.platformShape==='square'?'Square':'Angled'} platform`,c.context.floor==='wood'?'Oak floor':c.context.floor==='charcoal'?'Painted floor':null].filter(Boolean).join(' · ')||'No floor'}${c.context.mode==='build'?' · Build step '+(c.context.step+1):''}`;card.append(ctx);list.append(card);}
    if(!comments.length){const p=document.createElement('p');p.textContent='No comments yet. Start the discussion.';list.append(p);}$('#comment-count').textContent=comments.length?String(comments.length)+(nextBefore?'+':''):'';$('#comment-more').hidden=!nextBefore;
  }
  async function load(older=false){if(loading)return;loading=true;$('#comment-refresh').disabled=true;$('#comment-more').disabled=true;
    if(!comments.length)list.textContent='Loading comments…';
    try{const data=await request('/api/comments'+(older&&nextBefore?'?before='+encodeURIComponent(nextBefore):''));comments=older?[...comments,...data.comments.filter(c=>!comments.some(x=>x.id===c.id))]:data.comments;nextBefore=data.nextBefore;render();}
    catch(e){message(e.message,true);if(!comments.length)list.textContent='Unable to load comments. Use Refresh to try again.';}
    finally{loading=false;$('#comment-refresh').disabled=false;$('#comment-more').disabled=false;}
  }
  $('#comment-refresh').onclick=()=>load();$('#comment-more').onclick=()=>load(true);
  form.onsubmit=async e=>{e.preventDefault();if(posting)return;if(!name.value.trim()){name.setCustomValidity('Enter your name.');name.reportValidity();name.oninput=()=>name.setCustomValidity('');return;}if(!body.value.trim()){body.setCustomValidity('Enter a comment.');body.reportValidity();body.oninput=()=>body.setCustomValidity('');return;}
    posting=true;$('#comment-submit').disabled=true;pickMode(false);message('Posting…');
    const payload={id:draftId,name:name.value.trim(),body:body.value.trim(),elementId:attachment?.id??null,elementLabel:attachment?.label??null,context:attachment?.context||{...api.state,mode:api.state.mode==='build'?'build':'finished'}};
    const fields=[name,body,$('#comment-pick'),$('#comment-clear')];fields.forEach(el=>el.disabled=true);
    try{const data=await request('/api/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});comments=[data.comment,...comments.filter(c=>c.id!==data.comment.id)];name.value=data.comment.name;body.value='';draftId=crypto.randomUUID();setAttachment(null);clearOutline();render();message('Comment posted.');}
    catch(e){message(e.message+' Your draft has been kept.',true);}
    finally{posting=false;$('#comment-submit').disabled=false;fields.forEach(el=>el.disabled=false);}
  };
}
