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
 if(!legacy||input.stages.some(s=>s.id==='wall-finishing'))return projectUpgradePlatform(input);
 const data=structuredClone(input),index=data.stages.findIndex(s=>s.id==='walls');
 data.stages[index].steps=data.stages[index].steps.filter(t=>t.id!==legacy.id);
 if(!data.stages[index].steps.length)return input;
 data.stages.splice(index+1,0,{id:'wall-finishing',name:'Dress, prime and paint',notes:structuredClone(legacy.notes),steps:['Dress seams and corners','Fill and feather joints','Sand and clean surfaces','Prime the walls','Paint the walls'].map((name,i)=>({id:`wall-finishing-${i}`,name,percent:legacy.percent,notes:[]}))});
 return projectUpgradePlatform(data);
}
export function projectStagePercent(stage){return stage.steps.length?Math.round(stage.steps.reduce((n,s)=>n+s.percent,0)/stage.steps.length):0;}
export function projectProgress(data){const steps=data.stages.flatMap(s=>s.steps);return {percent:steps.length?Math.round(steps.reduce((n,s)=>n+s.percent,0)/steps.length):0,done:steps.filter(s=>s.percent===100).length,total:steps.length};}
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
  return {assembly:projectAssembly(input.assembly),guideChecks:projectGuideChecks(input.guideChecks||{}),stages:input.stages.map(s=>({id:s.id,name:s.name.trim(),notes:s.notes,steps:s.steps.map(t=>({id:t.id,name:t.name.trim(),percent:t.percent,notes:t.notes}))}))};
 }
 if(kind!=='finance')fail('Unknown project module.');
 if(input.budgetCents!==null&&!money(input.budgetCents)||!list(input.expenses,5000)||!list(input.crew,100)||!list(input.shifts,10000))fail('Invalid project totals or too many entries.');
 const receipts=input.expenses.map(e=>e.receiptId).filter(Boolean);if(new Set(receipts).size!==receipts.length)fail('This receipt is already recorded. Edit the existing entry.');
 if(!unique(input.expenses)||!unique(input.crew)||!unique(input.shifts))fail('Duplicate entry IDs.');
 for(const e of input.expenses)if(!id(e.id)||!str(e.vendor)||!e.vendor.trim()||!money(e.amountCents,true)||!str(e.note,2000)||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||Number.isNaN(Date.parse(e.date))||(e.receiptId!==null&&!id(e.receiptId)))fail('Check the material entry, date and amount.');
 for(const c of input.crew)if(!id(c.id)||!str(c.name,80)||!c.name.trim()||!money(c.rateCents)||typeof c.archived!=='boolean')fail('Check the crew name and hourly rate.');
 for(const s of input.shifts){const c=input.crew.find(c=>c.id===s.personId);if(!id(s.id)||!c||!money(s.rateCents)||!str(s.note,2000)||!Number.isSafeInteger(s.start)||s.start<0||s.start>now+60000||s.end!==null&&(!Number.isSafeInteger(s.end)||s.end<s.start||s.end>now+60000)||s.end===null&&c.archived)fail('Check the shift times. Clock out before removing a person.');}
 for(const c of input.crew){const shifts=input.shifts.filter(s=>s.personId===c.id).sort((a,b)=>a.start-b.start);for(let i=1;i<shifts.length;i++)if(shifts[i-1].end===null||shifts[i].start<shifts[i-1].end)fail(`${c.name} has overlapping shifts. Correct the times first.`);}
 return {budgetCents:input.budgetCents,expenses:input.expenses.map(e=>({id:e.id,vendor:e.vendor.trim(),date:e.date,amountCents:e.amountCents,note:e.note,receiptId:e.receiptId})),crew:input.crew.map(c=>({id:c.id,name:c.name.trim(),rateCents:c.rateCents,archived:c.archived})),shifts:input.shifts.map(s=>({id:s.id,personId:s.personId,start:s.start,end:s.end,rateCents:s.rateCents,note:s.note}))};
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
 const out={};for(const [key,max] of [['panelsCompleted',8],['jacksBuilt',16],['jacksAttached',16],['jacksPartial',16]]){const value=input?.[key]??null;if(value!==null&&(!Number.isInteger(value)||value<0||value>max))throw Error(`Invalid ${key} count.`);out[key]=value;}
 if((out.jacksAttached??0)>(out.jacksBuilt??0)||(out.jacksAttached??0)>(out.panelsCompleted??0)*2)throw Error('Attached jacks cannot exceed built jacks or two per completed panel.');
 if((out.jacksBuilt??0)+(out.jacksPartial??0)>16)throw Error('Built and partially built jacks cannot exceed 16.');
 return out;
}
export function projectStepPercent(data,id){for(const s of data?.stages||[]){const step=s.steps.find(t=>t.id===id);if(step)return step.percent;}return 0;}
export function projectPartStatus(part,data) {
 const counts=projectAssembly(data?.assembly),percent=id=>projectStepPercent(data,id),panel=part.panel??0;
 const unit=(id,index,total)=>index<Math.floor(percent(id)*total/100);
 const wall=panel<(counts.panelsCompleted??0),attached=panel*2+(part.side??0)<(counts.jacksAttached??0)&&wall;
 if(part.kind==='panel')return {assembled:wall};
 if(part.kind==='jack')return {assembled:attached};
 if(part.kind==='bracing')return {assembled:wall&&panel*2+1<(counts.jacksAttached??0)&&percent('walls-4')===100};
 if(part.kind==='wallSkin')return {assembled:wall,finish:part.front===false?'raw':percent('wall-finishing-4')===100?'paint':percent('wall-finishing-3')===100?'primer':unit('wall-finishing-1',panel,8)||unit('wall-finishing-2',panel,8)?'seams':'raw'};
 if(part.kind==='floor')return {assembled:percent('floor-2')===100,finish:percent('floor-3')===100?'paint':'raw'};
 if(part.kind==='trim')return {assembled:percent('floor-3')===100&&wall};
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
 if(design.floor==='charcoal')Object.assign(groups,{'floor-0':[23],'floor-1':[25],'floor-2':[24],'floor-3':[26,27]});
 if(design.platformShape&&design.platformShape!=='none')Object.assign(groups,{'platform-cut':[30],'platform-frame':[31],'platform-legs':[32],'platform-join':[33],'platform-deck':[34],'platform-fascia':[35],'platform-seams':[36],'platform-skim':[36],'platform-prime':[37],'platform-paint':[37]});
 return groups;
}
export function projectGuideKey(stage,design){return stage<=12?`panel:${design.height===96?96:120}:${stage}`:stage<=20?`jack:${design.height===96?96:120}:${stage}`:stage>=23&&stage<=27?`floor:${design.floor}:${stage}`:`set:${stage}`;}
export function projectGuideChecks(input={}) {
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length>100)throw Error('Invalid guide completion records.');
 const result={};for(const [key,value] of Object.entries(input)){if(!/^(?:(?:panel|jack):(?:96|120)|floor:(?:wood|charcoal)|set):\d{1,2}$/.test(key)||typeof value!=='boolean')throw Error('Invalid guide completion record.');result[key]=value;}return result;
}
export function projectGuideStageDone(data,stage,design){
 const key=projectGuideKey(stage,design);if(Object.hasOwn(data.guideChecks||{},key))return data.guideChecks[key];
 const groups=Object.entries(projectGuideGroups(design)).filter(([,stages])=>stages.includes(stage));
 return groups.length>0&&groups.every(([id])=>projectStepPercent(data,id)===100);
}
export function projectSetGuideStage(input,stage,done,design){
 const groups=projectGuideGroups(design),affected=Object.entries(groups).filter(([,stages])=>stages.includes(stage));
 if(!affected.length||typeof done!=='boolean')throw Error('This guide step is not part of the current design.');
 const data=structuredClone(projectUpgradeTracking(input));data.guideChecks=projectGuideChecks(data.guideChecks||{});
 for(const [,stages]of affected)for(const number of stages){const key=projectGuideKey(number,design);if(!Object.hasOwn(data.guideChecks,key))data.guideChecks[key]=projectGuideStageDone(input,number,design);}
 data.guideChecks[projectGuideKey(stage,design)]=done;
 for(const [id,stages]of affected){let row=data.stages.flatMap(s=>s.steps).find(t=>t.id===id);
  if(!row&&done){const defaults=projectDefaultTracking(),source=defaults.stages.find(s=>s.steps.some(t=>t.id===id));if(source){let parent=data.stages.find(s=>s.id===source.id);if(!parent){parent={id:source.id,name:source.name,notes:[],steps:[]};data.stages.push(parent);}row=structuredClone(source.steps.find(t=>t.id===id));parent.steps.push(row);}}
  if(row)row.percent=Math.round(stages.filter(number=>data.guideChecks[projectGuideKey(number,design)]).length/stages.length*100);
 }
 return data;
}
// A direct tracker percentage edit supersedes earlier checkbox detail for that milestone.
export function projectReconcileGuideChecks(previous,next){
 if(JSON.stringify(previous.guideChecks||{})!==JSON.stringify(next.guideChecks||{}))return next;
 const changed=new Set(next.stages.flatMap(s=>s.steps).filter(t=>t.percent!==projectStepPercent(previous,t.id)).map(t=>t.id));if(!changed.size)return next;
 const checks={...(next.guideChecks||{})};
 for(const height of [96,120])for(const floor of ['wood','charcoal']){const design={height,floor,platformShape:'square'};for(const [id,stages]of Object.entries(projectGuideGroups(design)))if(changed.has(id))for(const stage of stages)delete checks[projectGuideKey(stage,design)];}
 return {...next,guideChecks:checks};
}

export function projectUpgradePlatformSeams(input){
 const platform=input.stages.find(s=>s.id==='platform'),skim=platform?.steps.find(s=>s.id==='platform-skim');
 if(!skim||platform.steps.some(s=>s.id==='platform-seams'))return input;
 const data=structuredClone(input),stage=data.stages.find(s=>s.id==='platform'),i=stage.steps.findIndex(s=>s.id==='platform-skim');
 stage.steps.splice(i,0,{id:'platform-seams',name:'Patch seams and corners',percent:skim.percent,notes:[]});
 if(stage.steps[i+1].name==='Tape, skim and sand')stage.steps[i+1].name='Skim and sand the full surface';return data;
}
