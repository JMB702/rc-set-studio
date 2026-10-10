import test from 'node:test';
import assert from 'node:assert/strict';
import {nextCompletionState} from '../public/guide-completion.js';
test('Completion cycles undone -> done -> persistent auto-mark -> undone',()=>{
 let state={done:false,autoMark:false};state=nextCompletionState(state.done,state.autoMark);assert.deepEqual(state,{done:true,autoMark:false});state=nextCompletionState(state.done,state.autoMark);assert.deepEqual(state,{done:true,autoMark:true});state=nextCompletionState(state.done,state.autoMark);assert.deepEqual(state,{done:false,autoMark:false});
});
test('A tap while auto-marking always stops auto-marking and unmarks the current step',()=>{assert.deepEqual(nextCompletionState(false,true),{done:false,autoMark:false});assert.deepEqual(nextCompletionState(true,true),{done:false,autoMark:false});});
