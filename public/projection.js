// Cost projection: what has actually been spent, plus the estimate for what is still to come.
// Materials: receipts (expenses) are linked to shopping-list rows through their line items. A linked row stops
// counting toward "still to buy"; every expense counts in full toward "spent", so an expense with no line
// items is flagged, because its materials are still counted as to-buy as well.
// Labor: each time entry names the labor task (stage of work) it went to. The hours still to come for a task
// are its estimate scaled by how much of that work the Project tracker says is left.
// Pure functions, no DOM: the Pricing breakdown, Cost projection and tests all use them directly.
import {materialTax} from './pricing-calc.js';
import {projectGuideStagePercent,projectGuideGroups,projectCountUnits,projectGuideKey,projectProgress,projectShiftCost,projectCycloramaMilestones,projectCycloramaComponents} from './project-model.js';
import {laborTasks} from './labor.js';

// Shopping-list groups bought on the wall-panel trip; everything else is the "remaining supplies" shopping.
export const WALL_GROUPS=['panel','supports'];
export const GROUP_LABELS={panel:'Wall panels',supports:'Jacks and shelf',ballast:'Ballast',finish:'Wall finish',connections:'Connections',floor:'Floor',floorFinish:'Floor finish',platform:'Platform',platformFinish:'Platform finish',cyclorama:'Seamless corners and perimeter',cycloramaFinish:'Cyclorama finish',custom:'Added costs'};

// status: 'remaining' (nothing linked), 'partial' (some bought, more needed), 'bought', or 'notNeeded' (marked in
// Cost projection as not being bought: it stays on the list but adds nothing to still to buy).
export function materialStatus(row,items,notNeeded=false){
 const links=items.filter(i=>i.materialId===row.id),bought=links.reduce((n,i)=>n+(i.quantity??0),0);
 const linked=!links.length?'remaining':links.some(i=>i.complete)||row.purchaseQuantity!==null&&bought>=row.purchaseQuantity?'bought':'partial';
 const status=notNeeded&&linked!=='bought'?'notNeeded':linked;
 const remainingQuantity=status==='bought'||status==='notNeeded'?0:row.purchaseQuantity===null?null:Math.max(0,row.purchaseQuantity-bought);
 const remainingCents=status==='bought'||status==='notNeeded'?0:status==='remaining'?row.subtotalCents:row.unitPriceCents===null||remainingQuantity===null?null:Math.round(remainingQuantity*row.unitPriceCents);
 const itemized=links.filter(i=>i.amountCents!==null);
 return {status,links,boughtQuantity:links.some(i=>i.quantity!==null)?bought:null,remainingQuantity,remainingCents,
  actualCents:itemized.length?itemized.reduce((n,i)=>n+i.amountCents,0):null,itemized:links.length>0&&itemized.length===links.length,substitute:links.some(i=>i.substitute)};
}

