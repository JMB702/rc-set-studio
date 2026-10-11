// Shared validation and accounting. All money is integer cents; rates are captured per shift.
export function projectDefaultFinance() {
 return {budgetCents:null,expenses:[],crew:[{id:'person-1',name:'Person 1',rateCents:0,archived:false},{id:'person-2',name:'Person 2',rateCents:0,archived:false}],shifts:[]};
}
export function projectDefaultTracking() {
 const groups=[['walls','Walls',['Cut and label parts','Assemble the frames','Skin the panels','Build and attach jacks','Add shelves and ballast','Join walls and set angles','Dress, prime and paint']],['floor','Floor',['Mark the footprint','Prepare the base','Lay the flooring','Finish and trim']],['platform','Platform',['Cut and frame modules','Fit legs and join modules','Install decks and fascia','Skim, prime and paint']]];
 return projectUpgradeTracking({stages:groups.map(([id,name,steps])=>({id,name,notes:[],steps:steps.map((name,i)=>({id:`${id}-${i}`,name,percent:0,notes:[]}))}))});
}
// Promote the original wall finishing milestone without resetting customized stages or notes.
export function projectUpgradeTracking(input) {
 const wall=input.stages.find(s=>s.id==='walls'),legacy=wall?.steps.find(t=>t.id==='walls-6'&&t.name==='Dress, prime and paint');
 if(!legacy||input.stages.some(s=>s.id==='wall-finishing'))return projectSeparateFinishing(projectUpgradePlatform(input));
 const data=structuredClone(input),index=data.stages.findIndex(s=>s.id==='walls');
 data.stages[index].steps=data.stages[index].steps.filter(t=>t.id!==legacy.id);
 if(!data.stages[index].steps.length)return input;
 data.stages.splice(index+1,0,{id:'wall-finishing',name:'Dress, prime and paint',notes:structuredClone(legacy.notes),steps:['Dress seams and corners','Fill and feather joints','Sand and clean surfaces','Prime the walls','Paint the walls'].map((name,i)=>({id:`wall-finishing-${i}`,name,percent:legacy.percent,notes:[]}))});
 return projectSeparateFinishing(projectUpgradePlatform(data));
}
// Reorganize existing milestones without adding work or changing the overall denominator.
export function projectSeparateFinishing(input){
 let data=input;
 const edit=()=>{if(data===input)data=structuredClone(input);};
 if(data.stages.find(s=>s.id==='wall-finishing')?.name==='Dress, prime and paint'){edit();data.stages.find(s=>s.id==='wall-finishing').name='Dress, prime and paint — Walls';}
 for(const [from,to,label,ids]of [
  ['floor','floor-finishing','Dress, prime and paint — Floor',['floor-3']],
  ['platform','platform-finishing','Dress, prime and paint — Platform',['platform-seams','platform-skim','platform-prime','platform-paint']],
 ]){
  if(data.stages.some(s=>s.id===to))continue;
  const original=data.stages.find(s=>s.id===from);if(!original||!original.steps.some(t=>ids.includes(t.id)))continue;
  edit();const index=data.stages.findIndex(s=>s.id===from),source=data.stages[index],steps=source.steps.filter(t=>ids.includes(t.id));
  source.steps=source.steps.filter(t=>!ids.includes(t.id));
  const finish={id:to,name:label,notes:source.steps.length?[]:source.notes,steps};
  if(source.steps.length)data.stages.splice(index+1,0,finish);else data.stages.splice(index,1,finish);
 }
 for(const source of data.stages)for(const step of source.steps)if(step.id==='platform-skim'&&['Tape, skim and sand','Skim and sand the full surface'].includes(step.name)){edit();data.stages.find(s=>s.id===source.id).steps.find(t=>t.id===step.id).name='Cement-skim deck and finish fascia';}
 return projectUpgradeFloorLayers(data);
}
// Every upgrade pass ends by bringing counted milestones in line with the counts.
export function projectUpgradeFloorLayers(input){return projectSyncCounts(projectRenameJackStep(projectUpgradeFloorLayersOnly(input)));}
// The jack step is "Build jacks"; its built and attached counters both sit under it. A short-lived separate
// "Attach jacks to walls" step (walls-attach) is folded back in, keeping its notes.
export function projectRenameJackStep(input){
 const steps=input.stages.flatMap(s=>s.steps);if(!steps.some(t=>t.id==='walls-attach'||t.id==='walls-3'&&t.name==='Build and attach jacks'))return input;
 const data=structuredClone(input),all=data.stages.flatMap(s=>s.steps),jacks=all.find(t=>t.id==='walls-3'),extra=all.find(t=>t.id==='walls-attach');
 if(jacks&&jacks.name==='Build and attach jacks')jacks.name='Build jacks';
 if(extra){if(jacks)jacks.notes.push(...extra.notes);for(const s of data.stages)s.steps=s.steps.filter(t=>t.id!=='walls-attach');}
 return data;
}
export function projectUpgradeFloorLayersOnly(input){
 if(input.floorAssemblyVersion===1&&!input.stages.some(s=>s.steps.some(t=>t.id==='floor-1'&&t.name==='Prepare the base'||t.id==='floor-2'&&t.name==='Lay the flooring'||t.id==='floor-3'&&t.name==='Finish and trim')))return input;
 const data=structuredClone(input);data.floorAssemblyVersion=1;
 for(const stage of data.stages)for(const step of stage.steps){if(step.id==='floor-1'&&step.name==='Prepare the base')step.name='Prepare underlayment / cement skim';if(step.id==='floor-2'&&step.name==='Lay the flooring')step.name='Lay flooring / lower plywood layer';if(step.id==='floor-3'&&step.name==='Finish and trim')step.name='Prime, paint and trim floor';}
 const floor=data.stages.find(s=>s.steps.some(t=>t.id==='floor-2'));
 if(floor&&!data.stages.some(s=>s.steps.some(t=>t.id==='floor-upper')))floor.steps.splice(floor.steps.findIndex(t=>t.id==='floor-2')+1,0,{id:'floor-upper',name:'Glue and screw second plywood layer (painted floor)',percent:0,notes:[]});
 if(floor){const skim=floor.steps.find(t=>t.id==='floor-1'&&t.name==='Prepare underlayment / cement skim');if(skim){floor.steps=floor.steps.filter(t=>t!==skim);floor.steps.push(skim);}}
 return data;
}
// weights: optional {stepId: person-hours} from the labor estimate, so a step counts by how long it takes rather than
// equally. Steps without a weight (custom steps, other designs) count as an average step.
export function projectStepWeight(weights,id){if(!weights)return 1;const values=Object.values(weights).filter(v=>v>0);return weights[id]??(values.length?values.reduce((a,b)=>a+b,0)/values.length:1);}
export function projectStageWeight(stage,weights){return stage.steps.reduce((n,t)=>n+projectStepWeight(weights,t.id),0);}
export function projectStagePercent(stage,weights){const total=projectStageWeight(stage,weights);return total?Math.round(stage.steps.reduce((n,t)=>n+t.percent*projectStepWeight(weights,t.id),0)/total):0;}
export function projectProgress(data,weights){const steps=data.stages.flatMap(s=>s.steps),total=steps.reduce((n,t)=>n+projectStepWeight(weights,t.id),0);return {percent:total?Math.round(steps.reduce((n,t)=>n+t.percent*projectStepWeight(weights,t.id),0)/total):0,done:steps.filter(s=>s.percent===100).length,total:steps.length,weight:total};}
export function projectShiftCost(shift,now=Date.now()) {
 const elapsed=Math.max(0,(shift.end??now)-shift.start);
 const hours=shift.end===null?Math.floor(elapsed/3600000):elapsed/3600000;
 return {hours,cents:Math.round(hours*shift.rateCents)};
}
export function projectTotals(data,now=Date.now()) {
 const materials=data.expenses.reduce((n,e)=>n+e.amountCents,0),labor=data.shifts.reduce((n,s)=>n+projectShiftCost(s,now).cents,0);
 return {materials,labor,total:materials+labor,remaining:data.budgetCents===null?null:data.budgetCents-materials-labor};
}
export function projectValidate(kind,input,now=Date.now()) {
 const fail=message=>{throw Error(message);},str=(v,max=160)=>typeof v==='string'&&v.length<=max,id=v=>str(v,80)&&/^[\w-]+$/.test(v),money=(v,negative=false)=>Number.isSafeInteger(v)&&v<1e9&&(negative?v>-1e9:v>=0),list=(v,max)=>Array.isArray(v)&&v.length<=max;
 const unique=xs=>new Set(xs.map(x=>x.id)).size===xs.length;
 const notes=ns=>list(ns,100)&&unique(ns)&&ns.every(n=>id(n.id)&&str(n.text,2000)&&n.text.trim()&&Number.isSafeInteger(n.at));
 if(!input||typeof input!=='object')fail('Invalid project data.');
 if(kind==='tracking') {
  if(!list(input.stages,30)||!input.stages.length||!unique(input.stages))fail('Keep 1–30 production stages.');
  for(const s of input.stages){if(!id(s.id)||!str(s.name)||!s.name.trim()||!notes(s.notes)||!list(s.steps,100)||!s.steps.length||!unique(s.steps))fail('Invalid stage or notes.');for(const t of s.steps)if(!id(t.id)||!str(t.name)||!t.name.trim()||!Number.isInteger(t.percent)||t.percent<0||t.percent>100||!notes(t.notes))fail('Each step needs a name and progress from 0–100%.');}
  return {floorAssemblyVersion:input.floorAssemblyVersion===1?1:0,assembly:projectAssembly(input.assembly),guideChecks:projectGuideChecks(input.guideChecks||{}),stages:input.stages.map(s=>({id:s.id,name:s.name.trim(),notes:s.notes,steps:s.steps.map(t=>({id:t.id,name:t.name.trim(),percent:t.percent,notes:t.notes}))}))};
 }
 if(kind!=='finance')fail('Unknown project module.');
 if(input.budgetCents!==null&&!money(input.budgetCents)||!list(input.expenses,5000)||!list(input.crew,100)||!list(input.shifts,10000))fail('Invalid project totals or too many entries.');
 const receipts=input.expenses.map(e=>e.receiptId).filter(Boolean);if(new Set(receipts).size!==receipts.length)fail('This receipt is already recorded. Edit the existing entry.');
 if(!unique(input.expenses)||!unique(input.crew)||!unique(input.shifts))fail('Duplicate entry IDs.');
 for(const e of input.expenses)if(!id(e.id)||!str(e.vendor)||!e.vendor.trim()||!money(e.amountCents,true)||!str(e.note,2000)||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||Number.isNaN(Date.parse(e.date))||(e.receiptId!==null&&!id(e.receiptId)))fail('Check the material entry, date and amount.');
 // Receipt line items link a purchase to shopping-list rows by materialId; null means not on the list.
 const item=i=>i&&typeof i==='object'&&id(i.id)&&(i.materialId===null||id(i.materialId))&&str(i.description)&&(i.materialId!==null||i.description.trim())&&(i.quantity===null||Number.isFinite(i.quantity)&&i.quantity>0&&i.quantity<=100000)&&(i.amountCents===null||money(i.amountCents,true))&&typeof i.complete==='boolean'&&typeof i.substitute==='boolean'&&str(i.note,500);
 for(const e of input.expenses)if(e.items!==undefined&&(!list(e.items,200)||!unique(e.items)||!e.items.every(item)))fail('Check the receipt line items: each needs a shopping-list item or a description.');
 for(const c of input.crew)if(!id(c.id)||!str(c.name,80)||!c.name.trim()||!money(c.rateCents)||typeof c.archived!=='boolean')fail('Check the crew name and hourly rate.');
 for(const s of input.shifts){const c=input.crew.find(c=>c.id===s.personId);if(!id(s.id)||!c||(s.taskId!=null&&!id(s.taskId))||!money(s.rateCents)||!str(s.note,2000)||!Number.isSafeInteger(s.start)||s.start<0||s.start>now+60000||s.end!==null&&(!Number.isSafeInteger(s.end)||s.end<s.start||s.end>now+60000)||s.end===null&&c.archived)fail('Check the shift times. Clock out before removing a person.');}
 for(const c of input.crew){const shifts=input.shifts.filter(s=>s.personId===c.id).sort((a,b)=>a.start-b.start);for(let i=1;i<shifts.length;i++)if(shifts[i-1].end===null||shifts[i].start<shifts[i-1].end)fail(`${c.name} has overlapping shifts. Correct the times first.`);}
 return {budgetCents:input.budgetCents,expenses:input.expenses.map(e=>({id:e.id,vendor:e.vendor.trim(),date:e.date,amountCents:e.amountCents,note:e.note,receiptId:e.receiptId,items:(e.items||[]).map(i=>({id:i.id,materialId:i.materialId,description:i.description.trim(),quantity:i.quantity===null?null:Math.round(i.quantity*100)/100,amountCents:i.amountCents,complete:i.materialId!==null&&i.complete,substitute:i.materialId!==null&&i.substitute,note:i.note.trim()}))})),crew:input.crew.map(c=>({id:c.id,name:c.name.trim(),rateCents:c.rateCents,archived:c.archived})),shifts:input.shifts.map(s=>({id:s.id,personId:s.personId,start:s.start,end:s.end,rateCents:s.rateCents,note:s.note,taskId:s.taskId??null}))};
}
// A window opened before line items and work stages existed saves expenses and shifts without those
// fields. Carry them over from the stored record instead of erasing them.
export function projectPreserveFinance(previous,next){
 if(!next||!Array.isArray(next.expenses)||!Array.isArray(next.shifts))return next;
 const expenses=new Map((previous?.expenses||[]).map(e=>[e.id,e])),shifts=new Map((previous?.shifts||[]).map(s=>[s.id,s]));
 return {...next,expenses:next.expenses.map(e=>e&&typeof e==='object'&&!Object.hasOwn(e,'items')?{...e,items:expenses.get(e.id)?.items||[]}:e),shifts:next.shifts.map(s=>s&&typeof s==='object'&&!Object.hasOwn(s,'taskId')?{...s,taskId:shifts.get(s.id)?.taskId??null}:s)};
}
// Prefer a labelled total, never a card number, tendered cash, savings or subtotal.
export function projectParseReceipt(text) {
 const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),amount=s=>{const m=[...s.matchAll(/(?:\$\s*)?(-?\d[\d,]*[.,]\d{2})(?!\d)/g)].at(-1);return m?Math.round(Number(m[1].replace(/,(?=\d{3})/g,'').replace(',','.'))*100):null;};
 const totals=lines.flatMap((s,i)=>/\b(?:grand\s+total|amount\s+(?:due|paid)|total(?:\s+due)?)\b/i.test(s)&&!/sub\s*total|savings|discount|items|tax|cash|change|tender/i.test(s)?[{value:amount(s)??amount(lines[i+1]||''),score:/grand|amount|due/i.test(s)?2:1}]:[]).filter(x=>x.value!==null).sort((a,b)=>b.score-a.score);
 const values=[...new Set(totals.filter(t=>t.score===totals[0]?.score).map(t=>t.value))];
 const subtotal=lines.find(s=>/sub\s*total/i.test(s)),tax=lines.find(s=>/^(?:sales\s+)?tax\b/i.test(s));
 const match=text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})\b/),iso=text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
 let date=iso?.[0]||null;if(!date&&match){const y=match[3].length===2?'20'+match[3]:match[3];date=`${y}-${match[1].padStart(2,'0')}-${match[2].padStart(2,'0')}`;if(Number.isNaN(Date.parse(date)))date=null;}
 const amountCents=values.length===1?values[0]:null,subtotalCents=amount(subtotal||''),taxCents=amount(tax||'');
 return {vendor:lines.slice(0,5).find(s=>/[a-z]{3}/i.test(s)&&!/receipt|welcome|invoice|thank|\b(?:tel|www)\b/i.test(s))||'',date,amountCents,subtotalCents,taxCents,warning:values.length>1?'More than one total was found. Enter the correct receipt total.':amountCents===null?'Could not confidently find the total. Enter it from the receipt.':subtotalCents!==null&&taxCents!==null&&Math.abs(subtotalCents+taxCents-amountCents)>1?'Subtotal and tax do not match the total. Check discounts or fees.':''};
}

