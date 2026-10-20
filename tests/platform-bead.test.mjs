import test from 'node:test';
import assert from 'node:assert/strict';
import {projectDefaultTracking,projectUpgradeTracking,projectPartStatus,projectGuideGroups,projectValidate} from '../public/project-model.js';

const steps=d=>d.stages.find(s=>s.id==='platform-finishing').steps;
const set=(d,id,percent)=>{d.stages.flatMap(s=>s.steps).find(t=>t.id===id).percent=percent;};
const withoutBead=()=>{const d=structuredClone(projectDefaultTracking());for(const s of d.stages)s.steps=s.steps.filter(t=>t.id!=='platform-bead');return d;};

test('Corner bead is the first platform finishing step, added once to existing trackers',()=>{
 assert.deepEqual(steps(projectDefaultTracking()).map(s=>s.id),['platform-bead','platform-seams','platform-skim','platform-prime','platform-paint']);
 const old=withoutBead(),next=projectUpgradeTracking(old);
 assert.deepEqual(steps(next)[0],{id:'platform-bead',name:'Attach vinyl corner bead',percent:0,notes:[]});
 assert.equal(projectUpgradeTracking(next),next,'upgrading again changes nothing');
 assert.ok(!steps(old).some(s=>s.id==='platform-bead'),'the input is not mutated');
 projectValidate('tracking',next);
 // A platform already being mudded has its bead on.
 const mudded=withoutBead();set(mudded,'platform-seams',40);assert.equal(steps(projectUpgradeTracking(mudded))[0].percent,100);
});

test('The bead shows once attached, then takes the mud, skim, primer and paint',()=>{
 const d=projectDefaultTracking(),bead={kind:'platformBead'};
 assert.deepEqual(projectPartStatus(bead,d),{assembled:false,finish:'raw'});
 set(d,'platform-bead',100);assert.deepEqual(projectPartStatus(bead,d),{assembled:true,finish:'raw'});
 set(d,'platform-seams',50);assert.equal(projectPartStatus(bead,d).finish,'raw','still vinyl until the corners are mudded');
 for(const [id,finish] of [['platform-seams','seams'],['platform-skim','skim'],['platform-prime','primer'],['platform-paint','paint']]){set(d,id,100);assert.equal(projectPartStatus(bead,d).finish,finish);}
});

test('The Build guide checks the bead stage from the bead step, not the seams step',()=>{
 const groups=projectGuideGroups({height:120,floor:'charcoal',platformShape:'square'});
 assert.deepEqual(groups['platform-bead'],[79]);assert.deepEqual(groups['platform-seams'],[36]);
});
