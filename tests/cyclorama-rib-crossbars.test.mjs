import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {priceRows} from '../public/pricing-calc.js';
import {laborTasks} from '../public/labor.js';
import {cycloramaPlan,wallCrossbars,infillCrossbars} from '../public/cyclorama.js';
import {stepFasteners} from '../public/step-fasteners.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/flat-shopping-list.json',import.meta.url),'utf8'));
// The approved build: 10′ walls at 90°, right corner only, no perimeter, painted floor with the joining lip, square platform.
const approved={scope:'set',height:120,angle:90,floor:'charcoal',floorLip:true,platformShape:'square',platformAngle:90,platformBack:12,platformSide:12,seamlessCorners:true,seamlessCornerSide:'right',seamlessPerimeter:false};

test('Every corner rib is centered on a wall crossbar, existing or added, and screwed from behind',()=>{
 for(const height of [96,120])for(const floor of ['none','wood','charcoal'])for(const perimeter of [false,true])for(const angle of [45,90]){
  const p=cycloramaPlan({...approved,height,floor,angle,seamlessPerimeter:perimeter,seamlessCornerSide:'both'}),lines=[...wallCrossbars(height),...p.addedCrossbarLevels];
  assert.equal(p.verticalRibs,2*p.ribLevels.length);assert.equal(p.ribBackScrews,4*p.verticalRibs);
  for(const l of p.ribLevels){
   assert.ok(lines.includes(l.crossbar),`rib at ${l.y} has a crossbar`);
   assert.ok(l.crossbar>=l.y&&l.crossbar<=l.y+p.ribThickness||Math.abs(l.y+p.ribThickness/2-l.crossbar)<=.375,'the screw line from behind hits the rib edge');
   assert.ok(l.y>=p.floorBase+(perimeter?24:0)-1e-9&&l.y+p.ribThickness<=height,'ribs stay on the curve');
  }
  const ys=p.ribLevels.map(l=>l.y);for(let i=1;i<ys.length;i++)assert.ok(ys[i]-ys[i-1]<=p.ribSpacing&&ys[i]-ys[i-1]>=3,'ribs within the 16″ maximum, about 12″ on the crossbar grid');
  for(const y of p.addedCrossbarLevels)assert.ok(wallCrossbars(height).every(e=>Math.abs(e-y)>=.75),'added crossbars clear the existing ones');
  assert.equal(p.addedCrossbars,4*p.addedCrossbarLevels.length,'two panels per rounded corner');
  assert.ok(p.backScrew.length-p.backScrew.through>=.75,'at least ¾″ of screw in the rib edge');
  if(!perimeter)assert.equal(p.blockingFeet,0,'no cleats or vertical seam backers on a corners-only retrofit');
 }
 assert.deepEqual(infillCrossbars(120),[12,36,60,84,108],'midway between the 24″ toggles');
});

test('Approved design: material for crossbar-mounted ribs',()=>{
 const p=cycloramaPlan(approved),rows=priceRows(data,approved),row=id=>rows.find(r=>r.id===id);
 assert.equal(p.verticalRibs,11);assert.equal(p.addedCrossbars,12);assert.equal(p.addedCrossbarLevels.length,6);
 assert.equal(row('cycCrossbars').purchaseQuantity,6);assert.equal(row('cycCrossbars').productUrl,data.products.find(x=>x.id==='board13').productUrl,'1×3 like the 10′ toggles');
 assert.equal(row('cycRibScrews').needed,44);assert.equal(row('cycRibScrews').purchaseQuantity,1);assert.equal(row('cycRibScrews').unitPriceCents,null,'3½″ box price not yet checked');
 assert.equal(row('cycBacking'),undefined,'no 2×4 backing or cleats');assert.equal(row('cycAnchorScrews'),undefined,'no SPAX anchors without floor-cove ribs');
 assert.equal(row('cycCrossbarScrews').needed,48);assert.equal(row('cycCrossbarStaples').needed,192);
 assert.equal(row('cycRibPly').purchaseQuantity,3);
 assert.ok(laborTasks(approved).find(t=>t.id==='cycBacking').name.includes('12 wall crossbars'));
 assert.deepEqual(stepFasteners(50,120,'charcoal',approved).map(f=>f.productId),['cycRibScrews','cycAdhesive']);
 assert.equal(stepFasteners(50,120,'charcoal',approved)[0].quantity,44);
});