export function projectAssembly(input={}) {
 const out={};for(const [key,max] of [['panelsCompleted',8],['jacksBuilt',16],['jacksAttached',16],['ballastAttached',8],['wallsJoined',8],['anglesSet',2]]){const value=input?.[key]??null;if(value!==null&&(!Number.isInteger(value)||value<0||value>max))throw Error(`Invalid ${key} count.`);out[key]=value;}
 if((out.jacksAttached??0)>(out.jacksBuilt??0)||(out.jacksAttached??0)>(out.panelsCompleted??0)*2)throw Error('Attached jacks cannot exceed built jacks or two per completed panel.');
 if((out.ballastAttached??0)>Math.floor((out.jacksAttached??0)/2))throw Error('Attach both jacks before counting a ballast assembly.');
 if((out.wallsJoined??0)>(out.panelsCompleted??0))throw Error('Joined walls cannot exceed completed panels.');
 return out;
}
// Exact inventory is authoritative when the user explicitly saves counts. Percent edits never invent counts.
// Exact counts are authoritative. They set the counted milestones and leave the guide's walkthrough checks alone.
export function projectSetAssemblyCounts(input,counts){const data=structuredClone(input);data.assembly=projectAssembly(counts);return projectSyncCounts(data);}
export function projectStepPercent(data,id){for(const s of data?.stages||[]){const step=s.steps.find(t=>t.id===id);if(step)return step.percent;}return 0;}
export function projectPartStatus(part,data) {
 const counts=projectAssembly(data?.assembly),percent=id=>projectStepPercent(data,id),panel=part.panel??0;
 const unit=(id,index,total)=>index<Math.floor(percent(id)*total/100);
 // Legacy tracking has no counts: fully framed and skinned means all panels exist.
 // Partial jack progress cannot tell us how many are actually attached.
 const completedPanels=counts.panelsCompleted??(percent('walls-1')===100&&percent('walls-2')===100?8:0);
 // Walk from the right wing's free end, across the back, then out the left wing.
 const jackPanel=[7,6,3,2,1,0,4,5].filter(index=>index<completedPanels).indexOf(panel);
 const wall=panel<completedPanels,attached=jackPanel>=0&&jackPanel*2+(1-(part.side??0))<(counts.jacksAttached??0)&&wall;
 if(part.kind==='panel')return {assembled:wall};
 if(part.kind==='jack')return {assembled:attached};
 if(part.kind==='bracing')return {assembled:wall&&jackPanel>=0&&jackPanel*2+1<(counts.jacksAttached??0)&&(counts.ballastAttached===null?percent('walls-4')===100:jackPanel<counts.ballastAttached)};
 if(part.kind==='wallSkin')return {assembled:wall,finish:part.front===false?'raw':percent('wall-finishing-4')===100?'paint':percent('wall-finishing-3')===100?'primer':unit('wall-finishing-1',panel,8)||unit('wall-finishing-2',panel,8)?'seams':'raw'};
 if(part.kind==='floor')return {assembled:percent('floor-2')===100,finish:percent('floor-3')===100?'paint':percent('floor-upper')===100&&percent('floor-1')===100?'skim':'raw'};
 if(part.kind==='platform'){
  if(part.members?.length){const states=part.members.map((module,index)=>projectPartStatus({...part,module,deckIndex:part.deckIndices?.[index]??part.deckIndex,members:null},data)),finishes=['raw','seams','skim','primer','paint'];return {assembled:states.every(s=>s.assembled),finish:finishes[Math.min(...states.map(s=>finishes.indexOf(s.finish)))]};}
  const i=part.module??0,n=part.total??1;
  const frame=unit('platform-frame',i,n),legs=unit('platform-legs',i,n),joined=unit('platform-join',i,n),deck=unit('platform-deck',part.deckIndex??i,part.deckTotal??n),fascia=part.fasciaIndices?part.fasciaIndices.every(index=>unit('platform-fascia',index,part.fasciaTotal)):unit('platform-fascia',part.fasciaIndex??i,part.fasciaTotal??n);
  const assembled=frame&&legs&&joined&&(part.stage>=34?deck:true)&&(part.stage>=35?fascia:true);
  const surface=part.stage>=34,seams=deck&&fascia&&unit('platform-seams',part.deckIndex??i,part.deckTotal??n),skim=seams&&unit('platform-skim',part.deckIndex??i,part.deckTotal??n),primer=skim&&unit('platform-prime',part.deckIndex??i,part.deckTotal??n),paint=primer&&unit('platform-paint',part.deckIndex??i,part.deckTotal??n);
  return {assembled,finish:surface?(paint?'paint':primer?'primer':skim?'skim':seams?'seams':'raw'):'raw'};
 }
 return {assembled:false};
}
export function projectUpgradePlatform(input) {
 const stage=input.stages.find(s=>s.id==='platform');if(!stage||stage.steps.some(t=>t.id==='platform-frame'))return projectUpgradePlatformSeams(input);
 const legacy=['platform-0','platform-1','platform-2','platform-3'];if(!legacy.every(id=>stage.steps.some(t=>t.id===id)))return input;
 const groups={
  'platform-0':[['platform-cut','Lay out and number modules'],['platform-frame','Cut and assemble module frames']],
  'platform-1':[['platform-legs','Fit legs and sills'],['platform-join','Position and join modules']],
  'platform-2':[['platform-deck','Attach the decks'],['platform-fascia','Attach the fascia']],
  'platform-3':[['platform-skim','Tape, skim and sand'],['platform-prime','Prime the platform'],['platform-paint','Paint the platform']],
 };
 const data=structuredClone(input),target=data.stages.find(s=>s.id==='platform');
 target.steps=target.steps.flatMap(t=>groups[t.id]?groups[t.id].map(([id,name],i)=>({id,name,percent:t.percent,notes:i===0?t.notes:[]})): [t]);return projectUpgradePlatformSeams(data);
}

