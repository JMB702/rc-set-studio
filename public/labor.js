// Labor estimate: planning person-hours for a skilled crew, worked out from the same design state the
// guides use, so leaving out the platform or floor removes its hours and 10′ walls add a little to every
// panel task. These are planning allowances for experienced carpenters with the tools in the Build guide,
// not a quote. Glue, compound and paint drying time is calendar time, not labor, and is not counted.
// The pure functions (laborTasks, laborEstimate, crewFactor, laborCost) take no DOM, so tests use them directly.
import {platformPlan} from './platform.js';
import {floorArea,priceRows,summary,money} from './pricing-calc.js';

export const LABOR={crew:2,maxCrew:12,hoursPerDay:8,panels:8,seams:5,corners:2};
// Person-hours to build one panel, by stage of the Build guide. The 10′ panel adds the wide backer, the
// 2′ skin cap, longer jacks and a two-person lift.
const PANEL={
 96:{cut:.75,frame:.75,skin:.5,jacks:1.25,bolt:.6,shelf:.4},
 120:{cut:.9,frame:1,skin:.75,jacks:1.5,bolt:.75,shelf:.45},
};
const r1=v=>Math.round(v*10)/10;

// Each task: {id, stage, name, personHours, note}. Steps are the Build guide stages the task covers.
export function laborTasks(d){
 const h=d.height===120?120:96,p=PANEL[h],n=LABOR.panels,tall=h===120,tasks=[];
 const add=(id,stage,name,personHours,note)=>tasks.push({id,stage,name,personHours:r1(personHours),note});
 const wallArea=n*4*h/12,floorType=d.floor==='platform'?'none':d.floor,platformShape=d.platformShape??(d.floor==='platform'?'angled':'none');
 add('setup','All','Material pickup, shop setup and cleanup',4+(floorType!=='none'?1:0)+(platformShape!=='none'?1:0),'Store run, unloading, saw and bench setup, daily cleanup');
 add('cutParts','0',`Cut and label the parts · ${n} panels`,p.cut*n,`${p.cut} h per panel`);
 add('frames','1–9','Assemble, glue and screw the frames',p.frame*n,`${p.frame} h per panel${tall?' · includes the wide skin-joint backer':''}`);
 add('skins','10–12',`Skin and staple${tall?' · plus the 2′ cap':''}`,p.skin*n,`${p.skin} h per panel`);
 add('jacks','13–16','Build the jacks · 16 total',p.jacks*n,`${p.jacks} h per pair: layout, scribed diagonals, gussets`);
 add('boltJacks','17','Bolt the jacks to the flats',p.bolt*n,`${p.bolt} h per panel: match-drill eight bolts${tall?' · taller lift':''}`);
 add('shelves','18–20','Crossbars, shelf and ballast',p.shelf*n,`${p.shelf} h per panel`);
 add('assemble','21–22','Join the seams and set the wing angles',LABOR.seams*(tall?.5:.4)+LABOR.corners*(tall?1.25:1),`${LABOR.seams} straight seams and ${LABOR.corners} corners, braced while setting the angle`);
 add('wallFinish','28',`Dress, prime and paint the walls · ${wallArea} sq ft`,(tall?2:1.5)+wallArea/150+wallArea*2/200,'Seams and corners, one primer coat, two finish coats');
 if(floorType!=='none'){const area=floorArea(d.angle);
  if(floorType==='wood')add('floor','23–27',`Lay the oak laminate floor · ${area.toFixed(0)} sq ft`,1+area*.06+1.5,'Footprint, underlay, click-lock rows at about 17 sq ft per person-hour, trim');
  else{const sheets=Math.ceil(area*1.1/32);add('floor','23–27',`Lay and paint the plywood floor · ${area.toFixed(0)} sq ft`,1+sheets*.5+2+area*3/200+1.5,`Footprint, ${sheets} sheets, seams, primer, two finish coats, trim`);}
 }
 if(platformShape!=='none'){const pl=platformPlan(d.angle,d.platformBack??12,d.platformSide??12,platformShape==='square'?90:Math.max(d.angle,d.platformAngle??d.angle)),c=pl.counts,ft=v=>v/12;
  add('platformFrame','30–31',`Cut and frame the platform · ${c.modules} modules`,.5+pl.lumberLengths.length*.06+c.modules,`${pl.lumberLengths.length} cuts, ${c.modules} module frames`);
  add('platformLegs','32–33','Legs, sills, then set and join the modules',c.legs*.15+c.sills*.1+c.modules*.35,`${c.legs} legs, ${c.sills} sills`);
  add('platformDeck','34–35','Deck and fascia',pl.deckSheets*.6+pl.deckScrews*.005+ft(pl.fasciaLength)*.12,`${pl.deckSheets} deck sheets, ${ft(pl.fasciaLength).toFixed(0)} ft of fascia`);
  add('platformFinish','36–37',`Tape, skim, prime and paint the platform · ${pl.finishArea.toFixed(0)} sq ft`,ft(pl.tapeLength+pl.beadLength)*.04+pl.finishArea*.03+pl.finishArea*3/120,'Two skim coats with sanding, one primer coat, two finish coats');
 }
 return tasks;
}
// How many people's worth of work a crew gets done. One person is slowed by the two-person lifts (raising
// flats, bolting jacks, setting wings); past two, each extra person adds less because tasks share tools and space.
export function crewFactor(crew){const n=Math.max(1,Math.min(LABOR.maxCrew,Math.round(crew)||1));return n===1?.85:n<=2?n:2+(n-2)*.75;}
// Hours on site for the whole crew, rounded up to the half hour.
export function laborEstimate(d,crew=LABOR.crew){
 const tasks=laborTasks(d),personHours=r1(tasks.reduce((s,t)=>s+t.personHours,0)),hours=Math.ceil(personHours/crewFactor(crew)*2)/2;
 return {tasks,personHours,crew:Math.max(1,Math.min(LABOR.maxCrew,Math.round(crew)||1)),hours,days:Math.ceil(hours/LABOR.hoursPerDay*2)/2};
}
// Each person has their own rate, per hour in cents, or null when it has not been set. Labor is priced from
// the people who have a rate; with no rates at all it is not priced.
export function laborCost(hours,rates){const set=rates.filter(r=>r!=null);return {costCents:set.length?Math.round(hours*set.reduce((s,r)=>s+r,0)):null,crewRateCents:set.length?set.reduce((s,r)=>s+r,0):null,unrated:rates.length-set.length};}

