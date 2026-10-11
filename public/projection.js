// Cost projection: what has actually been spent, plus the estimate for what is still to come.
// Materials: receipts (expenses) are linked to shopping-list rows through their line items. A linked row stops
// counting toward "still to buy"; every expense counts in full toward "spent", so an expense with no line
// items is flagged, because its materials are still counted as to-buy as well.
// Labor: each time entry names the labor task (stage of work) it went to. The hours still to come for a task
// are its estimate scaled by how much of that work the Project tracker says is left.
// Pure functions, no DOM: the Pricing guide, Project burn-down and tests all use them directly.
import {materialTax} from './pricing-calc.js';
import {projectGuideStagePercent,projectGuideGroups,projectProgress,projectShiftCost} from './project-model.js';
import {laborTasks} from './labor.js';

// Shopping-list groups bought on the wall-panel trip; everything else is the "remaining supplies" shopping.
export const WALL_GROUPS=['panel','supports'];
export const GROUP_LABELS={panel:'Wall panels',supports:'Jacks and shelf',ballast:'Ballast',finish:'Wall finish',connections:'Connections',floor:'Floor',platform:'Platform',custom:'Added costs'};

// status: 'remaining' (nothing linked), 'partial' (some bought, more needed) or 'bought'.
export function materialStatus(row,items){
 const links=items.filter(i=>i.materialId===row.id),bought=links.reduce((n,i)=>n+(i.quantity??0),0);
 const status=!links.length?'remaining':links.some(i=>i.complete)||row.purchaseQuantity!==null&&bought>=row.purchaseQuantity?'bought':'partial';
 const remainingQuantity=status==='bought'?0:row.purchaseQuantity===null?null:Math.max(0,row.purchaseQuantity-bought);
 const remainingCents=status==='bought'?0:status==='remaining'?row.subtotalCents:row.unitPriceCents===null||remainingQuantity===null?null:Math.round(remainingQuantity*row.unitPriceCents);
 const itemized=links.filter(i=>i.amountCents!==null);
 return {status,links,boughtQuantity:links.some(i=>i.quantity!==null)?bought:null,remainingQuantity,remainingCents,
  actualCents:itemized.length?itemized.reduce((n,i)=>n+i.amountCents,0):null,itemized:links.length>0&&itemized.length===links.length,substitute:links.some(i=>i.substitute)};
}