export function projectGuideGroups(design={}) {
 const tall=design.height!==96;
 const groups={
  'walls-0':[0],'walls-1':[1,2,3,4,5,6,7,...(tall?[8]:[]),9],'walls-2':[10,...(tall?[11]:[]),12],
  'walls-3':[13,14,15,16,17],'walls-4':[18,19,20],'walls-5':[21,22],
  'wall-finishing-0':[28],'wall-finishing-1':[28],'wall-finishing-2':[28],'wall-finishing-3':[28],'wall-finishing-4':[28],
 };
 if(design.floor==='wood')Object.assign(groups,{'floor-0':[23],'floor-1':[24],'floor-2':[25,26],'floor-3':[27]});
 if(design.floor==='charcoal')Object.assign(groups,{'floor-0':[23],'floor-1':[25],'floor-2':[24],'floor-upper':[42],'floor-3':[26,27]});
 if(design.platformShape&&design.platformShape!=='none')Object.assign(groups,{'platform-cut':[30],'platform-frame':[31],'platform-legs':[32],'platform-join':[33],'platform-deck':[34],'platform-fascia':[35],'platform-seams':[36],'platform-skim':[36],'platform-prime':[37],'platform-paint':[37]});
 return groups;
}
export function projectGuideKey(stage,design){return stage<=12?`panel:${design.height===96?96:120}:${stage}`:stage<=20?`jack:${design.height===96?96:120}:${stage}`:(stage>=23&&stage<=27||stage===42)?`floor:${design.floor}:${stage}`:`set:${stage}`;}
export function projectGuideChecks(input={}) {
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length>100)throw Error('Invalid guide completion records.');
 const result={};for(const [key,value] of Object.entries(input)){if(!/^(?:(?:panel|jack):(?:96|120)|floor:(?:wood|charcoal)|set):\d{1,2}$/.test(key)||(typeof value!=='boolean'&&(!Number.isInteger(value)||value<0||value>100)))throw Error('Invalid guide completion record.');result[key]=value;}return result;
}
// Wall panels, jacks and ballast are counted, not estimated: their Build guide stages take their percentage from the
// counts. The guide walks through one unit; checking every step of it credits one unit (two jacks for a pair).
export function projectCountUnits(design={}){const groups=projectGuideGroups({...design,floor:'none',platformShape:'none'});return [
 {key:'panelsCompleted',max:8,per:1,stages:[...groups['walls-1'],...groups['walls-2']]},
 {key:'jacksBuilt',max:16,per:2,stages:[13,14,15,16]},
 {key:'jacksAttached',max:16,per:2,stages:[17]},
 {key:'ballastAttached',max:8,per:1,stages:[18,19,20]},
 // Joining and angle-setting happen once for the whole set, so finishing the guide steps credits nothing.
 {key:'wallsJoined',max:8,per:0,stages:[21]},
 {key:'anglesSet',max:2,per:0,stages:[22]},
];}
export function projectCountMilestones(){return ['walls-1','walls-2','walls-3','walls-4','walls-5'];}
// Counted milestone percentages straight from the counts (the same for every wall height). Unchanged input is returned as is.
export function projectSyncCounts(input){
 const c=projectAssembly(input.assembly),pct=(v,max)=>Math.round(v/max*100),jacks=c.jacksBuilt===null&&c.jacksAttached===null?null:Math.round(((c.jacksBuilt??0)/16*100*2+(c.jacksAttached??0)/16*100)/3);
 const target={'walls-1':c.panelsCompleted===null?null:pct(c.panelsCompleted,8),'walls-2':c.panelsCompleted===null?null:pct(c.panelsCompleted,8),'walls-3':jacks,'walls-4':c.ballastAttached===null?null:pct(c.ballastAttached,8),'walls-5':c.wallsJoined===null&&c.anglesSet===null?null:Math.round(((c.wallsJoined??0)/8*100+(c.anglesSet??0)/2*100)/2)};
 if(!input.stages.some(s=>s.steps.some(t=>target[t.id]!=null&&t.percent!==target[t.id])))return input;
 const data=structuredClone(input);for(const s of data.stages)for(const t of s.steps)if(target[t.id]!=null)t.percent=target[t.id];return data;
}
export function projectGuideStagePercent(data,stage,design){
 const unit=projectCountUnits(design).find(u=>u.stages.includes(stage)),count=unit?projectAssembly(data?.assembly)[unit.key]:null;
 if(count!==null&&count!==undefined)return Math.round(count/unit.max*100);
 const key=projectGuideKey(stage,design),saved=data.guideChecks?.[key];
 if(saved!==undefined)return typeof saved==='boolean'?(saved?100:0):saved;
 const groups=Object.entries(projectGuideGroups(design)).filter(([,stages])=>stages.includes(stage));
 return groups.length?Math.round(groups.reduce((sum,[id])=>sum+projectStepPercent(data,id),0)/groups.length):0;
}
export function projectGuideStageDone(data,stage,design){const saved=data?.guideChecks?.[projectGuideKey(stage,design)];if(saved!==undefined&&projectCountUnits(design).some(u=>u.stages.includes(stage)))return saved===true||saved===100;return projectGuideStagePercent(data,stage,design)===100;}
// Credit a finished walkthrough unit, keeping the counts consistent with each other (attached ≤ built, two per panel).
export function projectCreditUnit(assembly,key,amount){const a={...projectAssembly(assembly)},at=k=>a[k]??0;a[key]=Math.max(at(key),amount);
 if(key==='ballastAttached')a.jacksAttached=Math.max(at('jacksAttached'),a.ballastAttached*2);
 if(['ballastAttached','jacksAttached'].includes(key)){a.jacksBuilt=Math.max(at('jacksBuilt'),a.jacksAttached);a.panelsCompleted=Math.max(at('panelsCompleted'),Math.ceil(a.jacksAttached/2));}
 return projectAssembly(a);}
