import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as platform from '../public/platform.js';
import {stepFasteners} from '../public/step-fasteners.js';

// Exercise guide selection without initializing browser rendering or textures.
const source=fs.readFileSync(new URL('../public/guide.js',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'').replaceAll('export ','');
const context=vm.createContext({...platform,stepFasteners,design:h=>({foot:h===120?48:36,jackH:h===120?96:72,attachmentHeights:[],attachmentDepth:0})});
vm.runInContext(source,context);
test('Second plywood layer belongs only to painted-floor guides',()=>{
 for(const height of [96,120])for(const floor of ['none','wood','charcoal','platform'])for(const platformShape of ['none','angled','square']){
  const stages=context.steps(height,floor,{platformShape,angle:45}).map(s=>s.stage);
  assert.equal(stages.includes(42),floor==='charcoal',`${height}/${floor}/${platformShape}`);
  if(floor==='charcoal')assert.ok(stages.indexOf(24)<stages.indexOf(42)&&stages.indexOf(42)<stages.indexOf(25));
 }
});
