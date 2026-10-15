import test from 'node:test';
import assert from 'node:assert/strict';
import {laborFor,laborTasks,JOINT_HOURS_PER_FT} from '../public/labor.js';
import {projectLabor,laborTaskProgress,OBSERVED_RATE_MIN_HOURS} from '../public/projection.js';
import {projectDefaultTracking} from '../public/project-model.js';

const design={floorLip:true,seamlessCorners:true,seamlessCornerSide:'right',seamlessPerimeter:false,height:120,angle:90,platformShape:'square',platformAngle:90,platformBack:18,platformSide:18,platformFront:12,floor:'charcoal'};
const crew=[{name:'Jeff',rateCents:5000},{name:'Helper',rateCents:0}];
const H=3600000,day=Date.UTC(2026,9,8,14);
const shift=(personId,hours,rateCents,i)=>({id:'s'+i,personId,start:day+i*24*H,end:day+i*24*H+hours*H,rateCents,note:''});

test('Once a working day is logged, work still to come is priced at what a person-hour has actually cost',()=>{
 const l=laborFor(design,crew),now=day+30*24*H;
 // The estimate assumes both crew members work every on-site hour, so a person-hour costs half of Jeff's rate.
 const fresh=projectLabor(l,{design,tracking:projectDefaultTracking(),shifts:[],now});
 assert.equal(fresh.observedRateCents,null);
 // Jeff works 10 hours at $50 for every 2 the unpaid helper works: a person-hour has cost $41.67.
 const shifts=[shift('jeff',10,5000,0),shift('helper',2,0,1)],p=projectLabor(l,{design,tracking:projectDefaultTracking(),shifts,now});
 assert.equal(p.observedRateCents,4167);
 const onSite=p.tasks.filter(t=>t.stage!=='Shopping'),expected=onSite.reduce((n,t)=>n+t.remainingExact,0)*5000*10/12;
 assert.ok(Math.abs(p.remainingCents-(expected+Math.round(p.tasks.filter(t=>t.stage==='Shopping').reduce((n,t)=>n+t.remainingExact,0)*5000)))<=1);
 assert.ok(p.remainingCents>fresh.remainingCents,'an unpaid helper working part time no longer halves the cost of the work left');
 // Less than a working day logged keeps the crew-rate estimate.
 const early=projectLabor(l,{design,tracking:projectDefaultTracking(),shifts:[shift('jeff',OBSERVED_RATE_MIN_HOURS-1,5000,0)],now});
 assert.equal(early.observedRateCents,null);
});

test('Floor progress follows where its hours are, so a laid floor leaves only the finishing',()=>{
 const floor=laborTasks(design).find(t=>t.id==='floor'),hours=Object.values(floor.stageHours).reduce((a,b)=>a+b,0);
 assert.ok(Math.abs(hours-floor.personHours)<.1,'stage hours add up to the task');
 const tracking=projectDefaultTracking(),floorStage=tracking.stages.find(s=>s.steps.some(t=>t.id==='floor-upper'));
 for(const t of floorStage.steps)if(['floor-0','floor-2','floor-upper'].includes(t.id))t.percent=100;
 const progress=laborTaskProgress(floor,{design,tracking});
 const built=floor.stageHours[23]+floor.stageHours[24]+floor.stageHours[42];
 assert.equal(progress,Math.round(built/hours*100));assert.ok(progress>50,'more than half the floor hours are in laying the two layers');
});

test('Wall finishing counts every taped joint',()=>{
 const t=laborTasks(design).find(x=>x.id==='wallFinish'),joints=5*10+8*4;
 assert.match(t.note,new RegExp(`^${joints} ft of taped joints`));
 assert.equal(t.personHours,Math.round((1+joints*JOINT_HOURS_PER_FT+320/150+640/200)*10)/10);
});
