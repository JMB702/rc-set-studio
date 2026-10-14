import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {priceRows} from '../public/pricing-calc.js';
import {laborTasks} from '../public/labor.js';
import {cycloramaPlan,wallCrossbars,infillCrossbars,RIB_CLEAT} from '../public/cyclorama.js';
import {stepFasteners} from '../public/step-fasteners.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/flat-shopping-list.json',import.meta.url),'utf8'));
// The approved build: 10′ walls at 90°, right corner only, no perimeter, painted floor with the joining lip, square platform.
const approved={scope:'set',height:120,angle:90,floor:'charcoal',floorLip:true,platformShape:'square',platformAngle:90,platformBack:12,platformSide:12,seamlessCorners:true,seamlessCornerSide:'right',seamlessPerimeter:false};

test('Every corner rib is fixed through a cleat into a wall crossbar, existing or added',()=>{
 for(const height of [96,120])for(const floor of ['none','wood','charcoal'])for(const perimeter of [false,true])for(const angle of [45,90]){
  const p=cycloramaPlan({...approved,height,floor,angle,seamlessPerimeter:perimeter,seamlessCornerSide:'both'}),lines=[...wallCrossbars(height),...p.addedCrossbarLevels];
  assert.equal(p.verticalRibs,2*p.ribLevels.length);
  for(const l of p.ribLevels){
   assert.ok(lines.includes(l.crossbar),`rib at ${l.y} has a crossbar`);
   const cleat=l.cleat==='below'?[l.y-RIB_CLEAT.height,l.y]:[l.y+p.ribThickness,Math.min(height,l.y+p.ribThickness+RIB_CLEAT.height)];
   assert.ok(l.crossbar>=cleat[0]&&l.crossbar<=cleat[1],'the cleat covers its crossbar');
   assert.ok(l.y>=p.floorBase+(perimeter?24:0)-1e-9&&l.y+p.ribThickness<=height,'ribs stay on the curve');
  }
  const ys=p.ribLevels.map(l=>l.y);for(let i=1;i<ys.length;i++)assert.ok(ys[i]-ys[i-1]<=p.ribSpacing&&ys[i]-ys[i-1]>=RIB_CLEAT.height,'ribs within the 16″ maximum (12″ on the crossbar grid), clear of each other’s cleats');
  for(const y of p.addedCrossbarLevels)assert.ok(wallCrossbars(height).every(e=>Math.abs(e-y)>=2),'added crossbars clear the existing ones');
  assert.equal(p.addedCrossbars,4*p.addedCrossbarLevels.length,'two panels per rounded corner');
 }
 assert.deepEqual(infillCrossbars(120),[12,36,60,84,108],'midway between the 24″ toggles');
});

test('Approved design: material for the crossbar-mounted ribs',()=>{
 const p=cycloramaPlan(approved),rows=priceRows(data,approved),row=id=>rows.find(r=>r.id===id);
 assert.equal(p.verticalRibs,11);assert.equal(p.addedCrossbars,12);assert.equal(p.addedCrossbarLevels.length,6);
 assert.equal(row('cycCrossbars').purchaseQuantity,6);assert.equal(row('cycCrossbars').productUrl,data.products.find(x=>x.id==='board13').productUrl,'1×3 like the 10′ toggles');
 assert.equal(row('cycCleatScrews').needed,44);assert.equal(row('cycCrossbarScrews').needed,48);assert.equal(row('cycCrossbarStaples').needed,192);
 assert.equal(row('cycRibPly').purchaseQuantity,3);
 assert.ok(laborTasks(approved).find(t=>t.id==='cycBacking').name.includes('12 wall crossbars'));
 assert.deepEqual(stepFasteners(50,120,'charcoal',approved).map(f=>f.productId),['cycCleatScrews','cycAnchorScrews']);
 assert.equal(stepFasteners(50,120,'charcoal',approved)[0].quantity,44);
});
