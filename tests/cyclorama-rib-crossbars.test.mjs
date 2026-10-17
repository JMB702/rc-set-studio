import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {priceRows} from '../public/pricing-calc.js';
import {laborTasks} from '../public/labor.js';
import {cycloramaPlan,wallCrossbars,infillCrossbars,ribBackScrew,cutLength} from '../public/cyclorama.js';
import {inches} from '../public/platform.js';
import {stepFasteners} from '../public/step-fasteners.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/flat-shopping-list.json',import.meta.url),'utf8'));
// The approved build: 10′ walls at 90°, right corner only, no perimeter, painted floor with the joining lip, square platform.
const approved={scope:'set',height:120,angle:90,floor:'charcoal',floorLip:true,platformShape:'square',platformAngle:90,platformBack:12,platformSide:12,seamlessCorners:true,seamlessCornerSide:'right',seamlessPerimeter:false};

test('Every corner rib is centered on a wall crossbar, existing or added, and screwed from behind',()=>{
 // Added crossbars lie flat against the skin; existing rails and toggles stay on edge.
 for(const height of [96,120])for(const floor of ['none','wood','charcoal'])for(const perimeter of [false,true])for(const angle of [45,90]){
  const p=cycloramaPlan({...approved,height,floor,angle,seamlessPerimeter:perimeter,seamlessCornerSide:'both'}),lines=[...wallCrossbars(height),...p.addedCrossbarLevels];
  assert.equal(p.verticalRibs,2*p.ribLevels.length);assert.equal(p.ribBackScrews+p.ribFlatScrews,4*p.verticalRibs);
  for(const l of p.ribLevels){
   assert.ok(lines.includes(l.crossbar),`rib at ${l.y} has a crossbar`);
   const reach=l.added?p.crossbarStock.width/2:.375;assert.ok(Math.abs(l.y+p.ribThickness/2-l.crossbar)<=reach,'the screw line at the rib center passes through the crossbar');
   assert.equal(l.flat,l.added||(height===120&&l.crossbar===96),'added crossbars and the 10′ seam backer lie flat');
   const screw=ribBackScrew(height,l.flat);assert.ok(screw.length-screw.through>=.75,'at least ¾″ of screw in the rib edge');
   assert.ok(l.y>=p.floorBase+(perimeter?24:0)-1e-9&&l.y+p.ribThickness<=height,'ribs stay on the curve');
  }
  const L=p.ribLevels;for(let i=1;i<L.length;i++){const gap=L[i].y-L[i-1].y;assert.ok(gap<=p.ribSpacing+1e-9&&gap>=3,'ribs no more than 24″ apart, as built');}
  for(const sm of p.cornerSkin.seams)assert.ok(L.some(l=>Math.abs(l.y+p.ribThickness/2-sm)<1e-9),'every skin joint lands on the center of a rib');
  for(const y of p.addedCrossbarLevels)assert.ok(wallCrossbars(height).every(e=>Math.abs(e-y)>=.375+p.crossbarStock.width/2-1e-9),'flat added crossbars clear the existing on-edge ones');
  assert.equal(p.addedCrossbars,4*p.addedCrossbarLevels.length,'two panels per rounded corner');
  if(!perimeter)assert.equal(p.blockingFeet,0,'no cleats or vertical seam backers on a corners-only retrofit');
 }
 assert.deepEqual(infillCrossbars(120),[108],'as built: one board between the 96″ seam and the top rail');assert.deepEqual(infillCrossbars(96),[]);
});

test('Approved design: material for crossbar-mounted ribs',()=>{
 const p=cycloramaPlan(approved),rows=priceRows(data,approved),row=id=>rows.find(r=>r.id===id);
 assert.equal(p.verticalRibs,7,'as built Oct 16: floor, 24, 48, 72, 96, 108 and the top rail');assert.deepEqual(p.ribLevels.map(l=>Math.round(l.y+p.ribThickness/2)),[2,24,48,72,96,108,120]);assert.equal(p.addedCrossbars,4);assert.equal(p.addedCrossbarLevels.length,2);
 assert.equal(row('cycCrossbars').purchaseQuantity,2);assert.equal(row('cycCrossbars').productUrl,data.products.find(x=>x.id==='board13').productUrl,'1×3 like the 10′ toggles');
 assert.equal(row('cycRibScrews').needed,16,'4 ribs on the existing on-edge toggles and top rail');assert.equal(row('cycAnchorScrews').needed,12,'3 ribs on flat boards (low board, 96″ seam backer, 108″) take 2½″ SPAX');assert.equal(row('cycRibScrews').purchaseQuantity,1);assert.equal(row('cycRibScrews').unitPriceCents,null,'3½″ box price not yet checked');
 assert.equal(row('cycBacking'),undefined,'no 2×4 backing or cleats');
 assert.equal(row('cycCrossbarScrews').needed,16);assert.equal(row('cycCrossbarStaples').needed,64);
 assert.equal(row('cycRibPly').purchaseQuantity,2,'30 11/16″ squares: three per sheet');assert.equal(row('cycSkin').purchaseQuantity,2,'one sheet per row');
 assert.equal(p.cornerRadius,30.5625);assert.deepEqual(p.cornerSkin.columns.map(w=>inches(cutLength(w))),['48″'],'the curve is one full sheet around: no rip, no vertical seam');
 assert.deepEqual(p.cornerSkin.rows.map(r=>r.columns.map(c=>inches(cutLength(c)))),[['48″'],['48″']]);
 assert.deepEqual(p.cornerSkin.rows.map(r=>inches(cutLength(r.height))),['94 7/16″','24″'],'floor top to the 96″ rib, then the rib to the wall top');assert.deepEqual(p.cornerSkin.seams,[96]);
 assert.ok(laborTasks(approved).find(t=>t.id==='cycBacking').name.includes('4 backboards'));assert.equal(laborTasks(approved).find(t=>t.id==='cycBacking').stage,'43, 63–64');assert.equal(laborTasks(approved).find(t=>t.id==='cycFinish').stage,'28, 72–73','rounded corners are plastered, primed and painted with the walls');
 assert.deepEqual(stepFasteners(50,120,'charcoal',approved).map(f=>[f.productId,f.quantity]),[['cycAnchorScrews',12],['cycRibScrews',16],['cycAdhesive',null]]);
});
