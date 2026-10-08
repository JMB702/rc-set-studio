import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {stepFasteners} from '../public/step-fasteners.js';import {platformPlan} from '../public/platform.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/flat-shopping-list.json',import.meta.url),'utf8'));
const quantity=(stage,height,id,cfg={})=>stepFasteners(stage,height,'charcoal',cfg).filter(x=>x.productId===id).reduce((n,x)=>n+x.quantity,0);
test('Per-step wall and support fasteners reconcile with the shopping list for both heights',()=>{
 for(const h of [96,120]){const v=data.variants[h===120?'10x4':'8x4'];assert.equal(quantity(9,h,'frameScrews'),v.panelRequirements.frameScrews);assert.equal(quantity(12,h,'staples'),v.panelRequirements.staples);assert.equal(quantity(15,h,'lapScrews')+quantity(17,h,'lapScrews'),v.supportRequirements.lapScrews);assert.equal(quantity(16,h,'shortScrews')+quantity(19,h,'shortScrews'),v.supportRequirements.shortScrews);assert.equal(quantity(18,h,'barScrews'),v.supportRequirements.barScrews);assert.equal(quantity(21,h,'lapScrews'),5*(h===120?5:4));}
});
test('Platform fastening steps reconcile with existing plan quantities at each angle',()=>{
 for(const angle of [0,45,90]){const cfg={angle,platformBack:12,platformSide:12,platformAngle:angle},p=platformPlan(angle,12,12,angle);assert.equal([31,32,33].reduce((n,stage)=>n+quantity(stage,120,'platformFrameScrews',cfg),0),p.frameScrews);assert.equal(quantity(34,120,'platformDeckScrews',cfg),p.deckScrews);assert.equal(quantity(35,120,'platformStaples',cfg),p.staples);}
});
test('Every stage has fastener guidance; layout steps and unresolved fixings are explicit',()=>{
 for(const h of [96,120])for(const floor of ['none','wood','charcoal'])for(const stage of [...Array(29).keys(),30,31,32,33,34,35,36,37]){const items=stepFasteners(stage,h,floor);assert.ok(items.length);for(const item of items){assert.ok(item.title);assert.ok(item.note);if(item.productId)assert.ok([...data.products,...data.platform.products].some(p=>p.id===item.productId)||['platformDeckScrews','platformStaples','platformGlue'].includes(item.productId));}}
 assert.match(stepFasteners(3,120,'charcoal')[0].note,/Dry-fit/);assert.match(stepFasteners(22,120,'charcoal')[0].title,/pending/);assert.match(stepFasteners(24,120,'charcoal')[0].title,/pending/);assert.match(stepFasteners(25,120,'wood')[0].note,/Do not nail or screw/);
});