export function projectMaterials(rows,expenses=[]){
 const items=expenses.flatMap(e=>(e.items||[]).map(i=>({...i,expenseId:e.id,vendor:e.vendor,date:e.date})));
 const plan=rows.map(row=>({row,...materialStatus(row,items)})),ids=new Set(rows.map(r=>r.id));
 const remainingRows=plan.filter(p=>p.status!=='bought');
 const spentCents=expenses.reduce((n,e)=>n+e.amountCents,0),remainingCents=remainingRows.reduce((n,p)=>n+(p.remainingCents??0),0);
 const remainingTaxCents=materialTax(remainingRows.map(p=>({custom:p.row.custom,subtotalCents:p.remainingCents})));
 // What the shopping list said the purchased part would cost, so actual spending can be compared with it.
 const covered=plan.filter(p=>p.status!=='remaining'&&p.row.subtotalCents!==null&&p.remainingCents!==null).map(p=>({custom:p.row.custom,subtotalCents:p.row.subtotalCents-p.remainingCents}));
 const coveredEstimateCents=covered.reduce((n,r)=>n+r.subtotalCents,0)+materialTax(covered);
 const estimateCents=rows.reduce((n,r)=>n+(r.subtotalCents??0),0)+materialTax(rows);
 return {plan,spentCents,remainingCents,remainingTaxCents,estimateCents,coveredEstimateCents,projectedCents:spentCents+remainingCents+remainingTaxCents,
  pending:remainingRows.filter(p=>p.remainingCents===null).length,
  counts:{bought:plan.filter(p=>p.status==='bought').length,partial:plan.filter(p=>p.status==='partial').length,remaining:plan.filter(p=>p.status==='remaining').length},
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
 const stages=laborStageNumbers(task.stage);
 return stages.length?Math.round(stages.reduce((n,s)=>n+projectGuideStagePercent(tracking,s,design),0)/stages.length):0;
}
// Share of the remaining-supplies shopping list already bought (partial rows count half).
export function supplyProgress(materials){
 const rows=materials.plan.filter(p=>!WALL_GROUPS.includes(p.row.group));
 return rows.length?Math.round(rows.reduce((n,p)=>n+(p.status==='bought'?1:p.status==='partial'?.5:0),0)/rows.length*100):100;
}

// labor: the Pricing guide's labor settings for this design (laborFor()). Hours are person-hours; costs use the
// Pricing guide crew rates for work still to come and each time entry's own captured rate for work done, so
// with nothing done or logged the projection equals the estimate.
// Which labor tasks a tracker milestone's work belongs to: shares by the Build guide stages they have in common.
export function milestoneTasks(design,tasks){const out={};for(const [id,stages]of Object.entries(projectGuideGroups(design))){const shares={};for(const t of tasks){const own=laborStageNumbers(t.stage),n=stages.filter(x=>own.includes(x)).length;if(n)shares[t.id]=n;}const total=Object.values(shares).reduce((a,b)=>a+b,0);if(total)out[id]=Object.fromEntries(Object.entries(shares).map(([k,v])=>[k,v/total]));}return out;}
// The stages a time entry worked on: a stage chosen on the entry wins; otherwise the work completed during its hours
// (tracker progress history), weighted by that work's estimated hours. null when nothing was completed in the window.
export function shiftStages(shift,{log=[],design,tasks,weights,now=Date.now()}){
 if(shift.taskId&&tasks.some(t=>t.id===shift.taskId))return {auto:false,shares:{[shift.taskId]:1}};
 const end=shift.end??now,map=milestoneTasks(design,tasks),hours={};
 for(const e of log)if(e.at>=shift.start&&e.at<=end&&e.to>e.from&&map[e.step]){const h=(weights[e.step]??1)*(e.to-e.from)/100;for(const [task,share]of Object.entries(map[e.step]))hours[task]=(hours[task]||0)+h*share;}
 const total=Object.values(hours).reduce((a,b)=>a+b,0);return total?{auto:true,shares:Object.fromEntries(Object.entries(hours).map(([k,v])=>[k,v/total]))}:null;
}
export function projectLabor(labor,{design,tracking,shifts=[],supply=0,now=Date.now()}){
 const onSite=labor.tasks.filter(t=>t.stage!=='Shopping'),onSiteHours=onSite.reduce((n,t)=>n+t.personHours,0);
 const scale=labor.defaultHours>0?labor.hours/labor.defaultHours:1;
 const perPersonHour=labor.crewRateCents==null||!onSiteHours?null:labor.hours*labor.crewRateCents/(onSiteHours*scale);
 const shiftHours=s=>projectShiftCost(s,now).hours,weights=progressWeights(design),stagesOf=new Map(shifts.map(s=>[s.id,shiftStages(s,{log:tracking?.progressLog||[],design,tasks:labor.tasks,weights,now})])),share=(s,id)=>stagesOf.get(s.id)?.shares[id]??0;
 const tasks=labor.tasks.map(task=>{
  const shopping=task.stage==='Shopping',estimateExact=task.personHours*(shopping?1:scale),estimate=Math.round(estimateExact*10)/10,progress=laborTaskProgress(task,{design,tracking,supplyProgress:supply});
  const loggedHours=shifts.reduce((n,s)=>n+shiftHours(s)*share(s,task.id),0);
  // Actual spending comes only from recorded shifts. Shopping already included in logged time must not be synthesized again.
  const reported=false,actual=loggedHours;
  const remaining=estimateExact*(1-progress/100),rate=shopping?labor.shoppingRateCents:perPersonHour;
  return {id:task.id,name:task.name,stage:task.stage,estimate,progress,remainingExact:remaining,actual:Math.round(actual*100)/100,reported,remaining:Math.round(remaining*100)/100,projected:Math.round((actual+remaining)*100)/100,
   actualCents:Math.round(shifts.reduce((n,s)=>n+projectShiftCost(s,now).cents*share(s,task.id),0)),
   remainingCents:remaining<=0?0:rate==null?null:Math.round(remaining*rate)};
 });
const unassigned=shifts.filter(s=>!stagesOf.get(s.id)),unassignedHours=unassigned.reduce((n,s)=>n+shiftHours(s),0);
 const sum=key=>tasks.reduce((n,t)=>n+(t[key]??0),0),actualCents=shifts.reduce((n,s)=>n+projectShiftCost(s,now).cents,0); // every entry once, however it splits across stages
 // Tasks without a rate are left out of the cost, as in the estimate, and counted in unpricedTasks. Summing
 // unrounded hours before pricing keeps a fresh projection equal to the estimate to the cent.
 const priced=(shop,rate)=>rate==null?0:Math.round(tasks.filter(t=>(t.stage==='Shopping')===shop).reduce((n,t)=>n+t.remainingExact,0)*rate);
 const remainingCents=priced(false,perPersonHour)+priced(true,labor.shoppingRateCents);
 const actualHours=sum('actual')+unassignedHours,remainingHours=sum('remainingExact');
 return {tasks,shiftStages:Object.fromEntries(stagesOf),unassignedHours:Math.round(unassignedHours*100)/100,unassignedCount:unassigned.length,
  estimateHours:Math.round(sum('estimate')*10)/10,actualHours:Math.round(actualHours*100)/100,remainingHours:Math.round(remainingHours*100)/100,projectedHours:Math.round((actualHours+remainingHours)*100)/100,
  estimateCents:labor.costCents,actualCents,remainingCents,unpricedTasks:tasks.filter(t=>t.remainingCents===null).length,projectedCents:actualCents+remainingCents};
}

// Everything together. rows: the full-set shopping list as priced (removals and added costs applied).
// finance.budgetCents is the quote locked in for the client; when set, the projection is measured against it
// instead of the live Pricing guide estimate, which keeps moving as prices and the design change.
export function projectCost({rows,finance,tracking,design,labor,now=Date.now()}){
 const materials=projectMaterials(rows,finance?.expenses||[]);
 const work=projectLabor(labor,{design,tracking,shifts:finance?.shifts||[],supply:supplyProgress(materials),now});
 const estimateCents=materials.estimateCents+(labor.costCents??0),spentCents=materials.spentCents+work.actualCents,toGoCents=materials.remainingCents+materials.remainingTaxCents+work.remainingCents;
 const quoteCents=finance?.budgetCents??null,baselineCents=quoteCents??estimateCents;
 return {materials,labor:work,estimateCents,quoteCents,baselineCents,spentCents,toGoCents,projectedCents:spentCents+toGoCents,varianceCents:spentCents+toGoCents-baselineCents,estimateVarianceCents:spentCents+toGoCents-estimateCents};
}

// How long each tracker milestone takes, in person-hours: the hours actually logged for work already done, plus the
// estimate for what is left. Done work with no time logged against its stage takes its share of the unassigned
// logged hours (or its estimate when nothing is logged). Each labor task's hours are spread over its Build guide
// stages; a stage shared by several milestones splits them. Feeds projectProgress()/projectStagePercent().
// Without tracking and shifts (burn-down locked), it falls back to the estimate alone.
export function progressWeights(design,{tracking=null,shifts=null,now=Date.now()}={}){
 const tasks=laborTasks(design).filter(t=>!['All','Shopping'].includes(t.stage)),hoursFor={};
 if(tracking&&shifts){
  const result=projectLabor({tasks,hours:1,defaultHours:1,crewRateCents:null,shoppingRateCents:null,costCents:null},{design,tracking,shifts,now}),work=result.tasks;
  const unlogged=work.filter(t=>!t.actual),guessed=unlogged.reduce((n,t)=>n+t.estimate*t.progress/100,0),loose=result.unassignedHours,scale=guessed&&loose?loose/guessed:1;
  for(const t of work)hoursFor[t.id]=(t.actual||t.estimate*t.progress/100*scale)+t.remainingExact;
 }else for(const t of tasks)hoursFor[t.id]=t.personHours;
 const groups=projectGuideGroups(design),hours={},owners={},weights={};
 for(const t of tasks){const stages=laborStageNumbers(t.stage);for(const n of stages)hours[n]=(hours[n]||0)+hoursFor[t.id]/stages.length;}
 for(const [id,stages]of Object.entries(groups))for(const n of stages)(owners[n]??=[]).push(id);
 for(const [n,h]of Object.entries(hours))for(const id of owners[n]||[])weights[id]=(weights[id]||0)+h/owners[n].length;
 return weights;
}
