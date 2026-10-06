// Design approvals. There are no accounts: approving asks for a name (remembered from comments when
// possible), stores the full design on the site, and the newest approval becomes the default everyone
// opens with. Choosing an approval in the list loads every setting it was approved with.
import {defaultDesign,designLine,colorName} from './design.js';
import {normalizeDesign} from './pricing-config.js';
import {mountLabor,costSummary} from './labor.js';
import {money} from './pricing-calc.js';
const builtIn=normalizeDesign(defaultDesign),key=d=>JSON.stringify(normalizeDesign(d));
const when=t=>new Date(t).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const rememberedName=()=>{try{return decodeURIComponent(document.cookie.split('; ').find(c=>c.startsWith('rc_comment_name='))?.split('=')[1]||'')}catch{return ''}};
function dots(d){const wrap=document.createElement('span');wrap.className='approval-dots';wrap.setAttribute('aria-hidden','true');for(const c of [d.wallColor,d.platformShape!=='none'&&d.platformColor,d.floor==='charcoal'?d.floorColor:d.floor==='wood'&&'oak']){const dot=document.createElement('span');dot.className='dot'+(c==='oak'?' oak':'')+(c?'':' empty');if(c&&c!=='oak')dot.style.background=c;wrap.append(dot);}return wrap;}
function detail(d){return `${designLine(d)} · walls ${colorName(d.wallColor)}${d.platformShape!=='none'?` · platform ${colorName(d.platformColor)}, ${d.platformBack}″ back / ${d.platformSide}″ sides`:''}${d.floor==='charcoal'?` · floor ${colorName(d.floorColor)}`:''}`;}

