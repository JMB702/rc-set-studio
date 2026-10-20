import test from 'node:test';
import assert from 'node:assert/strict';
import {projectDefaultTracking,projectUpgradeTracking,projectValidate,projectSetStepCount,projectPartStatus,projectGuideGroups,projectVisibleTracking,PROJECT_COUNTED_STEPS} from '../public/project-model.js';

const design={floorLip:true,seamlessCorners:true,seamlessCornerSide:'right',seamlessPerimeter:false,height:120,angle:90,floor:'charcoal',platformShape:'square',platformAngle:90,platformBack:18,platformSide:18,wallColor:'#34383b',platformColor:'#34383b',floorColor:'#34383b'};
// The wall finishing stage as Jeff's tracker held it on 2026-10-19, before plastering was one counted step.
function before(){const d=projectDefaultTracking(design),stage=d.stages.find(s=>s.id==='wall-finishing');
 stage.steps=['Dress seams and corners','Fill and feather joints','Sand and clean surfaces','Prime the walls','Paint the walls'].map((name,i)=>({id:`wall-finishing-${i}`,name,percent:i<2?100:0,notes:i===0?[{id:'n1',text:'Started with the corner seams.',at:1}]:[],completedAt:i===0?1792446480000:i===1?1792446600000:null}));
 return d;}
const steps=d=>d.stages.find(s=>s.id==='wall-finishing').steps;

test('Dressing and filling merge into one plaster step counted in coats; sanding is counted in rounds',()=>{
 const up=projectUpgradeTracking(before()),rows=steps(up);
 assert.deepEqual(rows.map(t=>t.id),['wall-finishing-1','wall-finishing-2','wall-finishing-3','wall-finishing-4']);
 assert.deepEqual(rows.map(t=>t.name),['Apply plaster to joints, corners and fasteners','Sand and clean surfaces','Prime the walls','Paint the walls']);
 assert.deepEqual(rows[0].notes.map(n=>n.text),['Started with the corner seams.'],'the merged step keeps the dressing notes');
 assert.equal(rows[0].completedAt,1792446600000,'and its own completion time');
 assert.deepEqual(rows[0].count,{done:2,planned:2});assert.deepEqual(rows[1].count,{done:0,planned:2});
 assert.equal(projectUpgradeTracking(up),up,'the upgrade runs once');
 // Jeff's actual state: one coat on, at least two planned, no sanding yet.
 const jeff=projectSetStepCount(up,'wall-finishing-1',{done:1});assert.equal(steps(jeff)[0].percent,50);assert.deepEqual(steps(jeff)[0].count,{done:1,planned:2});
 assert.deepEqual(steps(projectValidate('tracking',jeff))[0].count,{done:1,planned:2},'saving keeps the count');
});

test('Coats and rounds are flexible within limits, and a plain checkbox sets every pass',()=>{
 let d=projectUpgradeTracking(before());d=projectSetStepCount(d,'wall-finishing-1',{done:1});
 d=projectSetStepCount(d,'wall-finishing-1',{planned:3});assert.deepEqual(steps(d)[0].count,{done:1,planned:3});assert.equal(steps(d)[0].percent,33);
 d=projectSetStepCount(d,'wall-finishing-1',{planned:0});assert.deepEqual(steps(d)[0].count,{done:1,planned:1},'never fewer passes planned than done, or none');
 d=projectSetStepCount(d,'wall-finishing-1',{done:9});assert.deepEqual(steps(d)[0].count,{done:PROJECT_COUNTED_STEPS['wall-finishing-1'].max,planned:PROJECT_COUNTED_STEPS['wall-finishing-1'].max});
 assert.throws(()=>projectSetStepCount(d,'wall-finishing-3',{done:1}),/not counted/);
 const checked=structuredClone(d);steps(checked)[1].percent=100;assert.deepEqual(steps(projectValidate('tracking',checked))[1].count,{done:2,planned:2},'checking the box marks every round');
 const cleared=structuredClone(d);steps(cleared)[0].percent=0;assert.deepEqual(steps(projectValidate('tracking',cleared))[0].count.done,0,'unchecking clears every coat');
 const bad=structuredClone(d);steps(bad)[0].count={done:3,planned:2};assert.throws(()=>projectValidate('tracking',bad),/coat and sanding/);
 const stray=structuredClone(d);steps(stray)[2].count={done:1,planned:2};assert.throws(()=>projectValidate('tracking',stray),/coat and sanding/);
});

test('The rounded corner is finished with the walls: raw, then plaster from the first coat, then primer and paint',()=>{
 let d=projectUpgradeTracking(before());for(const s of d.stages)for(const t of s.steps)if(t.id==='cyc-corner-2-ribs'||t.id==='cyc-corner-2-skin')t.percent=100;
 d=projectSetStepCount(d,'wall-finishing-1',{done:0});
 const corner=data=>projectPartStatus({kind:'cyclorama',stage:52,component:'corner-2',phase:'skin'},data),wall=data=>projectPartStatus({kind:'wallSkin',panel:4,front:true},{...data,assembly:{panelsCompleted:8}});
 assert.deepEqual(corner(d),{assembled:true,finish:'raw'});assert.equal(wall(d).finish,'raw');
 d=projectSetStepCount(d,'wall-finishing-1',{done:1});assert.equal(corner(d).finish,'seams');assert.equal(wall(d).finish,'seams');
 for(const t of steps(d))if(t.id==='wall-finishing-3')t.percent=100;assert.equal(corner(d).finish,'primer');
 for(const t of steps(d))if(t.id==='wall-finishing-4')t.percent=100;assert.equal(corner(d).finish,'paint');assert.equal(wall(d).finish,'paint');
 // A floor-cove perimeter still has its own finish step.
 const cove={...d,design:{...design,seamlessPerimeter:true}};assert.equal(corner(cove).finish,'raw');
});

test('Build guide links: plaster step 28 checks plastering and sanding; the corner has no separate finish row unless there is a perimeter',()=>{
 const groups=projectGuideGroups(design);
 assert.equal(groups['wall-finishing-0'],undefined);assert.deepEqual(groups['wall-finishing-1'],[28]);assert.deepEqual(groups['wall-finishing-2'],[28]);assert.deepEqual(groups['wall-finishing-3'],[72]);assert.deepEqual(groups['wall-finishing-4'],[73]);
 assert.equal(groups['cyc-finish'],undefined);assert.deepEqual(projectGuideGroups({...design,seamlessPerimeter:true})['cyc-finish'],[48]);
 const visible=projectVisibleTracking(projectUpgradeTracking(before()),design).stages.flatMap(s=>s.steps).map(t=>t.id);
 assert.ok(!visible.includes('cyc-finish'));assert.ok(!visible.includes('wall-finishing-0'));
 // Every other guide stage keeps its tracker link.
 for(const [id,stages] of Object.entries(projectGuideGroups({...design,seamlessCorners:false})))if(!/^wall-finishing/.test(id))assert.deepEqual(groups[id],stages,id);
});