// Labor settings are per viewer and live in this browser only: crew size, a rate for each person, and an
// optional hours figure that replaces the estimate until it is reset. The adjusted hours remember the
// estimate they replaced, so changing the design or the crew (a new estimate) goes back to the estimate.
// Rates are kept for every slot up to the largest crew, so dropping a person and adding them back keeps their rate.
const KEY='rc_labor',settings={crew:LABOR.crew,rates:Array(LABOR.maxCrew).fill(null),hours:null,hoursFor:null};
const validRate=v=>Number.isFinite(v)&&v>=0;
try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved){if(Number.isInteger(saved.crew)&&saved.crew>=1&&saved.crew<=LABOR.maxCrew)settings.crew=saved.crew;
 if(Array.isArray(saved.rates))settings.rates=settings.rates.map((_,i)=>validRate(saved.rates[i])?saved.rates[i]:null);
 if(Number.isFinite(saved.hours)&&saved.hours>0&&Number.isFinite(saved.hoursFor)){settings.hours=saved.hours;settings.hoursFor=saved.hoursFor;}}}catch{}
function update(patch){Object.assign(settings,patch);try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{}window.dispatchEvent(new Event('labor-changed'));}
// Everything the UI shows for a design: the estimate, the hours in use, each person's rate and the labor cost.
export function laborFor(d){const est=laborEstimate(d,settings.crew),adjusted=settings.hours!=null&&settings.hoursFor===est.hours,hours=adjusted?settings.hours:est.hours,rates=settings.rates.slice(0,est.crew);return {...est,defaultHours:est.hours,hours,adjusted,rates,...laborCost(hours,rates)};}
const hoursText=h=>`${h} hr${h===1?'':'s'}`,people=n=>`${n} ${n===1?'person':'people'}`;

