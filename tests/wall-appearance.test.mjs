import test from 'node:test';import assert from 'node:assert/strict';
import {sheetVariation,wallSeamCoverage} from '../public/wall-appearance.js';
import {projectDefaultTracking,projectPartStatus} from '../public/project-model.js';
test('Sheet variations are stable, subtle and distinct across all upper and lower sheets',()=>{
 const samples=[];for(let i=0;i<8;i++)for(const upper of [false,true]){const v=sheetVariation(i,upper);assert.deepEqual(v,sheetVariation(i,upper));assert.ok(Math.abs(v.tone)<=.05);assert.ok(Math.abs(v.warmth)<=.0125);samples.push(JSON.stringify(v));}assert.equal(new Set(samples).size,16);
});
test('Filler follows real joints, feathers out, and leaves the sheet interiors and free wing ends raw',()=>{
 assert.ok(wallSeamCoverage(0,40,120,0)>.8);assert.ok(wallSeamCoverage(2,40,120,0)>wallSeamCoverage(4,40,120,0));assert.equal(wallSeamCoverage(24,40,120,0),0);
 assert.ok(wallSeamCoverage(24,96,120,0)>.8);assert.equal(wallSeamCoverage(24,96,96,0),0,'8-foot flats have no top-extension seam');
 assert.equal(wallSeamCoverage(0,40,120,4),0);assert.equal(wallSeamCoverage(48,40,120,7),0);assert.ok(wallSeamCoverage(48,40,120,5)>.8);assert.ok(wallSeamCoverage(0,40,120,6)>.8);
});
test('Saved wall progress distinguishes raw, filled, primed and painted; backs remain raw',()=>{
 const d=projectDefaultTracking();d.assembly={panelsCompleted:8};const steps=d.stages.find(s=>s.id==='wall-finishing').steps;
 const result=(panel=0,front=true)=>projectPartStatus({kind:'wallSkin',panel,front},d);
 assert.equal(result().finish,'raw');steps.find(s=>s.id==='wall-finishing-1').percent=50;assert.equal(result(0).finish,'seams');assert.equal(result(3).finish,'seams');assert.equal(result(4).finish,'seams','a plaster coat covers every panel');assert.equal(result(0,false).finish,'raw');
 steps.find(s=>s.id==='wall-finishing-1').percent=100;assert.equal(result(7).finish,'seams');steps.find(s=>s.id==='wall-finishing-3').percent=100;assert.equal(result().finish,'primer');steps.find(s=>s.id==='wall-finishing-4').percent=100;assert.equal(result().finish,'paint');assert.equal(result(0,false).finish,'raw');
});

test('Fastener fills: crisp dabs on the real staple lines, matching the Oct 19 first-coat photos',async()=>{
 const {wallFastenerFill,wallStapleRows}=await import('../public/wall-appearance.js');
 const {cornerScrewPositions}=await import('../public/platform-finish.js');const {cornerBackboardFills}=await import('../public/cyclorama.js');
 const peak=(cx,cy,panel,height=120)=>{let m=0;for(let dx=-1.2;dx<=1.2;dx+=.1)for(let dy=-.4;dy<=.4;dy+=.1)m=Math.max(m,wallFastenerFill(cx+dx,cy+dy,height,panel));return m;};
 // Every toggle row reads as a dashed white line: most of its 12 staples are filled, a few are missed.
 for(const panel of [0,3,5])for(const y of [24,48,72]){const filled=[...Array(12).keys()].filter(k=>peak(2+4*k,y,panel)>.8).length;assert.ok(filled>=8&&filled<=12,`panel ${panel} row ${y}: ${filled} of 12 filled`);}
 // Crisp, not feathered like the 4.4″ seam bands: nothing 2″ off a row, and bare wood between the toggles.
 for(let x=0;x<=48;x+=.25){assert.equal(wallFastenerFill(x,50.5,120,0),0);assert.equal(wallFastenerFill(x,36,120,2),0);}
 // About six swipes per 4′ row, each about 3½–5″ wide; a few catch one staple or run into the next pair, as in the photos.
 const along=[];for(let x=0;x<=48;x+=.05)along.push(wallFastenerFill(x,48,120,1)>.5);const runs=along.join('').split(/false/).filter(Boolean).map(r=>r.length*.05/'true'.length);
 const median=[...runs].sort((a,b)=>a-b)[runs.length>>1];
 assert.ok(runs.length>=3&&runs.length<=8,JSON.stringify(runs));assert.ok(runs.every(w=>w>=1.5&&w<=16),JSON.stringify(runs));assert.ok(median>=3&&median<=6,JSON.stringify(runs));
 // 10′ flats add the seam-backer rows and a 119⅝″ top rail; 8′ flats stop at 95⅝″.
 assert.deepEqual(wallStapleRows(120),[.375,24,48,72,119.625,95,97]);assert.deepEqual(wallStapleRows(96),[.375,24,48,72,95.625]);
 assert.equal([...Array(12).keys()].some(k=>peak(2+4*k,108,0)>0),false,'no staples in the open upper sheet');
 // Stile staples hide under the seam bands except at the free wing ends, where they run up the edge.
 const column=panel=>[...Array(25).keys()].filter(k=>wallFastenerFill(panel===7?47.6:.4,6+4*k,120,panel)>.3).length;
 assert.ok(column(4)>=12&&column(7)>=12);assert.equal(wallFastenerFill(.4,34,120,0),0);
 assert.equal(wallFastenerFill(10,48,120,2),wallFastenerFill(10,48,120,2),'seeded');
 // The rounded corner: 8 rib screws across a 48″ arc; the panel beside it gets its 3″ backboard staples.
 assert.deepEqual(cornerScrewPositions(48),[3,9,15,21,27,33,39,45]);
 const fills=cornerBackboardFills({angle:90,height:120,seamlessCorners:true,seamlessCornerSide:'right'});assert.deepEqual(fills.rows,[108]);assert.ok(Math.abs(fills.reach-17.4375)<1e-9);
 assert.deepEqual(cornerBackboardFills({angle:90,height:120}),{rows:[],reach:0},'no rounded corner, no backboards');
});
