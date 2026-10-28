import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectDefaultTracking,projectUpgradeTracking,projectValidate,projectPartStatus,projectGuideGroups,projectSetGuideStage,WOOD_FILLER_STEPS} from '../public/project-model.js';
import {platformRows,floorRows,fillerTubs,fillerQuarts,floorArea,priceRows} from '../public/pricing-calc.js';
import {platformPlan,deckFillLayout,onOutline} from '../public/platform.js';
import {floorPlan} from '../public/floor-plan.js';
import {laborTasks,woodFillHours,fillSandHours,primerSandHours} from '../public/labor.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/flat-shopping-list.json',import.meta.url)));
const design={floorLip:true,seamlessCorners:true,seamlessCornerSide:'right',seamlessPerimeter:false,height:120,angle:90,floor:'charcoal',platformShape:'square',platformAngle:90,platformBack:18,platformSide:18,wallColor:'#34383b',platformColor:'#34383b',floorColor:'#34383b'};
const steps=(d,id)=>d.stages.find(s=>s.id===id).steps;
// Jeff's live tracker on 2026-10-23, before the switch: both plywood layers down, skim not started, corner bead on.
function live(){
 const d={design,stages:[
  {id:'floor',name:'Floor',notes:[],steps:[['floor-0','Mark the footprint',100],['floor-2','Lay flooring / lower plywood layer',100],['floor-upper','Glue and screw second plywood layer (painted floor)',100],['floor-1','Prepare underlayment / cement skim',0]].map(([id,name,percent])=>({id,name,percent,notes:[]}))},
  {id:'floor-finishing',name:'Dress, prime and paint — Floor',notes:[],steps:[{id:'floor-3',name:'Prime, paint and trim floor',percent:0,notes:[{id:'n1',text:'Buy paint with the platform.',at:1}]}]},
  {id:'platform-finishing',name:'Dress, prime and paint — Platform',notes:[],steps:[['platform-bead','Attach vinyl corner bead',100],['platform-seams','Patch seams and corners',0],['platform-skim','Cement-skim deck and finish fascia',0],['platform-prime','Prime the platform',0],['platform-paint','Paint the platform',0]].map(([id,name,percent])=>({id,name,percent,notes:[]}))},
 ],floorAssemblyVersion:1};
 return d;
}

test('The floor and deck steps read fill, sand, prime, paint; ids, percents and notes carry over, once',()=>{
 const before=live(),up=projectUpgradeTracking(before);
 assert.deepEqual(steps(up,'floor').map(t=>t.id),['floor-0','floor-2','floor-upper'],'the fill step leaves the floor build');
 assert.deepEqual(steps(up,'floor-finishing').map(t=>[t.id,t.name,t.percent]),[['floor-1',WOOD_FILLER_STEPS['floor-1'],0],['floor-sand','Sand filler flush, then a light 180 pass',0],['floor-3','Prime twice, sanding 220 between',0],['floor-paint','Paint the floor (2 coats)',0]]);
 assert.deepEqual(steps(up,'floor-finishing')[2].notes.map(n=>n.text),['Buy paint with the platform.']);
 assert.deepEqual(steps(up,'platform-finishing').map(t=>[t.id,t.name,t.percent]),[['platform-bead','Attach vinyl corner bead',100],['platform-seams','Fill the deck with wood filler; compound the bead and fascia joints',0],['platform-skim','Sand filler flush, light 180 pass; sand the fascia',0],['platform-prime','Prime the platform twice, sanding 220 between',0],['platform-paint','Paint the platform (2 coats)',0]]);
 assert.deepEqual(before,live(),'the input is not modified');
 assert.equal(projectUpgradeTracking(up),up,'the upgrade runs once');
 assert.deepEqual(steps(projectValidate('tracking',up),'floor-finishing').map(t=>t.id),['floor-1','floor-sand','floor-3','floor-paint']);
 // Progress already made carries over: a primed floor was sanded first; a finished prime-and-paint step means painted too.
 for(const [prime,sand,paint] of [[50,100,0],[100,100,100]]){const d=live();steps(d,'floor-finishing')[0].percent=prime;const u=projectUpgradeTracking(d);assert.deepEqual(steps(u,'floor-finishing').map(t=>t.percent),[0,sand,prime,paint]);}
 // A new tracker reads the same way.
 assert.deepEqual(steps(projectDefaultTracking(design),'floor-finishing').map(t=>t.id),['floor-1','floor-sand','floor-3','floor-paint']);
});

