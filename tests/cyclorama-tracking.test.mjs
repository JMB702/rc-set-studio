import test from 'node:test';
import assert from 'node:assert/strict';
import {projectBuildDesign,projectDefaultTracking,projectUpgradeTracking,projectGuideGroups,projectGuideStagePercent,projectSetGuideStage,projectPartStatus,projectProgress,projectReconcileGuideChecks,projectCycloramaMilestones} from '../public/project-model.js';
import {guideCompletionMatchesDesign} from '../public/guide-completion.js';
import {progressWeights} from '../public/projection.js';
import {normalizeWorkspace} from '../public/workspace-state.js';
import {stepFasteners} from '../public/step-fasteners.js';
import {cycloramaPlan} from '../public/cyclorama.js';
const design={floorLip:false,height:120,angle:45,floor:'charcoal',platformShape:'angled',platformAngle:45,platformBack:12,platformSide:12,wallColor:'#34383b',platformColor:'#34383b',floorColor:'#34383b',seamlessCorners:true,seamlessCornerSide:'both',seamlessPerimeter:true};
test('Adding retrofit work preserves completed wall counts, old progress, notes and guide IDs',()=>{
 const previous=projectDefaultTracking();previous.design=design;previous.assembly={panelsCompleted:8,jacksBuilt:16,jacksAttached:16,ballastAttached:8,wallsJoined:8,anglesSet:2};
 previous.stages[0].steps[0].notes=[{id:'kept',text:'Already cut',at:1}];previous.stages[0].steps[0].percent=100;
 const existing=projectUpgradeTracking({...previous,design:{...design,seamlessCorners:false,seamlessPerimeter:false}}),next=projectUpgradeTracking(previous);
 assert.deepEqual(next.assembly,previous.assembly);assert.deepEqual(next.stages.filter(s=>s.id!=='cyclorama'),existing.stages);
 assert.deepEqual(next.stages.find(s=>s.id==='cyclorama').steps.map(s=>s.id),Object.keys(projectCycloramaMilestones()));
 assert.ok(next.stages.find(s=>s.id==='cyclorama').steps.every(s=>s.percent===0));assert.deepEqual(projectUpgradeTracking(next),next);
 let completed=projectSetGuideStage(next,43,true,design);assert.equal(projectGuideStagePercent(completed,43,design),100);assert.deepEqual(completed.assembly,next.assembly);
 completed=projectSetGuideStage(completed,47,50,design);const disabled={...design,seamlessCorners:false,seamlessPerimeter:false},weights=progressWeights(disabled);
 assert.equal(projectProgress(completed,weights).total,existing.stages.flatMap(s=>s.steps).length,'inactive optional work is absent from completion count');
 assert.ok(Object.keys(projectCycloramaMilestones()).every(id=>weights[id]===0));
 assert.deepEqual(projectUpgradeTracking({...completed,design:disabled}).stages,completed.stages,'disabling retains saved work for later restoration');
 assert.equal(projectGuideStagePercent(completed,47,design),50);
});
test('Guide stage mappings exclude disabled options and flat walls',()=>{
 assert.ok(!projectGuideGroups({...design,seamlessPerimeter:false})['cyc-compound-1-ribs']);assert.ok(!projectGuideGroups({...design,angle:0})['cyc-corner-1-ribs']);
 const initial=projectDefaultTracking(design);assert.throws(()=>projectSetGuideStage(initial,47,true,{...design,seamlessPerimeter:false}),/not part/);
 const checked=projectSetGuideStage(initial,47,true,design),manual=structuredClone(checked);manual.stages.find(s=>s.id==='cyclorama').steps.find(t=>t.id==='cyc-compound-1-ribs').percent=0;
 assert.equal(projectReconcileGuideChecks(checked,manual).guideChecks['set:47'],undefined);
});
test('Cove mesh progress requires its retrofit backing and relevant skin, independently of old wall finishing',()=>{
 let d=projectDefaultTracking(design);d=projectSetGuideStage(d,45,true,design);assert.equal(projectPartStatus({kind:'cyclorama',stage:45},d).assembled,false);
 for(const stage of [43,44])d=projectSetGuideStage(d,stage,true,design);
 assert.deepEqual(projectPartStatus({kind:'cyclorama',stage:45},d),{assembled:true,finish:'raw'});
 for(const stage of [46,47,48])d=projectSetGuideStage(d,stage,true,design);
 assert.deepEqual(projectPartStatus({kind:'cyclorama',stage:47},d),{assembled:true,finish:'paint'});
});
test('Build design and workspace preserve options and requested gaps through stage62',()=>{
 assert.deepEqual(projectBuildDesign(design),design);assert.equal(projectBuildDesign({...design,seamlessCorners:undefined}).seamlessCorners,false);
 assert.throws(()=>projectBuildDesign({...design,seamlessPerimeter:'yes'}),/Invalid/);
 const saved=normalizeWorkspace({version:1,mode:'build',design,stage:62});assert.equal(saved.stage,62);assert.equal(saved.design.platformBack,12);assert.equal(saved.design.seamlessPerimeter,true);
 assert.throws(()=>normalizeWorkspace({version:1,mode:'build',design,stage:63}),/stage/);
 assert.equal(guideCompletionMatchesDesign({design},{...design,seamlessPerimeter:false}),false);assert.equal(guideCompletionMatchesDesign({design},design),true);
});
test('Guide fastener allowance matches retrofit pricing quantity basis',()=>{
 const p=cycloramaPlan(design),anchors=stepFasteners(43,120,'charcoal',design)[0];assert.equal(anchors.quantity,(p.floorRibs+p.compoundRibs)*4);assert.equal(stepFasteners(49,120,'charcoal',design)[0].quantity,p.ribBackScrews/p.corners);
 const skin=stepFasteners(45,120,'charcoal',design)[0];assert.match(skin.note,new RegExp('^'+(p.fasteners-p.ribCount*4)+' planned'));
 for(const stage of [43,44,45,46,47,48])assert.ok(stepFasteners(stage,120,'charcoal',design).every(row=>row.title&&row.note));
});