// Draws the labor controls into `host`. Mounted in the Pricing guide and in the approval dialog; both copies
// share the settings above and redraw together.
export function mountLabor(host,api,{prefix='labor'}={}){
 const S=api.state,id=s=>`${prefix}-${s}`;
 host.classList.add('labor');
 host.innerHTML=`<div class="labor-grid">
<label for="${id('crew')}">People on the crew<span class="labor-stepper"><button type="button" data-step="-1" aria-label="One fewer person">−</button><input id="${id('crew')}" type="number" inputmode="numeric" min="1" max="${LABOR.maxCrew}" step="1"><button type="button" data-step="1" aria-label="One more person">+</button></span></label>
<label for="${id('hours')}">Hours on site<span class="labor-input"><input id="${id('hours')}" type="number" inputmode="decimal" min="0.5" step="0.5"><span>hrs</span></span></label>
</div><p class="labor-default"><span data-default></span> <button type="button" class="link-button" data-reset hidden>Reset to estimate</button></p>
<fieldset class="labor-rates"><legend>Hourly rates <small>Optional</small></legend><ol data-rates></ol><button type="button" class="link-button" data-same hidden>Copy the first rate to the rest</button></fieldset>
<p class="labor-cost"><span>Labor</span><strong data-cost aria-live="polite"></strong></p>
<details class="labor-tasks"><summary>How the hours add up <span>+</span></summary><ol data-tasks></ol><p class="hint">Planning allowances for experienced carpenters with the tools in the Build guide. Drying and curing time is not labor and is not counted. Adjust the hours if your crew works faster or slower.</p></details>`;
 const q=s=>host.querySelector(s),crew=q('#'+id('crew')),hours=q('#'+id('hours')),list=q('[data-rates]');
 // Commit on change (blur or Enter in a field). Enter would otherwise submit the approval form around it.
 host.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('input')){e.preventDefault();e.target.dispatchEvent(new Event('change'));}});
 crew.onchange=()=>{const n=Math.round(Number(crew.value));update({crew:Number.isFinite(n)?Math.max(1,Math.min(LABOR.maxCrew,n)):LABOR.crew});};
 for(const b of host.querySelectorAll('[data-step]'))b.onclick=()=>update({crew:Math.max(1,Math.min(LABOR.maxCrew,settings.crew+Number(b.dataset.step)))});
 hours.onchange=()=>{const v=Number(hours.value),est=laborFor(S).defaultHours,h=hours.value.trim()===''||!(v>0)?null:Math.round(v*2)/2;update(h===null||h===est?{hours:null,hoursFor:null}:{hours:h,hoursFor:est});};
 q('[data-reset]').onclick=()=>update({hours:null,hoursFor:null});
 q('[data-same]').onclick=()=>{const first=settings.rates.slice(0,settings.crew).find(r=>r!=null);if(first==null)return;update({rates:settings.rates.map((r,i)=>i<settings.crew&&r==null?first:r)});};
 // One row per person. Rows are rebuilt only when the crew size changes, so tabbing between rates keeps focus.
 function rows(n){
  if(list.children.length===n)return;
  list.replaceChildren(...Array.from({length:n},(_,i)=>{const li=document.createElement('li'),label=document.createElement('label'),wrap=document.createElement('span'),input=document.createElement('input'),line=document.createElement('small');
   label.htmlFor=input.id=id(`rate-${i+1}`);label.textContent=`Person ${i+1}`;wrap.className='labor-input';input.type='number';input.inputMode='decimal';input.min='0';input.step='1';input.placeholder='—';
   input.onchange=()=>{const v=Number(input.value),rates=[...settings.rates];rates[i]=input.value.trim()===''||!(v>=0)?null:Math.round(v*100);update({rates});};
   const dollar=document.createElement('span'),per=document.createElement('span');dollar.textContent='$';per.textContent='/hr';wrap.append(dollar,input,per);li.append(label,wrap,line);return li;}));
 }
 function render(){
  const l=laborFor(S),active=document.activeElement;
  if(active!==crew)crew.value=l.crew;if(active!==hours)hours.value=l.hours;
  rows(l.crew);[...list.children].forEach((li,i)=>{const input=li.querySelector('input'),r=l.rates[i];if(active!==input)input.value=r==null?'':String(r/100);li.querySelector('small').textContent=r==null?'':money(Math.round(l.hours*r));});
  q('[data-default]').textContent=l.adjusted?`Adjusted from the ${hoursText(l.defaultHours)} estimate.`:`Estimate for ${l.crew===2?'two skilled handymen':l.crew===1?'one skilled handyman':`a crew of ${l.crew}`}: ${l.personHours} person-hours, about ${l.days} ${l.days===1?'day':'days'} at ${LABOR.hoursPerDay} hrs.`;
  q('[data-reset]').hidden=!l.adjusted;host.classList.toggle('adjusted',l.adjusted);
  q('[data-same]').hidden=!(l.unrated&&l.crewRateCents!=null);
  q('[data-cost]').textContent=l.costCents==null?'Add rates to price labor':`${money(l.costCents)} · ${hoursText(l.hours)} × ${money(l.crewRateCents)}/hr crew${l.unrated?` · ${people(l.unrated)} without a rate`:''}`;
  q('[data-tasks]').replaceChildren(...l.tasks.map(t=>{const li=document.createElement('li'),name=document.createElement('span'),hrs=document.createElement('strong'),note=document.createElement('small');name.textContent=t.name;hrs.textContent=`${t.personHours} h`;note.textContent=`${t.stage==='All'?'':`Steps ${t.stage} · `}${t.note}`;li.append(name,hrs,note);return li;}));
 }
 window.addEventListener('labor-changed',render);window.addEventListener('set-configured',render);
 render();return render;
}

