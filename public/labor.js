// Labor estimate: planning person-hours for a skilled crew, worked out from the same design state the
// guides use, so leaving out the platform or floor removes its hours and 10′ walls add a little to every
// panel task. These are planning allowances for experienced carpenters with the tools in the Build guide,
// not a quote. Glue, compound and paint drying time is calendar time, not labor, and is not counted.
// The pure functions (laborTasks, laborEstimate, crewFactor, laborCost) take no DOM, so tests use them directly.
import {platformPlan} from './platform.js';
import {floorArea,priceRows,summary,money,materialTax} from './pricing-calc.js';

export const LABOR={crew:2,maxCrew:12,hoursPerDay:8,panels:8,seams:5,corners:2};
// Person-hours to build one panel, by stage of the Build guide. The 10′ panel adds the wide backer, the
// 2′ skin cap, longer jacks and a two-person lift.
const PANEL={
 96:{cut:.75,frame:.75,skin:.5,jacks:1.25,attach:.6,shelf:.4},
 120:{cut:.9,frame:1,skin:.75,jacks:1.5,attach:.75,shelf:.45},
};
const r1=v=>Math.round(v*10)/10;

// Each task: {id, stage, name, personHours, note}. Steps are the Build guide stages the task covers.
export function laborTasks(d){
 const h=d.height===120?120:96,p=PANEL[h],n=LABOR.panels,tall=h===120,tasks=[];
 const add=(id,stage,name,personHours,note)=>tasks.push({id,stage,name,personHours:r1(personHours),note});
 const wallArea=n*4*h/12,floorType=d.floor==='platform'?'none':d.floor,platformShape=d.platformShape??(d.floor==='platform'?'angled':'none');
 add('setup','All','Shop setup, unloading and cleanup',2+(floorType!=='none'?1:0)+(platformShape!=='none'?1:0),'Unloading, saw and bench setup, daily cleanup; shopping is listed separately (2-hour former pickup allowance removed)');
 add('cutParts','0',`Cut and label the parts · ${n} panels`,p.cut*n,`${p.cut} h per panel`);
 add('frames','1–9','Assemble, glue and screw the frames',p.frame*n,`${p.frame} h per panel${tall?' · includes the wide skin-joint backer':''}`);
 add('skins','10–12',`Skin and staple${tall?' · plus the 2′ cap':''}`,p.skin*n,`${p.skin} h per panel`);
 add('jacks','13–16','Build the jacks · 16 total',p.jacks*n,`${p.jacks} h per pair: layout, scribed diagonals, gussets`);
 // Keep this legacy task ID so saved labor-hour overrides still refer to stage 17.
 add('boltJacks','17','Screw the jacks to the flats',p.attach*n,`${p.attach} h per panel: clamp, pilot-drill and drive 12 wood screws${tall?' · taller lift':''}. Allowance retained pending a timed prototype.`);
 add('shelves','18–20','Crossbars, shelf and ballast',p.shelf*n,`${p.shelf} h per panel`);
 add('assemble','21–22','Join the seams and set the wing angles',LABOR.seams*(tall?.5:.4)+LABOR.corners*(tall?1.25:1),`${LABOR.seams} straight seams and ${LABOR.corners} corners, braced while setting the angle`);
 add('wallFinish','28',`Dress, prime and paint the walls · ${wallArea} sq ft`,(tall?2:1.5)+wallArea/150+wallArea*2/200,'Seams and corners, one primer coat, two finish coats');
 if(floorType!=='none'){const area=floorArea(d.angle);
  if(floorType==='wood')add('floor','23–27',`Lay the oak laminate floor · ${area.toFixed(0)} sq ft`,1+area*.06+1.5,'Footprint, underlay, click-lock rows at about 17 sq ft per person-hour, expansion-gap check and cleanup');
  else{const sheets=2*Math.ceil(area*1.1/32);add('floor','23–27, 42',`Build and paint the double-layer plywood floor · ${area.toFixed(0)} sq ft`,1+sheets*.5+2+area/60+area*3/200,`Footprint, ${sheets} sheets in two bonded layers, cement skim, primer, two paint coats; planning labor, excludes cure time and future touch-ups`);}
 }
 if(platformShape!=='none'){const pl=platformPlan(d.angle,d.platformBack??12,d.platformSide??12,platformShape==='square'?90:Math.max(d.angle,d.platformAngle??d.angle)),c=pl.counts,ft=v=>v/12;
  add('platformFrame','30–31',`Cut and frame the platform · ${c.modules} modules`,.5+pl.lumberLengths.length*.06+c.modules,`${pl.lumberLengths.length} cuts, ${c.modules} module frames`);
  add('platformLegs','32–33','Legs, sills, then set and join the modules',c.legs*.15+c.sills*.1+c.modules*.35,`${c.legs} legs, ${c.sills} sills`);
  add('platformDeck','34–35','Deck and fascia',pl.deckSheets*.6+pl.deckScrews*.005+ft(pl.fasciaLength)*.12,`${pl.decks.length} deck pieces from ${pl.deckSheets} sheets, ${ft(pl.fasciaLength).toFixed(0)} ft of fascia`);
  add('platformFinish','36–37',`Tape, skim, prime and paint the platform · ${pl.finishArea.toFixed(0)} sq ft`,ft(pl.tapeLength+pl.beadLength)*.04+pl.finishArea*.03+pl.finishArea*3/120,'Deck cement skim and scenic fascia finishing, primer, two paint coats; excludes curing and future touch-ups');
 }
 add('shoppingDone','Shopping','Wall panels and jacks · shopping completed',3.5,'Jeff reported 3.5 hours for one shopper; included in project estimate, not automatically entered as paid time');
 add('shoppingRemaining','Shopping','Remaining supplies · shopping allowance',5,'One shopper: 3 hours bulk floor/platform pickup + 2 hours finish supplies and follow-up pickups');
 return tasks;
}
// How many people's worth of work a crew gets done. One person is slowed by the two-person lifts (raising
// flats, attaching jacks, setting wings); past two, each extra person adds less because tasks share tools and space.
export function crewFactor(crew){const n=Math.max(1,Math.min(LABOR.maxCrew,Math.round(crew)||1));return n===1?.85:n<=2?n:2+(n-2)*.75;}
// Hours on site for the whole crew, rounded up to the half hour.
export function laborEstimate(d,crew=LABOR.crew){
 const tasks=laborTasks(d),personHours=r1(tasks.reduce((s,t)=>s+t.personHours,0)),shoppingHours=tasks.filter(t=>t.stage==='Shopping').reduce((n,t)=>n+t.personHours,0),hours=Math.ceil((personHours-shoppingHours)/crewFactor(crew)*2)/2;
 return {tasks,personHours,shoppingHours,crew:Math.max(1,Math.min(LABOR.maxCrew,Math.round(crew)||1)),hours,days:Math.ceil(hours/LABOR.hoursPerDay*2)/2};
}
// Each person has their own rate, per hour in cents, or null when it has not been set. Labor is priced from
// the people who have a rate; with no rates at all it is not priced.
export function laborCost(hours,rates){const set=rates.filter(r=>r!=null);return {costCents:set.length?Math.round(hours*set.reduce((s,r)=>s+r,0)):null,crewRateCents:set.length?set.reduce((s,r)=>s+r,0):null,unrated:rates.length-set.length};}

