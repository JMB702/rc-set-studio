// Approvals retain their design and reviewed estimate. Editing keeps the original creation order.
import {defaultDesign,designLine,colorName} from './design.js';
import {normalizeDesign,normalizeApprovalEstimate,approvalMatchesDesign} from './pricing-config.js';
import {mountLabor,costSummary} from './labor.js';
import {money} from './pricing-calc.js';
const builtIn=normalizeDesign(defaultDesign),key=d=>JSON.stringify(normalizeDesign(d));
const when=t=>new Date(t).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const rememberedName=()=>{try{return decodeURIComponent(document.cookie.split('; ').find(c=>c.startsWith('rc_comment_name='))?.split('=')[1]||'')}catch{return ''}};
function dots(d){const wrap=document.createElement('span');wrap.className='approval-dots';wrap.setAttribute('aria-hidden','true');for(const c of [d.wallColor,d.platformShape!=='none'&&d.platformColor,d.floor==='charcoal'?d.floorColor:d.floor==='wood'&&'oak']){const dot=document.createElement('span');dot.className='dot'+(c==='oak'?' oak':'')+(c?'':' empty');if(c&&c!=='oak')dot.style.background=c;wrap.append(dot);}return wrap;}
function detail(d){return `${designLine(d)} · walls ${colorName(d.wallColor)}${d.platformShape!=='none'?` · platform ${colorName(d.platformColor)}, ${d.platformBack}″ back / ${d.platformSide}″ sides`:''}${d.floor==='charcoal'?` · floor ${colorName(d.floorColor)}`:''}`;}
export function installApprovals(api){
 const S=api.state,design=document.querySelector('#design');if(!design)return;
 const initialLabor=JSON.stringify(api.captureLabor());
 const box=document.createElement('div');box.className='design-approve';
 box.innerHTML=`<button type="button" id="approve-button" class="approve-button">Approve this design</button><button type="button" id="approve-cancel-edit" hidden>Cancel edit</button><p id="approve-status" class="hint" role="status"></p><details id="approvals"><summary>Approved designs <small id="approvals-count"></small><span>+</span></summary><ol id="approvals-list"></ol><p class="hint">Load a design or edit its approval. The newest approval remains the site default.</p></details>`;
 design.append(box);
 const latestSummary=document.createElement('p');latestSummary.className='approval-latest';box.prepend(latestSummary);
 const dock=document.createElement('div');dock.id='approval-dock';dock.setAttribute('aria-label','Design approval');const approvalHistory=box.querySelector('#approvals'),dockActions=document.createElement('div');dockActions.className='approval-dock-actions';dockActions.append(box.querySelector('#approve-cancel-edit'),box.querySelector('#approve-button'));dock.append(dockActions);document.body.append(dock);
 new ResizeObserver(()=>{if(!dock.hidden)document.documentElement.style.setProperty('--approval-dock-height',dock.getBoundingClientRect().height+'px');}).observe(dock);
 function syncDock(){dock.hidden=S.mode!=='finished';const parent=dock.hidden?box:dock;if(approvalHistory.parentElement!==parent){if(dock.hidden)box.append(approvalHistory);else dock.prepend(approvalHistory);}document.body.classList.toggle('approval-dock-visible',!dock.hidden);const rect=document.querySelector('.controls').getBoundingClientRect(),mobile=matchMedia('(max-width:850px)').matches;dock.style.left=(mobile?0:rect.left)+'px';dock.style.width=(mobile?document.documentElement.clientWidth:rect.width)+'px';latestSummary.hidden=S.mode!=='pricing';box.querySelector('#approve-status').hidden=true;box.hidden=S.mode!=='pricing';}
 new ResizeObserver(syncDock).observe(document.querySelector('.controls'));window.addEventListener('resize',syncDock);window.addEventListener('studio-view-changed',syncDock);syncDock();
 const dialog=document.createElement('dialog');dialog.id='approve-dialog';dialog.setAttribute('aria-labelledby','approve-title');
 dialog.innerHTML=`<form method="dialog"><h2 id="approve-title">Approve this design</h2><p id="approve-description"></p><ul class="design-summary" id="approve-summary"></ul><p id="approve-line"></p><section id="approve-cost" aria-labelledby="approve-cost-title"><h3 id="approve-cost-title">What it will cost</h3><dl><div><dt>Materials <small>Full set + estimated tax</small></dt><dd id="approve-materials">Loading…</dd></div><div><dt>Labor <small id="approve-labor-note"></small></dt><dd id="approve-labor-total"></dd></div><div class="approve-total"><dt>Total estimate <small id="approve-total-note">Estimated material tax included; delivery excluded</small></dt><dd id="approve-total" aria-live="polite"></dd></div></dl><div id="approve-labor"></div></section><p id="approve-as" hidden>Approving as <strong id="approve-as-name"></strong> <button type="button" class="link-button" id="approve-not-me">Not you?</button></p><label id="approve-name-field" for="approve-name">Your name<input id="approve-name" maxlength="80" autocomplete="name" placeholder="Name required"></label><p id="approve-error" role="status"></p><div class="dialog-actions"><button value="cancel" formnovalidate>Cancel</button><button type="submit" id="approve-confirm" class="primary" value="approve">Approve</button></div></form>`;
 document.body.append(dialog);
 const q=s=>document.querySelector(s);let approvals=[],draftId=crypto.randomUUID(),loaded=false,data=null,editing=null,beforeEdit=null,saving=false;
 mountLabor(q('#approve-labor'),api,{prefix:'approve-labor'});
 const tip=document.createElement('div');tip.className='rate-reminder';tip.setAttribute('role','note');tip.innerHTML='<p></p><button type="button" aria-label="Dismiss reminder">×</button>';
 q('#approve-labor .labor-rates legend').after(tip);tip.querySelector('button').onclick=()=>{tip.hidden=true;};
 q('#approve-labor .labor-rates').addEventListener('change',()=>{tip.hidden=true;});
 function reminder(){tip.querySelector('p').textContent='Keep everyone working in the crew count. Enter paid rates; use $0 for labor already covered. Blank means not priced.';tip.hidden=false;}
 function currentEstimate(){const c=costSummary(data,S),l=c.labor;return normalizeApprovalEstimate({crew:l.crew,hours:l.hours,defaultHours:l.defaultHours,personHours:l.personHours,rates:l.rates,materialsCents:c.materialsCents,taxCents:c.taxCents,shoppingHours:l.shoppingHours,shoppingRateCents:l.shoppingRateCents,pending:c.pending,deckLayoutRevision:'paired-v1'});}
 function costs(){if(!dialog.open)return;if(!data){q('#approve-materials').textContent='Loading…';return;}
  const c=costSummary(data,S),l=c.labor;q('#approve-materials').textContent=money(c.materialsCents+c.taxCents);q('#approve-labor-note').textContent=`${l.hours} hrs · crew of ${l.crew} + ${l.shoppingHours} shopping hrs`;q('#approve-labor-total').textContent=l.costCents==null?'No rates set':money(l.costCents);q('#approve-total').textContent=money(c.totalCents);
  const note=[c.pending?`${c.pending} material items still unpriced`:'',l.costCents==null?'labor not priced':l.unrated?`${l.unrated} ${l.unrated===1?'person':'people'} without a rate`:'','includes estimated material tax; delivery excluded'].filter(Boolean).join(' · ').replace(/^./,x=>x.toUpperCase());q('#approve-total-note').textContent=note;q('#approve-cost .approve-total').dataset.note=note;
 }
 async function loadData(){if(data)return;try{const r=await fetch('./data/flat-shopping-list.json');if(!r.ok)throw Error();data=await r.json();costs();q('#approve-confirm').disabled=false;}catch{q('#approve-materials').textContent='Unavailable';q('#approve-error').textContent='The estimate could not load. Close and reopen to retry.';}}
 function changedDraft(){if(!saving)draftId=crypto.randomUUID();}
 window.addEventListener('labor-changed',()=>{changedDraft();costs();});q('#approve-name').addEventListener('input',changedDraft);
 function status(){const latest=approvals[0];latestSummary.textContent=latest?`Latest approved design · ${latest.name} · ${when(latest.createdAt)}. ${detail(latest.design)}`:loaded?'No design has been approved yet.':'';q('#approve-cancel-edit').hidden=!editing;q('#approve-button').textContent=editing?'Review approval changes':'Approve this design';
  q('#approve-status').textContent=editing?`Editing ${editing.name}'s approval. Adjust the design above, then review the name and labor estimate.${editing.estimate?'':' This older approval has no saved labor estimate; current rates are shown.'}`:!loaded?'':latest?(approvalMatchesDesign(latest,S)?`This is the approved design, approved by ${latest.name} on ${when(latest.createdAt)}.`:approvals.some(a=>approvalMatchesDesign(a,S))?'This is an earlier approved design. Approve it again to make it the default.':`Changed from the approved design (${latest.name}, ${when(latest.createdAt)}).`):'No design has been approved yet.';
  q('#approve-button').disabled=!editing&&!!latest&&approvalMatchesDesign(latest,S);
  for(const b of document.querySelectorAll('#approvals-list button[data-id]'))b.setAttribute('aria-current',approvalMatchesDesign(approvals.find(a=>a.id===b.dataset.id),S)?'true':'false');
 }
 function cancelEdit(){if(!editing)return;const previous=beforeEdit;editing=null;beforeEdit=null;if(previous){api.configure(previous.design);api.restoreLabor(previous.labor);}status();}
 q('#approve-cancel-edit').onclick=cancelEdit;
 function choose(a){api.configure({...a.design});if(a.estimate)api.restoreLabor(a.estimate);}
 function list(){q('#approvals-count').textContent=approvals.length?`(${approvals.length})`:'';q('#approvals').hidden=!approvals.length;
  q('#approvals-list').replaceChildren(...approvals.map((a,i)=>{
   const li=document.createElement('li'),row=document.createElement('div'),toggle=document.createElement('button'),body=document.createElement('div'),name=document.createElement('strong'),date=document.createElement('small');
   row.className='approval-row';toggle.type='button';toggle.className='approval-toggle';toggle.dataset.id=a.id;toggle.setAttribute('aria-expanded','false');body.id='approval-detail-'+a.id;toggle.setAttribute('aria-controls',body.id);body.className='approval-breakdown';body.hidden=true;
   name.textContent=a.name;date.textContent=when(a.createdAt);toggle.append(name,date);if(i===0){const badge=document.createElement('span');badge.className='badge';badge.textContent='Default';name.append(' ',badge);}
   toggle.onclick=()=>{body.hidden=!body.hidden;toggle.setAttribute('aria-expanded',String(!body.hidden));};
   const edit=document.createElement('button');edit.type='button';edit.className='approval-edit';edit.textContent='Edit';edit.setAttribute('aria-label','Edit approval by '+a.name);edit.onclick=()=>{cancelEdit();beforeEdit={design:structuredClone(S),labor:api.captureLabor()};editing=a;choose(a);api.setMode('finished');status();};row.append(toggle,edit);
   function section(title,fields){const h=document.createElement('h4'),dl=document.createElement('dl');h.textContent=title;for(const [label,value]of fields){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd);}body.append(h,dl);}
   const d=a.design;section('Design',[
    ['Walls',`${d.height/12}′ tall · ${d.angle}° wings`],['Wall color',colorName(d.wallColor)],
    ['Platform',d.platformShape==='none'?'None':`${d.platformShape==='square'?'Square':'Angled'} · 10″ high`],
    ...(d.platformShape==='none'?[]:[['Platform gaps',`${d.platformBack}″ back · ${d.platformSide}″ sides`],['Platform color',colorName(d.platformColor)]]),
    ['Floor',d.floor==='none'?'None':d.floor==='wood'?'Oak laminate':'Painted plywood'],...(d.floor==='charcoal'?[['Floor color',colorName(d.floorColor)]]:[])
   ]);
   if(a.estimate){const e=a.estimate;section('Saved estimate',[
    ['Materials',money(e.materialsCents)],['Labor',e.laborCents===null?'Not priced':money(e.laborCents)],
    ...(e.taxCents!==undefined?[['Estimated tax',money(e.taxCents)]]:[]),['Total',money(e.totalCents)],
    ['Crew',`${e.crew} people`],['Time on site',`${e.hours} hours`],['Person-hours',String(e.personHours)],
    ...(e.shoppingHours?[['Shopping',`${e.shoppingHours} hours`]]:[]),...(e.pending?[['Unpriced items',String(e.pending)]]:[])
   ]);}else{const note=document.createElement('p');note.textContent='No saved cost estimate.';body.append(note);}
   if(a.updatedAt){const updated=document.createElement('p');updated.className='approval-updated';updated.textContent='Edited '+when(a.updatedAt);body.append(updated);}
   const loadButton=document.createElement('button');loadButton.type='button';loadButton.className='approval-load';loadButton.textContent='Load this design';loadButton.onclick=()=>{cancelEdit();choose(a);};body.append(loadButton);li.append(row,body);return li;
  }));status();
 }

 async function load(){try{const r=await fetch('/api/approvals');const response=await r.json();if(!r.ok)throw Error(response.error);approvals=response.approvals;loaded=true;const latest=approvals[0];if(latest){const untouched=!api.hasRestoredSession&&S.mode==='finished'&&key(S)===key(defaultDesign);Object.assign(defaultDesign,latest.design);if(untouched){api.configure({...latest.design});if(latest.estimate&&JSON.stringify(api.captureLabor())===initialLabor)api.restoreLabor(latest.estimate);}}list();}catch{loaded=true;q('#approve-status').textContent='Approvals are unavailable right now.';}}
 function open(){const name=editing?editing.name:rememberedName()||q('#comment-name')?.value.trim()||'';q('#approve-title').textContent=editing?'Edit approval':'Approve this design';q('#approve-confirm').textContent=editing?'Save changes':'Approve';q('#approve-confirm').disabled=!data;
  q('#approve-description').textContent=editing?(editing.id===approvals[0]?.id?'Save changes to this approval and its default design.':'Save changes to this earlier approval; the current default stays the newest approval.'):'Everyone who opens the site will start from it, and it is listed under Approved designs.';
  q('#approve-summary').replaceChildren(...[['Walls',`${S.height/12}′ tall · ${S.angle}° wings · ${colorName(S.wallColor)}`],['Platform',S.platformShape==='none'?'None':`${S.platformShape==='square'?'Square':'Angled'} · ${S.platformBack}″ back · ${S.platformSide}″ sides · ${colorName(S.platformColor)}`],['Floor',S.floor==='none'?'None':S.floor==='wood'?'Oak laminate':`Painted plywood · ${colorName(S.floorColor)}`]].map(([k,v])=>{const li=document.createElement('li'),t=document.createElement('strong'),d=document.createElement('span');t.textContent=k;d.textContent=v;li.append(document.createElement('span'),t,d);return li;}));
  q('#approve-name').value=name;q('#approve-as-name').textContent=name;q('#approve-as').hidden=!!editing||!name;q('#approve-name-field').hidden=!editing&&!!name;q('#approve-error').textContent='';q('#approve-line').textContent=`${designLine(S)} · ${colorName(S.wallColor)} walls`;
  dialog.showModal();reminder();costs();loadData();q('#approve-name').focus();
 }
 q('#approve-not-me').onclick=()=>{q('#approve-as').hidden=true;q('#approve-name-field').hidden=false;q('#approve-name').value='';q('#approve-name').focus();};q('#approve-button').onclick=open;
 dialog.addEventListener('close',()=>{if(!saving)cancelEdit();});
 dialog.querySelector('form').addEventListener('submit',async e=>{if(e.submitter?.value!=='approve')return;e.preventDefault();if(saving)return;const name=q('#approve-name').value.trim();if(!name){q('#approve-name-field').hidden=false;q('#approve-error').textContent='Enter your name to approve.';q('#approve-name').focus();return;}if(!data){q('#approve-error').textContent='Wait for the estimate to load.';return;}
  saving=true;q('#approve-confirm').disabled=true;q('#approve-error').textContent='Saving…';
  try{const isEdit=!!editing,design=normalizeDesign(S),estimate=currentEstimate(),r=await fetch('/api/approvals',{method:isEdit?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:editing?.id||draftId,...(editing?{revision:editing.revision??0}:{}),name,design,estimate})}),response=await r.json();if(!r.ok)throw Error(response.error||'Could not save the approval.');
   draftId=crypto.randomUUID();if(isEdit)approvals=approvals.map(a=>a.id===response.approval.id?response.approval:a);else approvals=[response.approval,...approvals.filter(a=>a.id!==response.approval.id)];if(approvals[0]?.id===response.approval.id)Object.assign(defaultDesign,response.approval.design);
   editing=null;beforeEdit=null;dialog.close();list();q('#approve-status').textContent=isEdit?'Approval updated.':'Approved by '+name+'. This is now the default design.';
  }catch(err){q('#approve-error').textContent=err.message;}finally{saving=false;q('#approve-confirm').disabled=false;}
 });
 window.addEventListener('set-configured',()=>{changedDraft();status();});window.addEventListener('surface-color-changed',()=>{changedDraft();status();});api.approvals=()=>approvals.map(a=>({...a}));api.approvalCost=()=>data?costSummary(data,S):null;api.builtInDesign=()=>({...builtIn});load();
}
