import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {platformPlan,frontFor,clampFront} from '../public/platform.js';
import {priceRows} from '../public/pricing-calc.js';
import {normalizeDesign} from '../public/pricing-config.js';
import {projectBuildDesign} from '../public/project-model.js';

const data=JSON.parse(fs.readFileSync(new URL('../public/data/flat-shopping-list.json',import.meta.url),'utf8'));
const depth=p=>{const z=p.outline.map(q=>q[1]);return [Math.min(...z),Math.max(...z)];};

test('The front setback pulls the platform front edge back from the floor edge, not the lip',()=>{
 const flush=platformPlan(90,12,12,90,{}),back=platformPlan(90,12,12,90,{platformFront:12});
 assert.deepEqual(depth(flush),[12,96]);assert.deepEqual(depth(back),[12,84]);
 assert.equal(back.front,12);assert.ok(back.deckArea<flush.deckArea);
 // The joining lip extends the floor, not the platform's reference edge.
 assert.deepEqual(depth(platformPlan(90,12,12,90,{platformFront:12,floorLip:true})),[12,84]);
 // The new front edge is exposed, so it still gets fascia.
 const frontFascia=p=>p.modules.flatMap(m=>m.fascia).filter(f=>f.poly.every(q=>Math.abs(q[1]-depth(p)[1])<.2)).length;
 assert.ok(frontFascia(back)>0);
});

test('A setback never leaves the platform shallower than 24 inches',()=>{
 assert.equal(clampFront(60),48);assert.equal(clampFront(-3),0);
 assert.equal(frontFor(48,48),24);assert.equal(frontFor(12,48),48);
 assert.deepEqual(depth(platformPlan(90,48,12,90,{platformFront:48})),[48,72]);
});

test('Pricing and labor follow the slimmer platform',()=>{
 const rows=f=>Object.fromEntries(priceRows(data,{scope:'set',height:120,angle:90,floor:'charcoal',platformShape:'square',platformFront:f}).map(r=>[r.id,r]));
 const flush=rows(0),back=rows(48);
 assert.ok(back.platformLumber.purchaseQuantity<flush.platformLumber.purchaseQuantity);
 assert.ok(back.platformDeck.purchaseQuantity<=flush.platformDeck.purchaseQuantity);
});

test('The setback is saved with approvals and the shared build design, and older saves read as flush',()=>{
 const d={height:120,angle:90,wallColor:'#34383b',platformShape:'square',platformAngle:90,platformBack:12,platformSide:12,floor:'charcoal'};
 assert.equal(normalizeDesign(d).platformFront,0);
 assert.equal(normalizeDesign({...d,platformFront:12}).platformFront,12);
 assert.throws(()=>normalizeDesign({...d,platformFront:49}));
 const b={...d,platformColor:'#34383b',floorColor:'#34383b'};
 assert.equal(projectBuildDesign(b).platformFront,0);assert.equal(projectBuildDesign({...b,platformFront:12}).platformFront,12);
});
