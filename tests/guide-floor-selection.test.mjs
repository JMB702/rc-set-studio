import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as cyclorama from '../public/cyclorama.js';
import * as floor from '../public/floor-plan.js';
import * as platform from '../public/platform.js';
import {migrateGuideStage} from '../public/workspace-state.js';
import {stepFasteners} from '../public/step-fasteners.js';

// Exercise guide selection without initializing browser rendering or textures.
const source=fs.readFileSync(new URL('../public/guide.js',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'').replaceAll('export ','');
const context=vm.createContext({...floor,...platform,...cyclorama,stepFasteners,migrateGuideStage,design:h=>({foot:h===120?48:36,jackH:h===120?96:72,attachmentHeights:[],attachmentDepth:0})});
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
  const all=context.steps(height,floor,cfg),stages=Array.from(all,s=>s.stage),retrofit=stages.filter(n=>n>=43),expected=hasCorners||seamlessPerimeter?[43,...(hasCorners?[49,50,51,52]:[]),...(seamlessPerimeter?[53,54,55,56,57,58]:[]),...(hasCorners&&seamlessPerimeter?[59,60,61,62]:[]),48]:[];
  assert.deepEqual(retrofit,expected,JSON.stringify(cfg));
  assert.equal(context.cycloramaCutRows(cfg).length>0,expected.length>0);
  assert.ok(all.filter(s=>s.stage>=43).every(s=>s.section==='cyclorama'&&s.tools&&s.spec&&s.fasteners.length));
  assert.equal(stages.filter(n=>n===38).length,1,'existing panel checkpoint stays unchanged');
 }
});
test('Retrofit instructions retain finished walls, template the real angle and separate compound labor from simple corners',()=>{
 const cfg={height:120,angle:45,floor:'wood',seamlessCorners:true,seamlessPerimeter:true},by=Object.fromEntries(context.cycloramaSteps(cfg).map(s=>[s[0],s]));
 assert.match(by[43][2],/do not remove the existing wall skin/);assert.match(by[43][2],/rear blocking/);assert.match(by[43][2],/do not plaster or fasten.*floating/);
 assert.match(by[49][2],/135° inside angle/);assert.match(by[59][3],/48 total/);assert.ok(!context.steps(120,'wood',cfg).find(s=>s.stage===28).description.includes('Run paintable caulk'));assert.match(by[59][2],/individually templated/);assert.match(by[59][3],/Drying and cure time are additional/);
 assert.match(by[43][2],new RegExp(cyclorama.cycloramaGaps(cfg).minimum+'″ from the wall'));
 assert.ok(context.cycloramaCutRows(cfg).some(r=>r[0]===cyclorama.cycloramaPlan(cfg).ribSheets&&r[1]==='Rib plywood stock'));
 const simple=context.cycloramaSteps({...cfg,seamlessPerimeter:false});assert.ok(!simple.some(s=>s[0]===59));assert.match(simple.find(s=>s[0]===49)[2],/down to floor level with no horizontal cove/);
});

test('Each physical curve has separate rib and skin instructions with its own matching fasteners',()=>{
 const cfg={height:120,angle:90,floor:'charcoal',seamlessCorners:true,seamlessPerimeter:true};
 const by=Object.fromEntries(context.steps(120,'charcoal',cfg).map(s=>[s.stage,s]));
 for(const [rib,skin,label] of [[49,51,'wall corner 1'],[50,52,'wall corner 2'],[53,54,'left perimeter'],[55,56,'right perimeter'],[57,58,'back perimeter'],[59,60,'compound floor corner 1'],[61,62,'compound floor corner 2']]){
  assert.ok(by[rib].title.includes(label));assert.ok(by[skin].title.includes(label));
  assert.match(by[rib].title,/Add ribs/);assert.match(by[skin].title,/Add skin/);
  assert.deepEqual(Array.from(by[rib].fasteners,x=>x.productId),label.startsWith('wall corner')?['cycRibScrews','cycAdhesive']:['cycAnchorScrews'],'corner ribs are screwed from behind through the crossbars');
  assert.deepEqual(Array.from(by[skin].fasteners,x=>x.productId),['cycSkinScrews','cycAdhesive']);
  assert.doesNotMatch(by[rib].description,/Bend the skin|Fasten each supported gore|ease the sheet/);
  assert.doesNotMatch(by[skin].description,/Secure the ribs|Cut and fit.*ribs|Fit a fan/);
  assert.equal(by[rib].section,'cyclorama');assert.equal(by[skin].section,'cyclorama');
 }
 for(const stage of [59,60,61,62])assert.match(by[stage].spec,/shared across these steps, not repeated/);
});

test('Numbered guide instructions keep decimal skin and plywood thicknesses intact',()=>{
 assert.deepEqual(Array.from(context.instructionSentences('Use actual .106″ lauan. Two .703″ layers total 1.406″. Test the bend.')),['Use actual .106″ lauan.','Two .703″ layers total 1.406″.','Test the bend.']);
});