// notNeeded: shopping-list row ids marked as not being bought (finance.notNeeded).
// Florida 6% plus Manatee County 1%: the tax refunded with a returned item.
export const RETURN_TAX=.07;
export function projectMaterials(rows,expenses=[],notNeeded=[]){
 const items=expenses.flatMap(e=>(e.items||[]).map(i=>({...i,expenseId:e.id,vendor:e.vendor,date:e.date}))),skip=new Set(notNeeded.map(n=>n.materialId));
 const plan=rows.map(row=>({row,...materialStatus(row,items,skip.has(row.id))})),ids=new Set(rows.map(r=>r.id));
 const remainingRows=plan.filter(p=>p.status==='remaining'||p.status==='partial');
 const spentCents=expenses.reduce((n,e)=>n+e.amountCents,0),remainingCents=remainingRows.reduce((n,p)=>n+(p.remainingCents??0),0);
 const remainingTaxCents=materialTax(remainingRows.map(p=>({...p.row,purchaseQuantity:p.remainingQuantity,subtotalCents:p.remainingCents})));
 // What the shopping list said the purchased part would cost, so actual spending can be compared with it.
 const covered=plan.filter(p=>(p.status==='bought'||p.status==='partial')&&p.row.subtotalCents!==null&&p.remainingCents!==null).map(p=>({...p.row,purchaseQuantity:p.row.purchaseQuantity-p.remainingQuantity,subtotalCents:p.row.subtotalCents-p.remainingCents}));
 const coveredEstimateCents=covered.reduce((n,r)=>n+r.subtotalCents,0)+materialTax(covered);
 const estimateCents=rows.reduce((n,r)=>n+(r.subtotalCents??0),0)+materialTax(rows);
 // To return: receipt lines marked returnPlanned. The credit expected back is the line amount plus 7% sales tax. A refund
 // line that names it (returnOf) means it is back: the refund is already counted in spent, so its credit stops here.
 const back=new Set(items.filter(i=>i.returnOf).map(i=>i.returnOf));
 const returns=items.filter(i=>i.returnPlanned).map(i=>({...i,returned:back.has(i.id),creditCents:i.amountCents==null?null:i.amountCents+Math.round(i.amountCents*RETURN_TAX)}));
 const returnCreditCents=returns.filter(r=>!r.returned).reduce((n,r)=>n+(r.creditCents??0),0);
 return {plan,spentCents,remainingCents,remainingTaxCents,estimateCents,coveredEstimateCents,returns,returnCreditCents,projectedCents:spentCents+remainingCents+remainingTaxCents-returnCreditCents,
  pending:remainingRows.filter(p=>p.remainingCents===null).length,
  counts:{bought:plan.filter(p=>p.status==='bought').length,partial:plan.filter(p=>p.status==='partial').length,remaining:plan.filter(p=>p.status==='remaining').length,notNeeded:plan.filter(p=>p.status==='notNeeded').length},
  unlinked:expenses.filter(e=>!(e.items||[]).length),
  // Line items whose shopping-list row is not in the current design or pricing configuration. Still spent.
  outsidePlan:items.filter(i=>i.materialId!==null&&!ids.has(i.materialId)),
  extras:items.filter(i=>i.materialId===null)};
}

// Labor task stages are Build guide stage ranges such as "1–9" or "23–27, 42".
export function laborStageNumbers(stage){
 if(!/\d/.test(stage))return [];
 return String(stage).split(',').flatMap(part=>{const [a,b]=part.trim().split(/[–-]/).map(Number);return b===undefined?[a]:Array.from({length:b-a+1},(_,i)=>a+i);});
}
// How far along a labor task is, 0–100, from the shared Project tracker.
export function laborTaskProgress(task,{design,tracking,supplyProgress=0}){
 if(task.id==='shoppingDone')return 100;
 if(task.id==='shoppingRemaining')return supplyProgress;
 if(!tracking)return 0;
 if(task.stage==='All')return projectProgress(tracking,progressWeights(design)).percent;
 // Stages this design does not build (the left corner's upper skin on a right-corner set) are not work left.
 const groups=Object.values(projectGuideGroups(design)).flat(),units=projectCountUnits(design).flatMap(u=>u.stages);
 const stages=laborStageNumbers(task.stage).filter(s=>groups.includes(s)||units.includes(s)||tracking?.guideChecks?.[projectGuideKey(s,design)]!==undefined);
 if(!stages.length)return 0;
 // Tasks that say where their hours fall (stageHours) weight each stage by them; others count stages equally.
 const w=s=>task.stageHours?.[s]??(task.stageHours?0:1),total=stages.reduce((n,s)=>n+w(s),0);
 return total?Math.round(stages.reduce((n,s)=>n+projectGuideStagePercent(tracking,s,design)*w(s),0)/total):0;
}
// Share of the remaining-supplies shopping list already bought (partial rows count half; not-needed rows are done).
export function supplyProgress(materials){
 // Rows the plan covers from supplies already bought (nothing to purchase) are not part of any trip.
 const rows=materials.plan.filter(p=>!WALL_GROUPS.includes(p.row.group)&&p.row.purchaseQuantity!==0);
 return rows.length?Math.round(rows.reduce((n,p)=>n+(p.status==='bought'||p.status==='notNeeded'?1:p.status==='partial'?.5:0),0)/rows.length*100):100;
}