test('Guide stages are unchanged: 25 fills and sands, 26 primes, 27 paints the floor; 36 fills and sands the deck',()=>{
 const g=projectGuideGroups(design);
 assert.deepEqual([g['floor-1'],g['floor-sand'],g['floor-3'],g['floor-paint']],[[25],[25],[26],[27]]);
 assert.deepEqual([g['platform-seams'],g['platform-skim'],g['platform-prime'],g['platform-paint']],[[36],[36],[37],[75]]);
 const stages=new Set(Object.values(g).flat());for(const s of [23,24,25,26,27,42,36,37,75,79])assert.ok(stages.has(s));
 const filled=projectSetGuideStage(projectUpgradeTracking(live()),25,true,design),pct=id=>filled.stages.flatMap(s=>s.steps).find(t=>t.id===id).percent;
 assert.deepEqual(['floor-1','floor-sand','floor-3','floor-paint'].map(pct),[100,100,0,0],'checking the fill step marks filling and sanding only');
});

test('Wood filler replaces the skim rows; the primer rows keep their ids and become a bare-wood primer',()=>{
 const plan=platformPlan(90,18,18,90,design),deck=platformRows(data,90,18,18,90,design),floor=floorRows(data,90,'charcoal',design),area=floorArea(90),fp=floorPlan(90,design);
 for(const rows of [deck,floor])assert.equal(rows.some(r=>['floorSeams','platformDeckSkim'].includes(r.id)),false);
 const f=floor.find(r=>r.id==='floorFiller'),d=deck.find(r=>r.id==='platformDeckFiller');
 for(const r of [f,d]){assert.equal(r.productUrl,'https://www.homedepot.com/p/205337025');assert.equal(r.unitPriceCents,1598);assert.equal(r.group,r===f?'floorFinish':'platformFinish');assert.match(r.availability,/#6319/);}
 assert.equal(f.purchaseQuantity,fillerTubs(Math.ceil(area*2.25),fp.topSeamLength,area));assert.equal(d.purchaseQuantity,fillerTubs(plan.deckScrews,plan.deckSeamLength,plan.deckArea));
 // Each row alone (unpooled): the floor needs 3 tubs, the deck 2. Jeff's count is 5 tubs for both.
 assert.deepEqual([f.purchaseQuantity,d.purchaseQuantity],[3,2],`${f.purchaseQuantity} + ${d.purchaseQuantity} tubs`);
 for(const [rows,id] of [[floor,'floorPrimer'],[deck,'platformDeckPrimer']]){const r=rows.find(x=>x.id===id);assert.equal(r.productUrl,'https://www.homedepot.com/p/100205766');assert.match(r.name,/Multi-Surface/);assert.equal(r.purchaseQuantity,1);}
 assert.equal(fillerTubs(0,0,0),1,'never less than one tub');
});

test('Floor labor follows the filler work and both labor notes describe it',()=>{
 const tasks=laborTasks(design),floor=tasks.find(t=>t.id==='floor'),deck=tasks.find(t=>t.id==='platformFinish'),plan=platformPlan(90,18,18,90,design),area=floorArea(90);
 assert.equal(floor.stageHours[25],woodFillHours(Math.ceil(area*2.25),floorPlan(90,design).topSeamLength,area)+fillSandHours(Math.ceil(area*2.25),floorPlan(90,design).topSeamLength,area));
 assert.equal(floor.stageHours[26],area/200*2+primerSandHours(area),'two primer coats with a 220 sand between');assert.equal(floor.stageHours[27],area/200*2,'two paint coats');
 assert.doesNotMatch(floor.note+deck.note,/rent|150 grit/);assert.match(floor.note,/light 180 pass/);assert.match(deck.note,/220 sand between/);
 for(const t of [floor,deck]){assert.match(t.note,/wood filler/);assert.doesNotMatch(t.note+t.label,/skim/i);}
 assert.ok(woodFillHours(plan.deckScrews,plan.deckSeamLength,plan.deckArea)>0);
});

test('The 3D floor and deck read raw, filler spots, then primer and paint',()=>{
 const d=projectUpgradeTracking(live()),set=(id,p)=>{for(const s of d.stages)for(const t of s.steps)if(t.id===id)t.percent=p;},floor=()=>projectPartStatus({kind:'floor'},d).finish;
 assert.equal(floor(),'raw');set('floor-1',30);assert.equal(floor(),'filled');set('floor-sand',100);assert.equal(floor(),'filled');set('floor-3',100);assert.equal(floor(),'primer');set('floor-paint',100);assert.equal(floor(),'paint');
 // An older record that never split the paint step still paints with floor-3.
 assert.equal(projectPartStatus({kind:'floor'},{stages:[{id:'f',steps:[{id:'floor-2',percent:100},{id:'floor-3',percent:100}]}]}).finish,'paint');
 // Filler lines follow the deck framing; nothing under the corner bead, and joints only between deck pieces.
 const plan=platformPlan(90,18,18,90,design);for(let i=0;i<plan.decks.length;i++){const f=deckFillLayout(plan,i);assert.ok(f.lines.length>0&&f.lines.length<=24);assert.ok(f.lines.every(l=>l.length===5&&[6,12].includes(l[4])&&l.every(Number.isFinite)));assert.ok(f.seams.every(([ax,az,bx,bz])=>!onOutline([ax,az],[bx,bz],plan.outline)));}
 assert.ok(plan.decks.some((_,i)=>deckFillLayout(plan,i).seams.length),'the deck joints are filled');
});

test('Building both, the floor and deck share filler tubs and primer gallons',()=>{
 const rows=priceRows(data,{scope:'set',...design}),get=id=>rows.find(r=>r.id===id),plan=platformPlan(90,18,18,90,design),area=floorArea(90);
 const quarts=fillerQuarts(Math.ceil(area*2.25),floorPlan(90,design).topSeamLength,area)+fillerQuarts(plan.deckScrews,plan.deckSeamLength,plan.deckArea);
 assert.equal(get('floorFiller').purchaseQuantity+get('platformDeckFiller').purchaseQuantity,Math.ceil(quarts));
 assert.equal(get('floorPrimer').purchaseQuantity+get('platformDeckPrimer').purchaseQuantity,Math.ceil((area+plan.deckArea)*2/300),'two primer coats over both, pooled');
 for(const id of ['floorFiller','platformDeckFiller','floorPrimer','platformDeckPrimer'])assert.match(get(id).availability,/Shared packs/);
});

test('The guide sands only the filler at 120, makes one light 180 pass, and smooths by sanding the primer',async()=>{
 const src=fs.readFileSync(new URL('../public/guide.js',import.meta.url),'utf8');
 for(const stage of ['[25,','[36,']){const text=src.slice(src.indexOf(stage+"'Fill"),src.indexOf(stage+"'Fill")+2500);assert.match(text,/sand only the filled spots with 120 grit/);assert.match(text,/do not sand the whole surface at 120/);assert.match(text,/one light 180-grit pass/);assert.match(text,/work light held low/);assert.match(text,/feather more filler over any seam lip/);assert.match(text,/respirator and knee pads/);assert.doesNotMatch(text,/rented|150 grit|floor sander/);}
 assert.match(src,/Split the floor over more than one session/);assert.match(src,/never hangs over the vinyl bead/);
 for(const stage of ["[26,'Prime the floor twice","[37,'Prime the platform twice"]){const text=src.slice(src.indexOf(stage),src.indexOf(stage)+900);assert.match(text,/first coat/);assert.match(text,/220 grit/);assert.match(text,/second coat/);assert.match(text,/dust nibs/);}
});

test('The walls get two KILZ 2 coats with a work-light check, a 220 sand and Easy Sand 45 touch-ups between',async()=>{
 const src=fs.readFileSync(new URL('../public/guide.js',import.meta.url),'utf8'),text=src.slice(src.indexOf("[72,'Prime the walls twice"),src.indexOf("[73,'Paint the walls'"));
 const order=['first coat of KILZ 2','rake a work light','mark every flaw in pencil','220 grit','Do not sand through the primer into the compound','Easy Sand 45','spot-prime them','second coat of KILZ 2','very lightly with 220','two coats of Carbon flat'];
 let at=-1;for(const phrase of order){const i=text.indexOf(phrase);assert.ok(i>at,phrase);at=i;}
 const rows=priceRows(data,{scope:'set',...design}),touch=rows.find(r=>r.id==='wallTouchup');assert.equal(touch.productUrl,'https://www.homedepot.com/p/100321610');assert.equal(touch.purchaseQuantity,1);assert.equal(touch.unitPriceCents,1298);
 const up=projectUpgradeTracking({stages:[{id:'wall-finishing',name:'Dress, prime and paint — Walls',notes:[],steps:[{id:'wall-finishing-3',name:'Prime the walls',percent:40,notes:[]}]}]});assert.deepEqual(up.stages[0].steps.map(t=>[t.name,t.percent]),[['Prime the walls twice, with a 220 sand and touch-ups between',40]]);
 const walls=laborTasks(design).find(t=>t.id==='wallFinish');assert.match(walls.note,/two primer coats with a work-light check, 220 sand and Easy Sand 45 touch-ups between/);
});
