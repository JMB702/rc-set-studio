import test from 'node:test';
import assert from 'node:assert/strict';
import {projectSplitShift,projectShiftCost,projectDefaultTracking,projectValidate,projectDefaultFinance} from '../public/project-model.js';
import {projectLabor,NON_BUILD_ACTIVITIES} from '../public/projection.js';
import {laborFor} from '../public/labor.js';

const H=3600000,start=Date.UTC(2026,9,13,14,25),end=start+10.22*H;
const shift={id:'day',personId:'person-1',start,end,rateCents:5000,note:'Joining day',taskId:null};
const design={height:120,angle:90,floor:'charcoal',floorLip:true,platformShape:'square',platformAngle:90,platformBack:18,platformSide:18,platformFront:12,seamlessCorners:true,seamlessCornerSide:'right',seamlessPerimeter:false};

test('Splitting a time entry keeps the person, rate, note, hours and cost',()=>{
 const at=start+5*H,[a,b]=projectSplitShift(shift,at,{before:'shopWork',id:'day-2',now:end+H});
 assert.deepEqual([a.start,a.end,a.taskId,b.start,b.end,b.taskId,b.id],[start,at,'shopWork',at,end,null,'day-2']);
 for(const k of ['personId','rateCents','note'])assert.equal(a[k],shift[k]),assert.equal(b[k],shift[k]);
 const cost=s=>projectShiftCost(s,end+H);assert.ok(Math.abs(cost(a).hours+cost(b).hours-cost(shift).hours)<1e-9);assert.ok(Math.abs(cost(a).cents+cost(b).cents-cost(shift).cents)<=1);
 assert.throws(()=>projectSplitShift(shift,start),/inside the entry/);assert.throws(()=>projectSplitShift(shift,end),/inside the entry/);
 // The halves are back to back, so they pass the overlap check.
 const finance={...projectDefaultFinance(),shifts:[a,b]};finance.crew[0].id='person-1';assert.doesNotThrow(()=>projectValidate('finance',finance,end+H));
});

test('Not-build time is spent money but never build work; shopping time lands on shopping',()=>{
 const l=laborFor(design,[{name:'Jeff',rateCents:5000}]),now=end+H,tracking=projectDefaultTracking();
 const shifts=[{...shift,end:start+5*H,taskId:NON_BUILD_ACTIVITIES[0].id},{...shift,id:'shop',start:start+8*H,end:start+10*H,taskId:'shoppingRemaining'}];
 const p=projectLabor(l,{design,tracking,shifts,now});
 assert.equal(p.nonBuildHours,5);assert.equal(p.unassignedHours,0);
 assert.equal(p.tasks.filter(t=>t.stage!=='Shopping').reduce((n,t)=>n+t.actual,0),0,'no build stage absorbs the warehouse hours');
 assert.equal(p.tasks.find(t=>t.id==='shoppingRemaining').actual,2);
 assert.equal(p.actualHours,7);assert.equal(p.actualCents,7*5000);
});