// labor: the Pricing guide's labor settings for this design (laborFor()). Hours are person-hours; costs use the
// Pricing guide crew rates for work still to come and each time entry's own captured rate for work done, so
// with nothing done or logged the projection equals the estimate.
// Which labor tasks a tracker milestone's work belongs to: shares by the Build guide stages they have in common.
export function milestoneTasks(design,tasks){const out={};for(const [id,stages]of Object.entries(projectGuideGroups(design))){const shares={};for(const t of tasks){const own=laborStageNumbers(t.stage),n=stages.filter(x=>own.includes(x)).length;if(n)shares[t.id]=n;}const total=Object.values(shares).reduce((a,b)=>a+b,0);if(total)out[id]=Object.fromEntries(Object.entries(shares).map(([k,v])=>[k,v/total]));}for(const c of projectCycloramaComponents())if(out[c.id]&&!out[c.legacy])out[c.legacy]={...out[c.id]};return out;}
// The stages a time entry worked on: a stage chosen on the entry wins; otherwise the work completed during its hours
// (tracker progress history), weighted by that work's estimated hours. null when nothing was completed in the window.
// Paid project time that is not part of any build stage (rearranging the shop or warehouse, hauling, site prep).
// It counts as money spent but stays out of the build stages, so it cannot make build work look slower than it was.
export const NON_BUILD_ACTIVITIES=[{id:'shopWork',name:'Shop and warehouse work · not build'}];
export const isNonBuild=id=>NON_BUILD_ACTIVITIES.some(a=>a.id===id);
export function shiftStages(shift,{log=[],design,tasks,weights,now=Date.now()}){
 if(shift.taskId&&tasks.some(t=>t.id===shift.taskId))return {auto:false,shares:{[shift.taskId]:1}};
 if(isNonBuild(shift.taskId))return {auto:false,shares:{},nonBuild:true};
 const end=shift.end??now,map=milestoneTasks(design,tasks),hours={};
 for(const e of log)if(e.at>=shift.start&&e.at<=end&&e.to>e.from&&map[e.step]){const legacy=projectCycloramaComponents().filter(c=>c.legacy===e.step),weight=legacy.length?legacy.reduce((n,c)=>n+(weights[c.id]||0),0):(weights[e.step]??1),h=weight*(e.to-e.from)/100;for(const [task,share]of Object.entries(map[e.step]))hours[task]=(hours[task]||0)+h*share;}
 const total=Object.values(hours).reduce((a,b)=>a+b,0);return total?{auto:true,shares:Object.fromEntries(Object.entries(hours).map(([k,v])=>[k,v/total]))}:null;
}
// Logged hours needed before the projection uses the crew's own history (pace and who works when).
export const HISTORY_MIN_HOURS=8;
export const OBSERVED_RATE_MIN_HOURS=HISTORY_MIN_HOURS;
// Effective workers from participation shares: each extra person past two adds less, as in the estimate (crewFactor).
export const effectiveCrew=n=>n<=2?n:2+(n-2)*.75;
// How the active crew splits the work still to come, from their logged build time: the person who has logged the most
// works every on-site hour (share 1) and everyone else in proportion. Someone with no build time yet counts as full time,
// as the estimate assumes, so adding a person shortens and cheapens the work left and removing one lengthens it.
export function crewShares(crew,buildHoursBy){const active=(crew||[]).filter(c=>!c.archived),lead=Math.max(0,...active.map(c=>buildHoursBy[c.id]||0));
 return active.map(c=>({id:c.id,name:c.name,rateCents:c.rateCents,share:lead>0&&buildHoursBy[c.id]>0?buildHoursBy[c.id]/lead:1}));}