// Materials and labor for the full set, for the approval gate. Materials use the Pricing guide's full-set rows
// with every inclusion on; removals made in the Pricing guide are not applied here.
export function costSummary(data,d){
 const rows=priceRows(data,{scope:'set',height:d.height,angle:d.angle,floor:d.floor,platformShape:d.platformShape,platformBack:d.platformBack,platformSide:d.platformSide,platformAngle:d.platformAngle}),m=summary(rows),labor=laborFor(d);
 return {materialsCents:m.subtotal,pending:m.pending,lines:rows.length,labor,totalCents:m.subtotal+(labor.costCents??0)};
}

export function installLabor(api){
 const pricing=document.querySelector('#pricing-controls'),anchor=pricing?.querySelector('#price-review');if(!anchor)return;
 const card=document.createElement('section');card.id='labor-estimate';card.setAttribute('aria-labelledby','labor-title');
 card.innerHTML=`<div class="group-head"><h3 id="labor-title">Labor</h3><span>Full set</span></div><div id="labor-body"></div><dl id="price-estimate" aria-live="polite"></dl>`;
 anchor.after(card);mountLabor(card.querySelector('#labor-body'),api,{prefix:'labor'});
 // Materials from the Pricing guide as it stands (removals and added items included) plus labor.
 let materials=null;const out=card.querySelector('#price-estimate');
 function estimate(){
  card.classList.toggle('has-estimate',materials?.scope==='set');
  if(!materials){out.replaceChildren();return;}
  if(materials.scope!=='set'){const p=document.createElement('p');p.className='hint';p.textContent='Labor is estimated for the full set. Choose Full set to add it to the estimate.';out.replaceChildren(p);return;}
  const l=laborFor(api.state),pending=[materials.pending?`${materials.pending} material items still unpriced`:'',l.costCents==null?'labor not priced':l.unrated?`${l.unrated} ${l.unrated===1?'person':'people'} without a rate`:'','before tax & delivery'].filter(Boolean).join(' · ');
  const row=(k,note,v,cls)=>{const div=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');if(cls)div.className=cls;dt.textContent=k;if(note){const small=document.createElement('small');small.textContent=note;dt.append(small);}dd.textContent=v;div.append(dt,dd);return div;};
  out.replaceChildren(row('Materials','Full set, as listed below',money(materials.materialsCents)),row('Labor',`${l.hours} hrs · crew of ${l.crew}`,l.costCents==null?'No rates set':money(l.costCents)),row('Total estimate',pending.replace(/^./,x=>x.toUpperCase()),money(materials.materialsCents+(l.costCents??0)),'estimate-total'));
 }
 window.addEventListener('pricing-reviewed',e=>{materials=e.detail;estimate();});window.addEventListener('labor-changed',estimate);window.addEventListener('set-configured',estimate);
 api.labor=()=>laborFor(api.state);api.setLabor=patch=>update(patch);
}
