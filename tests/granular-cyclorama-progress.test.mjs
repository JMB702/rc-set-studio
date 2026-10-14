import test from 'node:test';
import assert from 'node:assert/strict';
import {projectCycloramaComponents,projectDefaultTracking,projectUpgradeCyclorama,projectUpgradeTracking,projectGuideGroups,projectGuideStagePercent,projectGuideStageDone,projectSetGuideStage,projectSetAssemblyCounts,projectStepPercent,projectPartStatus,projectReconcileGuideChecks,projectStampProgress,projectValidate} from '../public/project-model.js';
const design={height:120,angle:90,floor:'charcoal',platformShape:'square',platformAngle:90,platformBack:12,platformSide:12,wallColor:'#34383b',floorColor:'#34383b',platformColor:'#34383b',seamlessCorners:true,seamlessPerimeter:true};
const rows=d=>d.stages.flatMap(s=>s.steps),row=(d,id)=>rows(d).find(t=>t.id===id);
const part=(component,phase)=>({kind:'cyclorama',stage:component.startsWith('compound')?47:component.startsWith('perimeter')?46:phase==='ribs'?44:45,component,phase});

test('Each physical corner and perimeter has independent ribs and skin guide/tracker records',()=>{
 const components=projectCycloramaComponents(),groups=projectGuideGroups(design);
 assert.equal(components.length,14);assert.equal(new Set(components.map(c=>c.id)).size,14);assert.deepEqual(components.map(c=>c.stage),Array.from({length:14},(_,i)=>i+49));
 let d=projectDefaultTracking(design);
 for(const c of components){assert.deepEqual(groups[c.id],[c.stage,c.aggregate]);assert.equal(projectGuideStagePercent(d,c.stage,design),0);}
 d=projectSetGuideStage(d,49,true,design);assert.equal(row(d,'cyc-corner-1-ribs').percent,100);assert.equal(row(d,'cyc-corner-2-ribs').percent,0);assert.equal(projectGuideStagePercent(d,44,design),50);assert.equal(projectGuideStagePercent(d,49,design),100);
 d=projectSetGuideStage(d,50,30,design);assert.equal(projectGuideStagePercent(d,44,design),65);assert.equal(row(d,'cyc-corner-1-ribs').percent,100);
 d=projectSetGuideStage(d,44,false,design);assert.equal(row(d,'cyc-corner-1-ribs').percent,0);assert.equal(row(d,'cyc-corner-2-ribs').percent,0);
 d=projectSetGuideStage(d,46,100,design);assert.ok(components.filter(c=>c.aggregate===46).every(c=>row(d,c.id).percent===100));assert.equal(row(d,'cyc-compound-1-ribs').percent,0);
 projectValidate('tracking',d);
});

test('Legacy retrofit migration preserves partial work, notes, dates and original logs without choosing a finished side',()=>{
 const note={id:'note',text:'Keep the original context',at:1000},log=[{step:'cyc-ribs',from:0,to:50,at:1000},{step:'cyc-perimeter',from:0,to:100,at:2000}];
 const old=projectDefaultTracking();old.design=design;old.assembly={panelsCompleted:8,wallsJoined:7,anglesSet:2};old.progressLog=log;
 old.stages.push({id:'cyclorama',name:'Seamless retrofit',notes:[],steps:[{id:'cyc-backing',name:'Survey',percent:100,notes:[],completedAt:500},{id:'cyc-ribs',name:'Corner ribs',percent:50,notes:[note],completedAt:null},{id:'cyc-skin',name:'Corner skins',percent:0,notes:[]},{id:'cyc-perimeter',name:'Floor perimeter',percent:100,notes:[],completedAt:2000},{id:'cyc-junctions',name:'Floor corners',percent:25,notes:[]},{id:'cyc-finish',name:'Finish',percent:0,notes:[]}]});
 const next=projectUpgradeCyclorama(old);assert.deepEqual(next.assembly,old.assembly);assert.deepEqual(next.progressLog,log);assert.deepEqual(next.stages.filter(s=>s.id!=='cyclorama'),old.stages.filter(s=>s.id!=='cyclorama'));
 assert.equal(row(next,'cyc-corner-1-ribs').percent,50);assert.equal(row(next,'cyc-corner-2-ribs').percent,50);assert.equal(row(next,'cyc-corner-2-ribs').completedAt,null);assert.deepEqual(rows(next).flatMap(t=>t.notes),[note]);
 for(const c of projectCycloramaComponents().filter(c=>c.aggregate===46)){assert.equal(row(next,c.id).percent,100);assert.equal(row(next,c.id).completedAt,2000);}
 assert.equal(projectStepPercent(next,'cyc-junctions'),25);assert.equal(projectUpgradeCyclorama(next),next);
 const stamped=projectStampProgress(old,next,3000);assert.deepEqual(stamped.progressLog,log,'splitting an existing record adds no new work history');assert.deepEqual(projectStampProgress(old,old,3000).progressLog,log,'an old client sending unchanged coarse rows adds no work history either');
 const disabled={...design,seamlessCorners:false,seamlessPerimeter:false};assert.deepEqual(projectUpgradeCyclorama(next,disabled).stages,next.stages);projectValidate('tracking',next);
});

test('Migration keeps explicit components in partially upgraded records and retains notes exactly once',()=>{
 const d=projectDefaultTracking(design),note={id:'old-note',text:'Original summary',at:1};row(d,'cyc-corner-1-ribs').percent=100;row(d,'cyc-corner-2-ribs').percent=20;
 d.stages.find(s=>s.id==='cyclorama').steps.push({id:'cyc-ribs',name:'Old aggregate',percent:60,notes:[note]});
 const migrated=projectUpgradeCyclorama(d);assert.equal(row(migrated,'cyc-corner-1-ribs').percent,100);assert.equal(row(migrated,'cyc-corner-2-ribs').percent,20);assert.deepEqual(rows(migrated).flatMap(t=>t.notes),[note]);assert.equal(projectUpgradeCyclorama(migrated),migrated);
});