export function projectLabor(labor,{design,tracking,shifts=[],crew=null,supply=0,now=Date.now(),usePace=true}){
 const onSite=labor.tasks.filter(t=>t.stage!=='Shopping'),onSiteHours=onSite.reduce((n,t)=>n+t.personHours,0);
 const scale=labor.defaultHours>0?labor.hours/labor.defaultHours:1;
 const perPersonHour=labor.crewRateCents==null||!onSiteHours?null:labor.hours*labor.crewRateCents/(onSiteHours*scale);
 // Serialized phases use more crew elapsed time per person-hour than parallel work. Keep that
 // cost on the phase that causes it, so completing the corners removes its scheduling premium.
 const estimateRate=task=>task.stage==='Shopping'?labor.shoppingRateCents:perPersonHour===null?null:labor.taskOnSiteHours?.[task.id]!==undefined&&task.personHours>0?labor.taskOnSiteHours[task.id]*labor.crewRateCents/task.personHours:perPersonHour;
 const shiftHours=s=>projectShiftCost(s,now).hours,weights=progressWeights(design),stagesOf=new Map(shifts.map(s=>[s.id,shiftStages(s,{log:tracking?.progressLog||[],design,tasks:labor.tasks,weights,now})])),share=(s,id)=>stagesOf.get(s.id)?.shares[id]??0;
 const shoppingIds=new Set(labor.tasks.filter(t=>t.stage==='Shopping').map(t=>t.id));
 const base=labor.tasks.map(task=>{const shopping=task.stage==='Shopping',estimateExact=task.personHours*(shopping?1:scale);
  return {task,shopping,estimateExact,progress:laborTaskProgress(task,{design,tracking,supplyProgress:supply}),actual:shifts.reduce((n,s)=>n+shiftHours(s)*share(s,task.id),0)};});
 const unassigned=shifts.filter(s=>!stagesOf.get(s.id)),unassignedHours=unassigned.reduce((n,s)=>n+shiftHours(s),0),nonBuildHours=shifts.filter(s=>stagesOf.get(s.id)?.nonBuild).reduce((n,s)=>n+shiftHours(s),0);
 // Build time only: shopping runs and not-build work say nothing about building pace or who builds.
 const buildShift=s=>!stagesOf.get(s.id)?.nonBuild&&!shoppingIds.has(s.taskId),buildHoursBy={};for(const s of shifts)if(buildShift(s))buildHoursBy[s.personId]=(buildHoursBy[s.personId]||0)+shiftHours(s)*(1-[...shoppingIds].reduce((n,id)=>n+share(s,id),0));
 // Only work that has time logged against it (plus setup, which is never logged directly) measures pace: work marked
 // done without logged time would make the crew look faster than it is.
 const buildLogged=Object.values(buildHoursBy).reduce((a,b)=>a+b,0),doneEstimate=base.filter(b=>!b.shopping&&(b.actual>0||b.task.stage==='All')).reduce((n,b)=>n+b.estimateExact*b.progress/100,0);
 // Pace: build hours logged per estimated hour of the build work done so far. It scales the build work still to come.
 const pace=usePace&&buildLogged>=HISTORY_MIN_HOURS&&doneEstimate>=HISTORY_MIN_HOURS?Math.min(2,Math.max(.5,buildLogged/doneEstimate)):null;
 const paidCents=shifts.reduce((n,s)=>n+projectShiftCost(s,now).cents,0),loggedHours=shifts.reduce((n,s)=>n+shiftHours(s),0);
 const people=Array.isArray(crew)&&loggedHours>=HISTORY_MIN_HOURS&&paidCents>0?crewShares(crew,buildHoursBy):null,workers=people?.length?effectiveCrew(people.reduce((n,p)=>n+p.share,0)):null;
 const crewRate=workers?people.reduce((n,p)=>n+p.share*p.rateCents,0)/workers:null;
 const tasks=base.map(({task,shopping,estimateExact,progress,actual})=>{
  const estimate=Math.round(estimateExact*10)/10,remaining=estimateExact*(1-progress/100)*(shopping||pace===null?1:pace),rate=shopping?labor.shoppingRateCents:crewRate??estimateRate(task);
  return {id:task.id,name:task.name,stage:task.stage,estimate,progress,remainingExact:remaining,actual:Math.round(actual*100)/100,reported:false,remaining:Math.round(remaining*100)/100,projected:Math.round((actual+remaining)*100)/100,
   actualCents:Math.round(shifts.reduce((n,s)=>n+projectShiftCost(s,now).cents*share(s,task.id),0)),
   remainingCents:remaining<=0?0:rate==null?null:Math.round(remaining*rate)};
 });
 const sum=key=>tasks.reduce((n,t)=>n+(t[key]??0),0),actualCents=paidCents; // every entry once, however it splits across stages
 // Tasks without a rate are left out of the cost, as in the estimate, and counted in unpricedTasks. Summing
 // unrounded hours before pricing keeps a fresh projection equal to the estimate to the cent.
 const priced=(shop,rate)=>rate==null?0:Math.round(tasks.filter(t=>(t.stage==='Shopping')===shop).reduce((n,t)=>n+t.remainingExact,0)*rate);
 const buildRemaining=tasks.filter(t=>t.stage!=='Shopping').reduce((n,t)=>n+t.remainingExact,0);
 const remainingCents=(crewRate!==null?Math.round(buildRemaining*crewRate):Math.round(tasks.filter(t=>t.stage!=='Shopping').reduce((n,t)=>n+t.remainingExact*(estimateRate(labor.tasks.find(x=>x.id===t.id))??0),0)))+priced(true,labor.shoppingRateCents);
 const actualHours=sum('actual')+unassignedHours+nonBuildHours,remainingHours=sum('remainingExact');
 return {tasks,nonBuildHours:Math.round(nonBuildHours*100)/100,pace:pace===null?null:Math.round(pace*1000)/1000,crew:people,effectiveWorkers:workers===null?null:Math.round(workers*100)/100,
  ratePerPersonHourCents:crewRate===null?null:Math.round(crewRate),observedRateCents:crewRate===null?null:Math.round(crewRate),remainingOnSiteHours:workers?Math.round(buildRemaining/workers*10)/10:null,
  shiftStages:Object.fromEntries(stagesOf),unassignedHours:Math.round(unassignedHours*100)/100,unassignedCount:unassigned.length,
  estimateHours:Math.round(sum('estimate')*10)/10,actualHours:Math.round(actualHours*100)/100,remainingHours:Math.round(remainingHours*100)/100,projectedHours:Math.round((actualHours+remainingHours)*100)/100,
  estimateCents:labor.costCents,actualCents,remainingCents,unpricedTasks:tasks.filter(t=>t.remainingCents===null).length,projectedCents:actualCents+remainingCents};
}

