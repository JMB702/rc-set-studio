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
 if(!legacy||input.stages.some(s=>s.id==='wall-finishing'))return input;
 const data=structuredClone(input),index=data.stages.findIndex(s=>s.id==='walls');
 data.stages[index].steps=data.stages[index].steps.filter(t=>t.id!==legacy.id);
 if(!data.stages[index].steps.length)return input;
 data.stages.splice(index+1,0,{id:'wall-finishing',name:'Dress, prime and paint',notes:structuredClone(legacy.notes),steps:['Dress seams and corners','Fill and feather joints','Sand and clean surfaces','Prime the walls','Paint the walls'].map((name,i)=>({id:`wall-finishing-${i}`,name,percent:legacy.percent,notes:[]}))});
 return data;
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
  return {stages:input.stages.map(s=>({id:s.id,name:s.name.trim(),notes:s.notes,steps:s.steps.map(t=>({id:t.id,name:t.name.trim(),percent:t.percent,notes:t.notes}))}))};
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
