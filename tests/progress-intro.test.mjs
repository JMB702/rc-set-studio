import test from 'node:test';
import assert from 'node:assert/strict';
import {createProgressIntro} from '../public/progress-intro.js';
test('Load starts at zero, advances monotonically and finishes exactly; later refreshes never replay',()=>{
 let time=0;const frames=[],values=[];const intro=createProgressIntro({paint:v=>values.push(v),now:()=>time,requestFrame:fn=>frames.push(fn),reduced:()=>false,duration:1000});
 intro.start();assert.equal(values.at(-1),0);time=500;frames.shift()();const mid=values.at(-1);assert.ok(mid>0&&mid<1);
 intro.start();assert.equal(values.at(-1),mid);assert.equal(frames.length,1);
 time=1000;frames.shift()();assert.equal(values.at(-1),1);assert.equal(frames.length,0);intro.start();intro.refresh();assert.equal(values.at(-1),1);
 assert.ok(values.every((v,i)=>i===0||v>=values[i-1]));
});
test('Reduced motion resolves immediately with no animation frames',()=>{
 const values=[],frames=[];createProgressIntro({paint:v=>values.push(v),now:()=>0,requestFrame:fn=>frames.push(fn),reduced:()=>true}).start();assert.deepEqual(values,[1]);assert.equal(frames.length,0);
});
