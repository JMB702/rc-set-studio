import test from 'node:test';
import assert from 'node:assert/strict';
import {nextCompletionState} from '../public/guide-completion.js';
test('Completion cycles undone -> done -> persistent auto-mark -> undone',()=>{
 let state={done:false,autoMark:false};state=nextCompletionState(state.done,state.autoMark);assert.deepEqual(state,{done:true,autoMark:false});state=nextCompletionState(state.done,state.autoMark);assert.deepEqual(state,{done:true,autoMark:true});state=nextCompletionState(state.done,state.autoMark);assert.deepEqual(state,{done:false,autoMark:false});
});
test('A tap while auto-marking always stops auto-marking and unmarks the current step',()=>{assert.deepEqual(nextCompletionState(false,true),{done:false,autoMark:false});assert.deepEqual(nextCompletionState(true,true),{done:false,autoMark:false});});

test('Unrelated optional previews do not block joining or angle checkoffs',async()=>{
 const {guideCompletionMatchesDesign}=await import('../public/guide-completion.js');
 const shared={height:120,angle:90,floor:'charcoal',seamlessCorners:false,seamlessPerimeter:false,floorLip:false};
 const preview={...shared,seamlessCorners:true,seamlessPerimeter:true};
 for(const stage of [21,22])assert.equal(guideCompletionMatchesDesign({design:shared},preview,stage),true);
 assert.equal(guideCompletionMatchesDesign({design:shared},{...preview,angle:45},21),false);
 assert.equal(guideCompletionMatchesDesign({design:shared},preview,49),false,'Retrofitting still needs its own shared build option');
 assert.equal(guideCompletionMatchesDesign({design:shared},{...preview,floorLip:true},24),false);
});
