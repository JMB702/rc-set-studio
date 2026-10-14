import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {priceRows,summary,materialTax,pricingBudget} from '../public/pricing-calc.js';
import {laborFor,laborEstimate,setLaborCrew,costSummary} from '../public/labor.js';
import {cycloramaPlan,cycloramaPath,cycloramaCornerSides} from '../public/cyclorama.js';
import {projectCost} from '../public/projection.js';
import {projectDefaultTracking,projectGuideGroups,projectBuildDesign} from '../public/project-model.js';
import {normalizeDesign} from '../public/pricing-config.js';
import {guideCompletionMatchesDesign} from '../public/guide-completion.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/flat-shopping-list.json',import.meta.url),'utf8'));
const base={scope:'set',height:120,angle:45,floor:'charcoal',platformShape:'square',platformAngle:90,platformBack:12,platformSide:12};
const corners=(side,perimeter=false)=>side==='off'?{...base,seamlessCorners:false,seamlessPerimeter:perimeter}:{...base,seamlessCorners:true,seamlessCornerSide:side,seamlessPerimeter:perimeter};

test('One rounded corner builds exactly one corner, mirrored left to right',()=>{
 assert.deepEqual(cycloramaCornerSides(corners('left')),['left']);assert.deepEqual(cycloramaCornerSides(corners('right')),['right']);
 assert.deepEqual(cycloramaCornerSides(corners('both')),['left','right']);assert.deepEqual(cycloramaCornerSides({...base,seamlessCorners:true}),['left','right'],'older designs with no side meant both');
 assert.deepEqual(cycloramaCornerSides({...corners('left'),angle:0}),[],'straight walls have no corner to round');
 for(const perimeter of [false,true]){
  const off=cycloramaPlan(corners('off',perimeter)),left=cycloramaPlan(corners('left',perimeter)),right=cycloramaPlan(corners('right',perimeter)),both=cycloramaPlan(corners('both',perimeter));
  assert.equal(left.corners,1);assert.equal(both.corners,2);
  for(const key of ['ribCount','verticalRibs','floorRibs','compoundRibs','skinArea','skinSheets','ribSheets','blockingFeet','fasteners','tapeFeet','compoundPails','straightLength'])assert.equal(left[key],right[key],`${key} is the same for either side`);
  assert.equal(left.verticalRibs*2,both.verticalRibs);assert.equal(left.compoundRibs*2,both.compoundRibs);
  assert.ok(left.ribCount>off.ribCount&&left.ribCount<both.ribCount);assert.ok(left.skinArea>off.skinArea&&left.skinArea<both.skinArea);
  if(perimeter){assert.equal(left.runs.left,96-left.tangent);assert.equal(left.runs.right,96,'the sharp side keeps its full cove run');assert.equal(left.runs.back,192-left.tangent);}
 }
 const path=cycloramaPath(corners('left',true)),arcs=path.filter(s=>s.kind==='corner');
 assert.deepEqual(arcs.map(s=>s.side),[-1],'left is the negative-x wing corner');
 const back=path.find(s=>s.kind==='back'),right=path.find(s=>s.kind==='right');assert.deepEqual(back.points[1],right.points[0],'the sharp corner meets at one miter point');
});

test('Cost, labor and the Cost projection change with every corner and perimeter choice',()=>{
 setLaborCrew([{name:'Builder',rateCents:5000},{name:'Helper',rateCents:3000}]);
 try{for(const perimeter of [false,true]){
  const totals={};
  for(const side of ['off','left','right','both']){
   const d=corners(side,perimeter),rows=priceRows(data,d),l=laborFor(d),p=projectCost({rows,finance:{expenses:[],shifts:[]},tracking:projectDefaultTracking(),design:d,labor:l}),budget=pricingBudget(data,{...d,excluded:[],customItems:[]},l);
   assert.equal(p.estimateCents,budget.totalCents,'projection equals the Pricing guide estimate');assert.equal(costSummary(data,d).totalCents,budget.totalCents,'approval estimate matches');
   assert.equal(p.estimateCents,summary(rows).subtotal+materialTax(rows)+l.costCents);
   totals[side]={cost:p.estimateCents,hours:laborEstimate(d).personHours,caulk:rows.find(r=>r.id==='wallCornerCaulk')?.purchaseQuantity??0};
  }
  assert.ok(totals.off.cost<totals.left.cost&&totals.left.cost<totals.both.cost,`square corners are cheapest, one rounded corner in between (perimeter ${perimeter})`);
  assert.equal(totals.left.cost,totals.right.cost);assert.ok(totals.off.hours<totals.left.hours&&totals.left.hours<totals.both.hours);
  assert.ok(totals.left.caulk>0,'the sharp corner is still caulked');assert.equal(totals.both.caulk,0);
 }}finally{setLaborCrew(null);}
});

test('Tracker, approvals and build design keep the chosen side',()=>{
 const left=projectGuideGroups(corners('left',true)),right=projectGuideGroups(corners('right',true)),both=projectGuideGroups(corners('both',true));
 for(const id of ['cyc-corner-1-ribs','cyc-corner-1-skin','cyc-compound-1-ribs','cyc-compound-1-skin']){assert.ok(left[id]);assert.ok(!right[id]);assert.ok(both[id]);}
 for(const id of ['cyc-corner-2-ribs','cyc-corner-2-skin','cyc-compound-2-ribs','cyc-compound-2-skin']){assert.ok(!left[id]);assert.ok(right[id]);assert.ok(both[id]);}
 for(const id of ['cyc-perimeter-left-ribs','cyc-perimeter-right-skin','cyc-perimeter-back-ribs'])assert.ok(left[id],'every perimeter run is still built');
 const design={...corners('left'),wallColor:'#34383b',platformColor:'#34383b',floorColor:'#34383b'};
 assert.equal(normalizeDesign(design).seamlessCornerSide,'left');assert.equal(normalizeDesign({...design,seamlessCornerSide:undefined}).seamlessCornerSide,'both');
 assert.throws(()=>normalizeDesign({...design,seamlessCornerSide:'middle'}),/side/);
 assert.equal(projectBuildDesign(design).seamlessCornerSide,'left');assert.throws(()=>projectBuildDesign({...design,seamlessCornerSide:'up'}),/Invalid/);
 assert.equal(guideCompletionMatchesDesign({design},{...design,seamlessCornerSide:'right'},49),false,'retrofit checkoffs need the same side');
 assert.equal(guideCompletionMatchesDesign({design:{...design,seamlessCorners:false}},{...design,seamlessCorners:false,seamlessCornerSide:'right'},49),true,'side is ignored while corners are off');
 assert.equal(guideCompletionMatchesDesign({design:{...corners('both'),seamlessCornerSide:undefined}},corners('both'),49),true,'older records meant both');
});
