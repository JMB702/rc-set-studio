import test from 'node:test';
import assert from 'node:assert/strict';
import {projectDefaultTracking,projectUpgradeTracking,projectValidate,projectPartStatus,projectGuideGroups,projectProgress} from '../public/project-model.js';

const design={floorLip:true,seamlessCorners:true,seamlessCornerSide:'right',seamlessPerimeter:false,height:120,angle:90,floor:'charcoal',platformShape:'square',platformAngle:90,platformBack:18,platformSide:18,wallColor:'#34383b',platformColor:'#34383b',floorColor:'#34383b'};
const finish=d=>d.stages.find(s=>s.id==='platform-finishing').steps;
// The platform finish as Jeff's tracker held it on 2026-10-20, before the bead had its own step.
function before(){const d=projectDefaultTracking(design);const stage=d.stages.find(s=>s.id==='platform-finishing');stage.steps=stage.steps.filter(t=>t.id!=='platform-bead');
 stage.steps.find(t=>t.id==='platform-seams').notes=[{id:'n1',text:'Corners first.',at:1}];d.stages.find(s=>s.id==='platform').steps.forEach(t=>t.percent=100);return d;}

test('Attaching the vinyl corner bead is the first platform finishing step, added unchecked to older trackers',()=>{
 assert.deepEqual(finish(projectDefaultTracking(design)).map(t=>[t.id,t.name,t.percent]),[['platform-bead','Attach vinyl corner bead',0],['platform-seams','Patch seams and corners',0],['platform-skim','Cement-skim deck and finish fascia',0],['platform-prime','Prime the platform',0],['platform-paint','Paint the platform',0]]);
 const old=before(),up=projectUpgradeTracking(old);
 assert.deepEqual(finish(up).map(t=>t.id),['platform-bead','platform-seams','platform-skim','platform-prime','platform-paint']);
 assert.equal(finish(up)[0].percent,0,'Jeff checks it off himself');
 assert.deepEqual(finish(up).slice(1),finish(old),'the other steps keep their progress and notes');
 assert.deepEqual(up.stages.filter(s=>s.id!=='platform-finishing'),old.stages.filter(s=>s.id!=='platform-finishing'));
 assert.equal(projectUpgradeTracking(up),up,'the upgrade runs once');
 assert.deepEqual(finish(projectValidate('tracking',up)).map(t=>t.id),finish(up).map(t=>t.id),'and saves');
 assert.equal(projectProgress(up).total,projectProgress(old).total+1);
 // A tracker with no platform finishing rows gains nothing.
 const bare={stages:[{id:'walls',name:'Walls',notes:[],steps:[{id:'walls-0',name:'Cut',percent:0,notes:[]}]}]};assert.equal(projectUpgradeTracking(bare).stages.flatMap(s=>s.steps).some(t=>t.id==='platform-bead'),false);
});

test('The Build guide bead stage (79) checks off the bead step; patching seams keeps the skim stage',()=>{
 for(const platformShape of ['angled','square'])for(const floor of ['none','wood','charcoal']){const g=projectGuideGroups({...design,platformShape,floor});assert.deepEqual(g['platform-bead'],[79]);assert.deepEqual(g['platform-seams'],[36]);assert.equal(Object.values(g).flat().filter(s=>s===79).length,1);}
 assert.equal(projectGuideGroups({...design,platformShape:'none'})['platform-bead'],undefined);
});

test('The bead shows once its step starts, is buried by compound and skim, then primed and painted with the platform',()=>{
 const set=(d,id,p)=>{for(const s of d.stages)for(const t of s.steps)if(t.id===id)t.percent=p;return d;},bead={kind:'platformBead',stage:79};
 const d=projectUpgradeTracking(before());
 assert.deepEqual(projectPartStatus(bead,d),{assembled:false,finish:'raw'},'ghosted at 0%');
 set(d,'platform-bead',100);assert.deepEqual(projectPartStatus(bead,d),{assembled:true,finish:'raw'},'bare vinyl at 100%');
 set(d,'platform-seams',50);assert.equal(projectPartStatus(bead,d).finish,'seams');
 set(d,'platform-skim',10);assert.equal(projectPartStatus(bead,d).finish,'skim');
 set(d,'platform-prime',100);assert.equal(projectPartStatus(bead,d).finish,'primer');
 set(d,'platform-paint',100);assert.deepEqual(projectPartStatus(bead,d),{assembled:true,finish:'paint'});
 set(d,'platform-bead',0);assert.equal(projectPartStatus(bead,d).assembled,false);
});
