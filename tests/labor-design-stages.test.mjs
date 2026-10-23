import test from 'node:test';
import assert from 'node:assert/strict';
import {projectDefaultTracking,projectGuideStagePercent} from '../public/project-model.js';
import {laborTaskProgress} from '../public/projection.js';
import {laborFor} from '../public/labor.js';

const design={height:120,angle:90,floor:'charcoal',platformShape:'square',seamlessCorners:true,seamlessCornerSide:'right',seamlessPerimeter:false};
const tracker=()=>{const d=projectDefaultTracking();d.design=design;d.guideChecks={};return d;};
const set=(d,id,p)=>{const step=d.stages.flatMap(s=>s.steps).find(t=>t.id===id);if(step)step.percent=p;else d.stages.at(-1).steps.push({id,name:id,percent:p,notes:[]});};
const task=id=>laborFor({...design,scope:'set'}).tasks.find(t=>t.id===id);

test('Cutting the backboards and corner skin is done once they are attached',()=>{
 const d=tracker();for(const s of [63,64,76])assert.equal(projectGuideStagePercent(d,s,design),0);
 set(d,'cyc-backing',100);set(d,'cyc-corner-2-skin',100);
 for(const s of [63,64,76])assert.equal(projectGuideStagePercent(d,s,design),100);
 d.guideChecks['set:76']=false;assert.equal(projectGuideStagePercent(d,76,design),100,'a stale unchecked box does not undo an attached skin');
});

test('A right-corner set has no hours left for the left corner skin',()=>{
 const d=tracker();set(d,'cyc-backing',100);set(d,'cyc-corner-2-ribs',100);set(d,'cyc-corner-2-skin',100);
 assert.equal(laborTaskProgress(task('cycBacking'),{design,tracking:d}),100);
 assert.equal(laborTaskProgress(task('cycCornerSkin'),{design,tracking:d}),100);
});