export function projectSetGuideStage(input,stage,done,design){
 const groups=projectGuideGroups(design),affected=Object.entries(groups).filter(([,stages])=>stages.includes(stage));
 if(!affected.length||(typeof done!=='boolean'&&(!Number.isInteger(done)||done<0||done>100)))throw Error('This guide step is not part of the current design.');
 const data=structuredClone(projectUpgradeTracking(input));data.guideChecks=projectGuideChecks(data.guideChecks||{});
 for(const [,stages]of affected)for(const number of stages){const key=projectGuideKey(number,design);if(!Object.hasOwn(data.guideChecks,key))data.guideChecks[key]=projectGuideStagePercent(input,number,design);}
 data.guideChecks[projectGuideKey(stage,design)]=done;
 const unit=projectCountUnits(design).find(u=>u.stages.includes(stage));
 if(unit?.per&&done&&done!==0&&unit.stages.every(n=>projectGuideStageDone(data,n,design)))data.assembly=projectCreditUnit(data.assembly,unit.key,unit.per);
 if(unit)for(const id of projectCountMilestones())if(!affected.some(([a])=>a===id)&&groups[id])affected.push([id,groups[id]]);
 for(const [id,stages]of affected){let row=data.stages.flatMap(s=>s.steps).find(t=>t.id===id);
  if(!row&&done){const defaults=projectDefaultTracking(),source=defaults.stages.find(s=>s.steps.some(t=>t.id===id));if(source){let parent=data.stages.find(s=>s.id===source.id);if(!parent){parent={id:source.id,name:source.name,notes:[],steps:[]};data.stages.push(parent);}row=structuredClone(source.steps.find(t=>t.id===id));parent.steps.push(row);}}
  if(row)row.percent=Math.round(stages.reduce((sum,number)=>sum+projectGuideStagePercent(data,number,design),0)/stages.length);
 }
 return data;
}
// A direct tracker percentage edit supersedes earlier checkbox detail for that milestone.
export function projectReconcileGuideChecks(previous,next){
 if(JSON.stringify(previous.guideChecks||{})!==JSON.stringify(next.guideChecks||{}))return next;
 const changed=new Set(next.stages.flatMap(s=>s.steps).filter(t=>t.percent!==projectStepPercent(previous,t.id)).map(t=>t.id));if(!changed.size)return next;
 const checks={...(next.guideChecks||{})};
 for(const height of [96,120])for(const floor of ['wood','charcoal']){const design={height,floor,platformShape:'square'};for(const [id,stages]of Object.entries(projectGuideGroups(design)))if(changed.has(id)&&!projectCountMilestones().includes(id))for(const stage of stages)delete checks[projectGuideKey(stage,design)];}
 return {...next,guideChecks:checks};
}

export function projectUpgradePlatformSeams(input){
 const platform=input.stages.find(s=>s.id==='platform'),skim=platform?.steps.find(s=>s.id==='platform-skim');
 if(!skim||platform.steps.some(s=>s.id==='platform-seams'))return input;
 const data=structuredClone(input),stage=data.stages.find(s=>s.id==='platform'),i=stage.steps.findIndex(s=>s.id==='platform-skim');
 stage.steps.splice(i,0,{id:'platform-seams',name:'Patch seams and corners',percent:skim.percent,notes:[]});
 if(stage.steps[i+1].name==='Tape, skim and sand')stage.steps[i+1].name='Skim and sand the full surface';return data;
}
