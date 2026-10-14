import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as cyclorama from '../public/cyclorama.js';
import * as floor from '../public/floor-plan.js';
import * as platform from '../public/platform.js';
import {stepFasteners} from '../public/step-fasteners.js';

// Exercise guide selection without initializing browser rendering or textures.
const source=fs.readFileSync(new URL('../public/guide.js',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'').replaceAll('export ','');
const context=vm.createContext({...floor,...platform,...cyclorama,stepFasteners,design:h=>({foot:h===120?48:36,jackH:h===120?96:72,attachmentHeights:[],attachmentDepth:0})});
vm.runInContext(source,context);
test('Second plywood layer belongs only to painted-floor guides',()=>{
 for(const height of [96,120])for(const floor of ['none','wood','charcoal','platform'])for(const platformShape of ['none','angled','square']){
  const stages=context.steps(height,floor,{platformShape,angle:45}).map(s=>s.stage);
  assert.equal(stages.includes(42),floor==='charcoal',`${height}/${floor}/${platformShape}`);
  if(floor==='charcoal')assert.ok(stages.indexOf(24)<stages.indexOf(42)&&stages.indexOf(42)<stages.indexOf(25));
 }
});

test('Seamless retrofit steps and cut list follow independent options at both wall heights',()=>{
 for(const height of [96,120])for(const floor of ['none','wood','charcoal'])for(const angle of [0,45,90])for(const seamlessCorners of [false,true])for(const seamlessPerimeter of [false,true]){
  const cfg={height,floor,angle,seamlessCorners,seamlessPerimeter,platformShape:'angled'},hasCorners=seamlessCorners&&angle>0;
  const all=context.steps(height,floor,cfg),stages=Array.from(all,s=>s.stage),retrofit=stages.filter(n=>n>=43),expected=hasCorners||seamlessPerimeter?[43,...(hasCorners?[44,45]:[]),...(seamlessPerimeter?[46]:[]),...(hasCorners&&seamlessPerimeter?[47]:[]),48]:[];
  assert.deepEqual(retrofit,expected,JSON.stringify(cfg));
  assert.equal(context.cycloramaCutRows(cfg).length>0,expected.length>0);
  assert.ok(all.filter(s=>s.stage>=43).every(s=>s.section==='cyclorama'&&s.tools&&s.spec&&s.fasteners.length));
  assert.equal(stages.filter(n=>n===38).length,1,'existing panel checkpoint stays unchanged');
 }
});
test('Retrofit instructions retain finished walls, template the real angle and separate compound labor from simple corners',()=>{
 const cfg={height:120,angle:45,floor:'wood',seamlessCorners:true,seamlessPerimeter:true},by=Object.fromEntries(context.cycloramaSteps(cfg).map(s=>[s[0],s]));
 assert.match(by[43][2],/do not remove the existing wall skin/);assert.match(by[43][2],/rear blocking/);assert.match(by[43][2],/do not plaster or fasten.*floating/);
 assert.match(by[44][2],/135° inside angle/);assert.match(by[47][3],/48 total/);assert.ok(!context.steps(120,'wood',cfg).find(s=>s.stage===28).description.includes('Run paintable caulk'));assert.match(by[47][2],/individually templated/);assert.match(by[47][3],/Drying and cure time are additional/);
 assert.match(by[43][2],new RegExp(cyclorama.cycloramaGaps(cfg).minimum+'″ from the wall'));
 assert.ok(context.cycloramaCutRows(cfg).some(r=>r[0]===cyclorama.cycloramaPlan(cfg).ribSheets&&r[1]==='Rib plywood stock'));
 const simple=context.cycloramaSteps({...cfg,seamlessPerimeter:false});assert.ok(!simple.some(s=>s[0]===47));assert.match(simple.find(s=>s[0]===44)[2],/down to floor level with no horizontal cove/);
});