// Labor uses the shared crew from Project burn-down: how many active people work on site and each one's hourly rate,
// so the estimate and the recorded time use the same numbers. Rates are private: while burn-down is locked the
// default crew of two estimates the hours and labor is not priced.
let crewMembers=null;
export function setLaborCrew(crew){crewMembers=Array.isArray(crew)?crew.filter(c=>!c.archived).map(c=>({name:c.name,rateCents:c.rateCents})).slice(0,LABOR.maxCrew):null;}
// Everything the UI shows for a design: the estimate, each person's rate and the labor cost. Shopping is one person.
export function laborFor(d){const crew=crewMembers?.length?crewMembers:null,est=laborEstimate(d,crew?crew.length:LABOR.crew),rates=crew?crew.map(c=>c.rateCents).slice(0,est.crew):Array(est.crew).fill(null),base=laborCost(est.hours,rates),shoppingRateCents=rates[0]??null,shoppingCents=shoppingRateCents==null?null:Math.round(est.shoppingHours*shoppingRateCents);
 return {...est,defaultHours:est.hours,adjusted:false,rates,people:crew?crew.map(c=>c.name):null,...base,shoppingRateCents,shoppingCents,costCents:base.costCents===null&&shoppingCents===null?null:(base.costCents??0)+(shoppingCents??0)};}
const hoursText=h=>`${Math.round(h*10)/10} hr${h===1?'':'s'}`;
export function laborCrewLine(l){return l.people?l.people.map((name,i)=>`${name} ${l.rates[i]==null?'(no rate)':money(l.rates[i])+'/hr'}`).join(' · '):'Unlock Project burn-down to price labor with your crew';}
export function laborHoursLine(l){return `${hoursText(l.hours)} on site · crew of ${l.crew} · ${hoursText(l.shoppingHours)} shopping`;}
export function laborTaskList(l){return l.tasks.map(t=>{const li=document.createElement('li'),name=document.createElement('span'),hrs=document.createElement('strong');name.textContent=t.name;hrs.textContent=`${t.personHours} h`;li.append(name,hrs);return li;});}

// Read-only labor summary for the approval dialog: the shared crew, the hours and how they add up.
export function mountLabor(host,api){
 host.classList.add('labor');
 host.innerHTML=`<p class="labor-crew" data-crew></p><p class="labor-hours" data-hours></p><details class="labor-tasks"><summary>How the hours add up <span>+</span></summary><ol data-tasks></ol></details>`;
 const q=s=>host.querySelector(s);
 function render(){const l=laborFor(api.state);q('[data-crew]').textContent=laborCrewLine(l);q('[data-hours]').textContent=laborHoursLine(l);q('[data-tasks]').replaceChildren(...laborTaskList(l));}
 window.addEventListener('labor-changed',render);window.addEventListener('set-configured',render);
 render();return render;
}

// Materials and labor for the full set, for the approval gate.
export function costSummary(data,d){
 const rows=priceRows(data,{scope:'set',height:d.height,angle:d.angle,floor:d.floor,platformShape:d.platformShape,platformBack:d.platformBack,platformSide:d.platformSide,platformAngle:d.platformAngle}),m=summary(rows),labor=laborFor(d);
 return {taxCents:materialTax(rows),materialsCents:m.subtotal,pending:m.pending,lines:rows.length,labor,totalCents:m.subtotal+materialTax(rows)+(labor.costCents??0)};
}

export function installLabor(api){
 window.addEventListener('project-finance-changed',e=>{setLaborCrew(e.detail?.crew??null);window.dispatchEvent(new Event('labor-changed'));});
 api.labor=()=>laborFor(api.state);
 // Crew and rates are shared records now, so approvals no longer carry per-browser labor settings to restore.
 api.captureLabor=()=>null;api.restoreLabor=()=>{};
}
