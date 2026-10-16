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

test('Seamless corner steps and cut list follow independent options at both wall heights',()=>{
 for(const height of [96,120])for(const floor of ['none','wood','charcoal'])for(const angle of [0,45,90])for(const seamlessCorners of [false,true])for(const seamlessPerimeter of [false,true]){
  const cfg={height,floor,angle,seamlessCorners,seamlessPerimeter,platformShape:'angled'},hasCorners=seamlessCorners&&angle>0;
  const all=context.steps(height,floor,cfg),stages=Array.from(all,s=>s.stage),retrofit=Array.from(all).filter(s=>s.section==='cyclorama').map(s=>s.stage),plan=context.cycloramaPlan(cfg),expected=hasCorners||seamlessPerimeter?[43,...(hasCorners&&plan.addedCrossbars?[63,64,65]:[]),...(hasCorners&&angle===90?[66,67,68,69,70,71]:[]),...(hasCorners?[49,50,51,52]:[]),...(seamlessPerimeter?[53,54,55,56,57,58]:[]),...(hasCorners&&seamlessPerimeter?[59,60,61,62]:[]),...(seamlessPerimeter?[48]:[])]:[];
  assert.deepEqual(retrofit,expected,JSON.stringify(cfg));
  assert.equal(context.cycloramaCutRows(cfg).length>0,expected.length>0);
  assert.ok(all.filter(s=>s.section==='cyclorama').every(s=>s.stage>=43&&(s.checkpoint||s.tools&&s.spec&&s.fasteners.length)),'count steps carry no instructions of their own');
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
  assert.deepEqual(Array.from(by[rib].fasteners,x=>x.productId),label.startsWith('wall corner')?['cycAnchorScrews','cycRibScrews','cycAdhesive']:['cycAnchorScrews'],'corner ribs are screwed from behind: SPAX through flat crossbars, deck screws through on-edge toggles');
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
test('Platform framing walks through each cut length, longest first, with its count',()=>{
 const cfg={angle:90,platformShape:'square',platformAngle:90,platformBack:18,platformSide:18,platformFront:12,seamlessCorners:true,seamlessCornerSide:'right',floorLip:true};
 const step=context.steps(120,'charcoal',cfg).find(s=>s.stage===31),lines=context.instructionSentences(step.description);
 assert.deepEqual(Array.from(lines.slice(0,5)),[
  'Set aside 4 whole 8′ (96″) studs, uncut: 2 top rims and 2 bottom rims.',
  'Cut 12 at 63″: 4 top rims, 4 bottom rims and 4 seam joists.',
  'Cut 4 at 60″: 2 top rims and 2 bottom rims.',
  'Cut 9 at 45″: 9 joists.',
  'Cut 16 at 9 7/16″: 16 legs.']);
 assert.ok(!/cut list/.test(step.description),'the step is self-contained');
});
test('Platform frames go together inside out, with joist centers measured from the back rim edge',()=>{
 const cfg={angle:90,platformShape:'square',platformAngle:90,platformBack:18,platformSide:18,platformFront:12,seamlessCorners:true,seamlessCornerSide:'right',floorLip:true};
 const lines=Array.from(context.instructionSentences(context.steps(120,'charcoal',cfg).find(s=>s.stage===31).description));
 const at=re=>lines.findIndex(l=>re.test(l));
 assert.ok(at(/Mark the joist centers/)<at(/Fasten the joists first/));
 assert.ok(at(/Fasten the joists first/)<at(/seam joists together/)&&at(/seam joists together/)<at(/Add the side rims/)&&at(/Add the side rims/)<at(/front and back rims last/),'joists, then doubled seams, then side rims, then front and back rims');
 assert.match(lines[at(/Mark the joist centers/)],/14 1\/2″, 30 1\/2″ and 46 1\/2″ from the back end.*16″, 32″ and 48″ from its outside edge/);
 assert.deepEqual(Array.from(context.joistMarks(platform.platformPlan(90,18,18,90,{platformFront:12}))),[16,32,48]);
});
test('The seamless corner goes in before the walls are plastered, primed and painted',()=>{
 const cfg={angle:90,platformShape:'square',platformAngle:90,platformBack:18,platformSide:18,platformFront:12,seamlessCorners:true,seamlessCornerSide:'right',floorLip:true};
 const all=Array.from(context.steps(120,'charcoal',cfg)),at=stage=>all.findIndex(s=>s.stage===stage);
 assert.ok(all.filter(s=>s.section==='cyclorama').every(s=>at(s.stage)<at(28)),'every seamless corner step comes before the wall finish');
 assert.deepEqual(all.slice(-3).map(s=>s.stage),[28,72,73],'plaster, then primer, then paint');assert.ok([28,72,73].every(n=>all[at(n)].section==='finish'));
 assert.equal(at(48),-1,'rounded wall corners have no separate finishing step');
 assert.match(all[at(28)].description,/Plaster the rounded corner along with the walls/);
 const coves=Array.from(context.steps(120,'charcoal',{...cfg,seamlessPerimeter:true}));assert.equal(coves[coves.findIndex(s=>s.stage===48)].title,'Fill and fair the seamless surfaces');
 const plain=Array.from(context.steps(120,'charcoal',{angle:90,platformShape:'none'}));assert.equal(plain.at(-1).stage,73,'without a seamless corner the wall finish is still last');
});

test('Ribs are cut from squares, one action per step, with counts before and after',()=>{
 const cfg={angle:90,platformShape:'square',platformAngle:90,platformBack:18,platformSide:18,platformFront:12,seamlessCorners:true,seamlessCornerSide:'right',floorLip:true,height:120,floor:'charcoal'};
 const all=Array.from(context.steps(120,'charcoal',cfg)),order=all.map(s=>s.stage),plan=context.ribCutPlan(context.cycloramaPlan(cfg));
 assert.deepEqual(order.filter(n=>n>=43&&n<72),[43,63,64,65,66,67,68,69,70,71,50,52],'backboards, then rib cutting, then mounting');
 assert.ok(all.find(s=>s.stage===65).checkpoint&&all.find(s=>s.stage===71).checkpoint);
 assert.deepEqual([plan.square,plan.squaresPerSheet,plan.ribsPerSheet,plan.ribs,plan.squares,plan.sheets],[36.125,2,4,11,6,3]);
 const cut=Array.from(context.instructionSentences(all.find(s=>s.stage===66).description));
 assert.match(cut[0],/You need 11 ribs, and each square gives two, so cut 6 squares 36 1\/8″ on every side \(12 ribs, 1 spare\)/);
 assert.ok(cut.some(l=>/One 4×8 sheet holds 2 squares, 4 ribs/.test(l)));
 assert.doesNotMatch(all.find(s=>s.stage===50).description,/Transfer the full-size corner template/);
});