// Everything together. rows: the full-set shopping list as priced (removals and added costs applied).
// finance.budgetCents is the quote locked in for the client; when set, the projection is measured against it
// instead of the live Pricing guide estimate, which keeps moving as prices and the design change.
export function projectCost({rows,finance,tracking,design,labor,now=Date.now()}){
 const materials=projectMaterials(rows,finance?.expenses||[],finance?.notNeeded||[]);
 const work=projectLabor(labor,{design,tracking,shifts:finance?.shifts||[],crew:finance?.crew||null,supply:supplyProgress(materials),now});
 const estimateCents=materials.estimateCents+(labor.costCents??0),quoteCents=finance?.budgetCents??null;
 if(finance?.fixedPrice){
  const fixed=projectFixedPrice({fixed:finance.fixedPrice,materials,shifts:finance.shifts||[],expenses:finance.expenses||[],shoppingIds:new Set(labor.tasks.filter(t=>t.stage==='Shopping').map(t=>t.id)),now});
  const baselineCents=finance.fixedPrice.agreedTotalCents??quoteCents??estimateCents;
  return {materials,labor:fixedLabor(work,fixed),fixed,estimateCents,quoteCents,agreedCents:finance.fixedPrice.agreedTotalCents??null,baselineCents,spentCents:fixed.spentCents,toGoCents:fixed.toGoCents,projectedCents:fixed.projectedCents,varianceCents:fixed.projectedCents-baselineCents,quoteVarianceCents:quoteCents===null?null:fixed.projectedCents-quoteCents,estimateVarianceCents:fixed.projectedCents-estimateCents};
 }
 const spentCents=materials.spentCents+work.actualCents,toGoCents=materials.remainingCents+materials.remainingTaxCents-materials.returnCreditCents+work.remainingCents;
 const baselineCents=quoteCents??estimateCents;
 return {materials,labor:work,fixed:null,estimateCents,quoteCents,agreedCents:null,baselineCents,spentCents,toGoCents,projectedCents:spentCents+toGoCents,varianceCents:spentCents+toGoCents-baselineCents,quoteVarianceCents:quoteCents===null?null:spentCents+toGoCents-quoteCents,estimateVarianceCents:spentCents+toGoCents-estimateCents};
}
// The labor projection under a fixed price, so every hours-to-go figure matches the fixed-cost widget. The step estimates
// are unchanged; what is left of each is scaled by one factor so the build work still to come adds up to the hours the
// fixed labor has left (budget hours less build hours logged since the start, never below 0), priced at the fixed rate.
// Shopping has nothing to come after the start. Logged labor is what the client pays for it: entries before the start at
// their captured rates, then the fixed-rate value of the hours since, which never goes past the fixed labor.
export function fixedLabor(work,fixed){
 const build=work.tasks.filter(t=>t.stage!=='Shopping'),left=build.reduce((n,t)=>n+t.remainingExact,0),target=Math.max(0,fixed.budgetHours-fixed.loggedHours),factor=left>0?target/left:0,r2=v=>Math.round(v*100)/100;
 const tasks=work.tasks.map(t=>{const remaining=t.stage==='Shopping'?0:t.remainingExact*factor;return {...t,remainingExact:remaining,remaining:r2(remaining),projected:r2(t.actual+remaining),remainingCents:Math.round(remaining*fixed.rateCents)};});
 const actualCents=fixed.priorLaborCents+fixed.laborDoneCents,remainingCents=fixed.laborCents-fixed.laborDoneCents,remainingHours=r2(target);
 return {...work,tasks,pace:null,remainingOnSiteHours:null,ratePerPersonHourCents:fixed.rateCents,observedRateCents:fixed.rateCents,actualCents,remainingCents,remainingHours,projectedHours:r2(work.actualHours+remainingHours),projectedCents:actualCents+remainingCents,unpricedTasks:0,fixedScale:factor};
}
// The start of a YYYY-MM-DD day in local time: work logged from then on falls under the fixed price.
export function dayStart(date){const [y,m,d]=date.split('-').map(Number);return new Date(y,m-1,d).getTime();}
// Fixed price to finish (finance.fixedPrice). Everything before startDate stays time and materials: receipts dated
// before it and time entries that start before it, at their captured rates. From startDate the labor is laborCents flat,
// worked at rateCents an hour (laborCents / rateCents hours): time logged since then is priced at that rate inside the
// fixed labor, never on top of it, and shopping trips are off the clock. Materials stay at cost: receipts on or after
// startDate, plus still to buy with its tax, less the credit for planned returns.
export function projectFixedPrice({fixed,materials,shifts=[],expenses=[],shoppingIds=new Set(),now=Date.now()}){
 const start=dayStart(fixed.startDate),earlier=shifts.filter(s=>s.start<start),later=shifts.filter(s=>s.start>=start),cost=s=>projectShiftCost(s,now),r2=v=>Math.round(v*100)/100;
 const priorLaborCents=earlier.reduce((n,s)=>n+cost(s).cents,0),priorLaborHours=earlier.reduce((n,s)=>n+cost(s).hours,0);
 const priorMaterialsCents=expenses.filter(e=>e.date<fixed.startDate).reduce((n,e)=>n+e.amountCents,0),laterMaterialsCents=expenses.filter(e=>e.date>=fixed.startDate).reduce((n,e)=>n+e.amountCents,0);
 const loggedHours=later.filter(s=>!shoppingIds.has(s.taskId)).reduce((n,s)=>n+cost(s).hours,0),shoppingHours=later.filter(s=>shoppingIds.has(s.taskId)).reduce((n,s)=>n+cost(s).hours,0);
 const budgetHours=fixed.laborCents/fixed.rateCents,laborDoneCents=Math.min(fixed.laborCents,Math.round(loggedHours*fixed.rateCents));
 const toBuyCents=materials.remainingCents+materials.remainingTaxCents,returnCreditCents=materials.returnCreditCents??0,priorCents=priorLaborCents+priorMaterialsCents;
 const spentCents=priorCents+laterMaterialsCents+laborDoneCents,toGoCents=fixed.laborCents-laborDoneCents+toBuyCents-returnCreditCents;
 return {startDate:fixed.startDate,laborCents:fixed.laborCents,rateCents:fixed.rateCents,budgetHours:r2(budgetHours),loggedHours:r2(loggedHours),shoppingHours:r2(shoppingHours),hoursToFinish:r2(Math.max(0,budgetHours-loggedHours)),overHours:r2(Math.max(0,loggedHours-budgetHours)),laborDoneCents,
  priorCents,priorLaborCents,priorLaborHours:r2(priorLaborHours),priorMaterialsCents,laterMaterialsCents,toBuyCents,returnCreditCents,
  costToFinishCents:fixed.laborCents+toBuyCents-returnCreditCents,spentCents,toGoCents,projectedCents:spentCents+toGoCents};
}
// How long each tracker milestone takes, in person-hours: the hours actually logged for work already done, plus the
// estimate for what is left. Done work with no time logged against its stage takes its share of the unassigned
// logged hours (or its estimate when nothing is logged). Each labor task's hours are spread over its Build guide
// stages; a stage shared by several milestones splits them. Feeds projectProgress()/projectStagePercent().
// Without tracking and shifts (Cost projection locked), it falls back to the estimate alone.
export function progressWeights(design,{tracking=null,shifts=null,now=Date.now()}={}){
 const tasks=laborTasks(design).filter(t=>!['All','Shopping'].includes(t.stage)),hoursFor={};
 if(tracking&&shifts){
  const result=projectLabor({tasks,hours:1,defaultHours:1,crewRateCents:null,shoppingRateCents:null,costCents:null},{design,tracking,shifts,now,usePace:false}),work=result.tasks;
  const unlogged=work.filter(t=>!t.actual),guessed=unlogged.reduce((n,t)=>n+t.estimate*t.progress/100,0),loose=result.unassignedHours,scale=guessed&&loose?loose/guessed:1;
  for(const t of work)hoursFor[t.id]=(t.actual||t.estimate*t.progress/100*scale)+t.remainingExact;
 }else for(const t of tasks)hoursFor[t.id]=t.personHours;
 const groups=projectGuideGroups(design),hours={},owners={},weights=Object.fromEntries([...Object.keys(projectCycloramaMilestones()),'cyc-ribs','cyc-skin','cyc-perimeter','cyc-junctions'].map(id=>[id,0]));
 for(const t of tasks){const stages=laborStageNumbers(t.stage);for(const n of stages)hours[n]=(hours[n]||0)+hoursFor[t.id]/stages.length;}
 for(const [id,stages]of Object.entries(groups))for(const n of stages)(owners[n]??=[]).push(id);
 for(const [n,h]of Object.entries(hours))for(const id of owners[n]||[])weights[id]=(weights[id]||0)+h/owners[n].length;
 return weights;
}
