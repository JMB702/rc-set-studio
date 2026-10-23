import test from 'node:test';
import assert from 'node:assert/strict';
import {laborFor,laborTasks,JOINT_HOURS_PER_FT} from '../public/labor.js';
import {projectLabor,laborTaskProgress,OBSERVED_RATE_MIN_HOURS} from '../public/projection.js';
import {projectDefaultTracking,projectSetAssemblyCounts} from '../public/project-model.js';

const design={floorLip:true,seamlessCorners:true,seamlessCornerSide:'right',seamlessPerimeter:false,height:120,angle:90,platformShape:'square',platformAngle:90,platformBack:18,platformSide:18,platformFront:12,floor:'charcoal'};
const crew=[{name:'Jeff',rateCents:5000},{name:'Helper',rateCents:0}];
const H=3600000,day=Date.UTC(2026,9,8,14);
const shift=(personId,hours,rateCents,i)=>({id:'s'+i,personId,start:day+i*24*H,end:day+i*24*H+hours*H,rateCents,note:''});

test('Remaining work follows the crew: removing a person adds time and cost, adding one removes them',()=>{
 const l=laborFor(design,crew),now=day+30*24*H,tracking=projectDefaultTracking();
 const people=[{id:'jeff',name:'Jeff',rateCents:5000,archived:false},{id:'helper',name:'Helper',rateCents:0,archived:false}];
 // Jeff works 10 hours for every 2 the unpaid helper works: Jeff is on site every hour, the helper 20% of them.
 const shifts=[shift('jeff',10,5000,0),shift('helper',2,0,1)],run=c=>projectLabor(l,{design,tracking,shifts,crew:c,now});
 const both=run(people);
 assert.deepEqual(both.crew.map(p=>[p.name,Math.round(p.share*100)]),[['Jeff',100],['Helper',20]]);
 assert.equal(both.effectiveWorkers,1.2);assert.equal(both.ratePerPersonHourCents,4167);
 const build=both.tasks.filter(t=>t.stage!=='Shopping').reduce((n,t)=>n+t.remainingExact,0);
 assert.ok(Math.abs(both.remainingOnSiteHours-Math.round(build/1.2*10)/10)<.11);
 // Jeff alone: every remaining hour is his, so it takes longer on site and costs more.
 const alone=run([people[0],{...people[1],archived:true}]);
 assert.equal(alone.ratePerPersonHourCents,5000);assert.ok(alone.remainingOnSiteHours>both.remainingOnSiteHours);assert.ok(alone.remainingCents>both.remainingCents);
 // A new unpaid worker with no history counts as full time: shorter and cheaper.
 const more=run([...people,{id:'new',name:'New',rateCents:0,archived:false}]);
 assert.equal(more.effectiveWorkers,2.15);assert.ok(more.remainingOnSiteHours<both.remainingOnSiteHours);assert.ok(more.remainingCents<both.remainingCents);
 // A paid new worker splits the cost by the time each person is on site.
 const paid=run([...people,{id:'new',name:'New',rateCents:3000,archived:false}]);
 assert.equal(paid.ratePerPersonHourCents,Math.round((5000+3000)/2.15));
 // Under a working day logged: the estimate's crew pricing, as before.
 assert.equal(projectLabor(l,{design,tracking,shifts:[shift('jeff',OBSERVED_RATE_MIN_HOURS-1,5000,0)],crew:people,now}).crew,null);
});

test('Remaining build work scales by the pace logged on the work already done',()=>{
 const l=laborFor(design,crew),now=day+30*24*H,tracking=projectSetAssemblyCounts(projectDefaultTracking(),{panelsCompleted:8,jacksBuilt:16},design);
 const jacks=l.tasks.find(t=>t.id==='jacks'),frames=l.tasks.find(t=>t.id==='frames');
 // Frames and jacks are done and took 80% of their estimate; everything else marked done has no time logged.
 const logged=(frames.personHours+jacks.personHours)*.8,shifts=[{...shift('jeff',frames.personHours*.8,5000,0),taskId:'frames'},{...shift('jeff',jacks.personHours*.8,5000,1),taskId:'jacks'}];
 const p=projectLabor(l,{design,tracking,shifts,crew:[{id:'jeff',name:'Jeff',rateCents:5000,archived:false}],now});
 const setupDone=l.tasks.find(t=>t.id==='setup').personHours*p.tasks.find(t=>t.id==='setup').progress/100;
 assert.ok(Math.abs(p.pace-Math.round(logged/(frames.personHours+jacks.personHours+setupDone)*1000)/1000)<.002,'only logged work and setup measure pace');
 const wall=p.tasks.find(t=>t.id==='wallFinish');assert.ok(Math.abs(wall.remaining-Math.round(l.tasks.find(t=>t.id==='wallFinish').personHours*p.pace*100)/100)<.02);
 // Without enough history there is no pace and the plan's hours stand.
 assert.equal(projectLabor(l,{design,tracking,shifts:shifts.slice(0,1).map(s=>({...s,end:s.start+2*H})),now}).pace,null);
});

test('Floor progress follows where its hours are, so a laid floor leaves only the finishing',()=>{
 const floor=laborTasks(design).find(t=>t.id==='floor'),hours=Object.values(floor.stageHours).reduce((a,b)=>a+b,0);
 assert.ok(Math.abs(hours-floor.personHours)<.1,'stage hours add up to the task');
 const tracking=projectDefaultTracking(),floorStage=tracking.stages.find(s=>s.steps.some(t=>t.id==='floor-upper'));
 for(const t of floorStage.steps)if(['floor-0','floor-2','floor-upper'].includes(t.id))t.percent=100;
 const progress=laborTaskProgress(floor,{design,tracking});
 const built=floor.stageHours[23]+floor.stageHours[24]+floor.stageHours[42];
 assert.equal(progress,Math.round(built/hours*100));assert.ok(progress>25&&progress<60,'laying the two layers is a large share; wood filler and full sanding rounds take most of the rest');
});

test('Wall finishing counts every taped joint',()=>{
 const t=laborTasks(design).find(x=>x.id==='wallFinish'),joints=5*10+8*4;
 assert.match(t.note,new RegExp(`^${joints} ft of taped joints`));
 assert.equal(t.personHours,Math.round((1+joints*JOINT_HOURS_PER_FT+320/150+640/200)*10)/10);
});
