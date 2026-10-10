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
 assert.equal(result().finish,'raw');steps.find(s=>s.id==='wall-finishing-1').percent=50;assert.equal(result(0).finish,'seams');assert.equal(result(3).finish,'seams');assert.equal(result(4).finish,'raw');assert.equal(result(0,false).finish,'raw');
 steps.find(s=>s.id==='wall-finishing-1').percent=100;assert.equal(result(7).finish,'seams');steps.find(s=>s.id==='wall-finishing-3').percent=100;assert.equal(result().finish,'primer');steps.find(s=>s.id==='wall-finishing-4').percent=100;assert.equal(result().finish,'paint');assert.equal(result(0,false).finish,'raw');
});