export function installApprovals(api){
 const S=api.state,design=document.querySelector('#design');if(!design)return;
 const box=document.createElement('div');box.className='design-approve';
 box.innerHTML=`<button type="button" id="approve-button" class="approve-button">Approve this design</button><p id="approve-status" class="hint" role="status"></p><details id="approvals"><summary>Approved designs <small id="approvals-count"></small><span>+</span></summary><ol id="approvals-list"></ol><p class="hint">Choose one to load all of its settings. The newest approval is the default everyone opens with.</p></details>`;
 design.append(box);
 const dialog=document.createElement('dialog');dialog.id='approve-dialog';dialog.setAttribute('aria-labelledby','approve-title');
 dialog.innerHTML=`<form method="dialog"><h2 id="approve-title">Approve this design</h2><p>Everyone who opens the site will start from it, and it is listed under Approved designs.</p><ul class="design-summary" id="approve-summary"></ul><section id="approve-cost" aria-labelledby="approve-cost-title"><h3 id="approve-cost-title">What it will cost</h3><dl><div><dt>Materials <small>Full set</small></dt><dd id="approve-materials">Loading…</dd></div><div><dt>Labor <small id="approve-labor-note"></small></dt><dd id="approve-labor-total"></dd></div><div class="approve-total"><dt>Total estimate <small id="approve-total-note">Before tax &amp; delivery</small></dt><dd id="approve-total" aria-live="polite"></dd></div></dl><div id="approve-labor"></div></section><p id="approve-as" hidden>Approving as <strong id="approve-as-name"></strong> <button type="button" class="link-button" id="approve-not-me">Not you?</button></p><label id="approve-name-field" for="approve-name">Your name<input id="approve-name" maxlength="80" autocomplete="name" placeholder="Name required"></label><p id="approve-error" role="status"></p><div class="dialog-actions"><button value="cancel" formnovalidate>Cancel</button><button type="submit" id="approve-confirm" class="primary" value="approve">Approve</button></div></form>`;
 document.body.append(dialog);
 const q=s=>document.querySelector(s);let approvals=[],draftId=crypto.randomUUID(),loaded=false,data=null;
 mountLabor(q('#approve-labor'),api,{prefix:'approve-labor'});
 // The cost gate: materials for the full set from the Pricing guide's rows, plus labor from the crew settings.
 function costs(){
  if(!dialog.open)return;if(!data){q('#approve-materials').textContent='Loading…';return;}
  const c=costSummary(data,S),l=c.labor;
  q('#approve-materials').textContent=money(c.materialsCents);
  q('#approve-labor-note').textContent=`${l.hours} hrs · crew of ${l.crew}`;
  q('#approve-labor-total').textContent=l.costCents==null?'No rates set':money(l.costCents);
  q('#approve-total').textContent=money(c.totalCents);
  q('#approve-total-note').textContent=[c.pending?`${c.pending} material items still unpriced`:'',l.costCents==null?'labor not priced':l.unrated?`${l.unrated} ${l.unrated===1?'person':'people'} without a rate`:'','before tax & delivery'].filter(Boolean).join(' · ').replace(/^./,x=>x.toUpperCase());
 }
 async function loadData(){if(data)return;try{const r=await fetch('./data/flat-shopping-list.json');if(!r.ok)throw Error();data=await r.json();costs();}catch{q('#approve-materials').textContent='Unavailable';}}
 window.addEventListener('labor-changed',costs);
 function status(){
  const current=key(S),latest=approvals[0];
  q('#approve-status').textContent=!loaded?'':latest?(key(latest.design)===current?`This is the approved design, approved by ${latest.name} on ${when(latest.createdAt)}.`:approvals.some(a=>key(a.design)===current)?'This is an earlier approved design. Approve it again to make it the default.':`Changed from the approved design (${latest.name}, ${when(latest.createdAt)}).`):'No design has been approved yet.';
  q('#approve-button').disabled=!!latest&&key(latest.design)===current;
  for(const b of document.querySelectorAll('#approvals-list button'))b.setAttribute('aria-current',key(approvals.find(a=>a.id===b.dataset.id).design)===current?'true':'false');
 }
 function list(){
  q('#approvals-count').textContent=approvals.length?`(${approvals.length})`:'';q('#approvals').hidden=!approvals.length;
  q('#approvals-list').replaceChildren(...approvals.map((a,i)=>{const li=document.createElement('li'),b=document.createElement('button'),head=document.createElement('span'),who=document.createElement('strong'),small=document.createElement('small');b.type='button';b.className='approval';b.dataset.id=a.id;who.textContent=a.name;head.append(who,document.createTextNode(' · '+when(a.createdAt)));if(i===0){const badge=document.createElement('em');badge.className='badge';badge.textContent='Default';head.append(' ',badge);}small.textContent=detail(a.design);b.append(dots(a.design),head,small);b.onclick=()=>{api.configure({...a.design});q('#approve-status').textContent=`Showing ${a.name}'s approved design from ${when(a.createdAt)}.`;};li.append(b);return li;}));
  status();
 }
 // The newest approval replaces the built-in default, unless the visitor has already changed the design.
 async function load(){
  try{const r=await fetch('/api/approvals');const data=await r.json();if(!r.ok)throw Error(data.error);approvals=data.approvals;loaded=true;
   const latest=approvals[0];if(latest){const untouched=key(S)===key(defaultDesign);Object.assign(defaultDesign,latest.design);if(untouched)api.configure({...latest.design});}
   list();
  }catch{loaded=true;q('#approve-status').textContent='Approvals are unavailable right now.';}
 }
 function open(){
  const name=rememberedName()||q('#comment-name')?.value.trim()||'';
  q('#approve-summary').replaceChildren(...[['Walls',`${S.height/12}′ tall · ${S.angle}° wings · ${colorName(S.wallColor)}`],['Platform',S.platformShape==='none'?'None':`${S.platformShape==='square'?'Square':'Angled'} · ${S.platformBack}″ back · ${S.platformSide}″ sides · ${colorName(S.platformColor)}`],['Floor',S.floor==='none'?'None':S.floor==='wood'?'Oak laminate':`Painted plywood · ${colorName(S.floorColor)}`]].map(([k,v])=>{const li=document.createElement('li'),t=document.createElement('strong'),d=document.createElement('span');t.textContent=k;d.textContent=v;li.append(document.createElement('span'),t,d);return li;}));
  q('#approve-name').value=name;q('#approve-as-name').textContent=name;q('#approve-as').hidden=!name;q('#approve-name-field').hidden=!!name;q('#approve-error').textContent='';
  dialog.showModal();costs();loadData();(name?q('#approve-confirm'):q('#approve-name')).focus();
 }
 q('#approve-not-me').onclick=()=>{q('#approve-as').hidden=true;q('#approve-name-field').hidden=false;q('#approve-name').value='';q('#approve-name').focus();};
 q('#approve-button').onclick=open;
 dialog.querySelector('form').addEventListener('submit',async e=>{
  if(e.submitter?.value!=='approve')return;e.preventDefault();
  const name=q('#approve-name').value.trim();if(!name){q('#approve-name-field').hidden=false;q('#approve-error').textContent='Enter your name to approve.';q('#approve-name').focus();return;}
  const button=q('#approve-confirm');button.disabled=true;q('#approve-error').textContent='Saving…';
  try{const design=normalizeDesign(S),r=await fetch('/api/approvals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:draftId,name,design})}),data=await r.json();if(!r.ok)throw Error(data.error||'Could not save the approval.');
   draftId=crypto.randomUUID();approvals=[data.approval,...approvals.filter(a=>a.id!==data.approval.id)];Object.assign(defaultDesign,data.approval.design);
   const commentName=q('#comment-name');if(commentName&&!commentName.value.trim())commentName.value=name;
   dialog.close();list();q('#approve-status').textContent=`Approved by ${name}. This is now the default design.`;
  }catch(err){q('#approve-error').textContent=err.message;}finally{button.disabled=false;}
 });
 window.addEventListener('set-configured',status);window.addEventListener('surface-color-changed',status);
 api.approvals=()=>approvals.map(a=>({...a}));api.approvalCost=()=>data?costSummary(data,S):null;api.builtInDesign=()=>({...builtIn});
 load();
}