test('Cyclorama guide reads tracker percentages even when obsolete aggregate checks remain saved',()=>{
 let d=projectDefaultTracking(design);d.guideChecks={'set:44':true,'set:49':true};assert.equal(projectGuideStagePercent(d,44,design),0);assert.equal(projectGuideStagePercent(d,49,design),0);
 d=projectSetGuideStage(d,49,true,design);const changed=structuredClone(d);row(changed,'cyc-corner-1-ribs').percent=20;
 assert.equal(projectGuideStagePercent(projectReconcileGuideChecks(d,changed),49,design),20);
});

test('Corner and perimeter mesh progress respects each own ribs and skin, not another completed side',()=>{
 let d=projectDefaultTracking(design);d=projectSetGuideStage(d,51,true,design);assert.equal(projectPartStatus(part('corner-1','skin'),d).assembled,false);
 for(const stage of [43,49])d=projectSetGuideStage(d,stage,true,design);
 assert.equal(projectPartStatus(part('corner-1','skin'),d).assembled,true);assert.equal(projectPartStatus(part('corner-2','ribs'),d).assembled,false);
 d=projectSetGuideStage(d,54,true,design);assert.equal(projectPartStatus(part('perimeter-left','skin'),d).assembled,false);
 d=projectSetGuideStage(d,53,true,design);assert.equal(projectPartStatus(part('perimeter-left','skin'),d).assembled,true);assert.equal(projectPartStatus(part('perimeter-right','ribs'),d).assembled,false);
});

test('Compound corners require their own ribs and adjacent finished assemblies independently on each side',()=>{
 let d=projectDefaultTracking(design);for(const stage of [43,49,51,53,54,57,58,59,60])d=projectSetGuideStage(d,stage,true,design);
 assert.deepEqual(projectPartStatus(part('compound-1','skin'),d),{assembled:true,finish:'raw'});assert.equal(projectPartStatus(part('compound-2','ribs'),d).assembled,false);
 d=projectSetGuideStage(d,57,false,design);assert.equal(projectPartStatus(part('compound-1','ribs'),d).assembled,false,'back perimeter support is required');
 d=projectSetGuideStage(d,57,true,design);d=projectSetGuideStage(d,59,false,design);assert.equal(projectPartStatus(part('compound-1','skin'),d).assembled,false,'own ribs are required');
});

test('Component visibility falls back to old coarse completion before migration',()=>{
 const old={stages:[{id:'cyclorama',steps:['cyc-backing','cyc-ribs','cyc-skin','cyc-perimeter','cyc-junctions','cyc-finish'].map(id=>({id,percent:100,notes:[]}))}]};
 for(const c of projectCycloramaComponents())assert.deepEqual(projectPartStatus(part(c.component,c.phase),old),{assembled:true,finish:'paint'});
});

test('Whole-set joining checkboxes write real counts; unchecked guide or tracker changes cannot be overridden by stale checks',()=>{
 const initial=projectSetAssemblyCounts(projectDefaultTracking(),{panelsCompleted:8,wallsJoined:7,anglesSet:2});initial.guideChecks={'set:21':true,'set:22':false};
 assert.equal(projectGuideStageDone(initial,21,design),false);assert.equal(projectGuideStageDone(initial,22,design),true);
 let d=projectSetGuideStage(initial,21,true,design);assert.equal(d.assembly.wallsJoined,8);assert.equal(projectStepPercent(d,'walls-5'),100);assert.equal(projectGuideStageDone(d,21,design),true);
 d=projectSetGuideStage(d,22,false,design);assert.equal(d.assembly.anglesSet,0);assert.equal(d.assembly.wallsJoined,8);assert.equal(d.assembly.panelsCompleted,8);assert.equal(projectStepPercent(d,'walls-5'),50);
 d=projectSetGuideStage(d,21,false,design);assert.equal(d.assembly.wallsJoined,0);assert.equal(d.assembly.panelsCompleted,8);assert.equal(projectStepPercent(d,'walls-5'),0);
 d=projectSetAssemblyCounts(d,{...d.assembly,wallsJoined:7,anglesSet:2});assert.equal(projectGuideStageDone(d,21,design),false);assert.equal(projectGuideStageDone(d,22,design),true);assert.equal(projectGuideStagePercent(d,21,design),88);
 assert.throws(()=>projectSetGuideStage(projectSetAssemblyCounts(d,{panelsCompleted:7,wallsJoined:7,anglesSet:2}),21,true,design),/completed wall panels/);
 assert.deepEqual(projectUpgradeTracking(d).assembly,d.assembly);
});

test('Disabled optional components leave the visible tracker but retain saved completion',async()=>{
 const {projectVisibleTracking}=await import('../public/project-model.js');
 const both={height:120,angle:90,floor:'charcoal',platformShape:'square',seamlessCorners:true,seamlessPerimeter:true};
 const tracked=projectSetGuideStage(projectDefaultTracking(both),49,true,both);
 const off={...both,seamlessCorners:false,seamlessPerimeter:false};
 assert.ok(!projectVisibleTracking(tracked,off).stages.some(s=>s.id==='cyclorama'));
 assert.equal(projectStepPercent(tracked,'cyc-corner-1-ribs'),100);
 const corners=projectVisibleTracking(tracked,{...both,seamlessPerimeter:false}).stages.find(s=>s.id==='cyclorama');assert.equal(corners.steps.length,6);assert.ok(corners.steps.every(t=>!t.id.includes('perimeter')&&!t.id.includes('compound')));
});
