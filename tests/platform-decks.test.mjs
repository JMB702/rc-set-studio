import test from 'node:test';
import assert from 'node:assert/strict';
import {platformPlan,PLATFORM,area} from '../public/platform.js';
import {projectDefaultTracking,projectPartStatus} from '../public/project-model.js';
import {matchesCutPart} from '../public/cut-selection.js';
import {approvalMatchesDesign} from '../public/pricing-config.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
test('Larger decks halve the default square pieces and reduce angled pieces without adding sheets',()=>{
 const square=platformPlan(45,12,12,90),angled=platformPlan(45,12,12,45);
 assert.deepEqual([square.modules.length,square.decks.length,square.deckSheets],[8,4,4]);assert.deepEqual([angled.modules.length,angled.decks.length,angled.deckSheets],[13,7,7]);
 assert.equal(square.deckScrews,312);assert.equal(angled.deckScrews,516);assert.equal(square.deckSeamLength,252);close(angled.deckSeamLength,476.0588745030458);assert.ok(square.deckSeamLength<square.seamLength);
});
test('Decks cover the frame layout once, remain supported, and their stock cuts fit without overlap',()=>{
 for(const angle of [0,15,30,45,60,75,90])for(const back of [0,12,24,48])for(const side of [0,12,24,48])for(const pa of [angle,90]){
  const p=platformPlan(angle,back,side,pa),members=p.decks.flatMap(d=>d.moduleIndices);assert.deepEqual([...members].sort((a,b)=>a-b),p.modules.map((_,i)=>i));assert.ok(p.decks.length<=p.modules.length);
  close(p.decks.reduce((s,d)=>s+Math.abs(area(d.nominalPoly)),0),p.deckArea*144);
  for(const d of p.decks){assert.ok(d.moduleIndices.length<=2);assert.ok(d.width<=PLATFORM.sheet[1]+1e-7&&d.depth<=PLATFORM.sheet[0]+1e-7);assert.ok(d.edgeAllowance.x<=3/64+1e-7&&d.edgeAllowance.z<=3/64+1e-7);close(Math.abs(area(d.nominalPoly)),d.moduleIndices.reduce((s,i)=>s+p.modules[i].area,0));
   // Every surviving deck perimeter lies on the frame-cell perimeter of at least one supporting frame.
   for(const e of d.edges){const mid=[(e.A[0]+e.B[0])/2,(e.A[1]+e.B[1])/2];assert.ok(d.moduleIndices.some(i=>p.modules[i].edges.some(f=>Math.abs(f.n[0]*mid[0]+f.n[1]*mid[1]-f.c)<1e-5)));}
  }
  assert.equal(p.sheetLayout.flatMap(s=>s.cuts).length,p.decks.length);
  for(const sheet of p.sheetLayout){for(const c of sheet.cuts){assert.ok(c.x>=0&&c.z>=0&&c.x+c.width<=PLATFORM.sheet[1]+1e-6&&c.z+c.depth<=PLATFORM.sheet[0]+1e-6);}
   for(let i=0;i<sheet.cuts.length;i++)for(let j=i+1;j<sheet.cuts.length;j++){const a=sheet.cuts[i],b=sheet.cuts[j],k=PLATFORM.kerf-1e-7;assert.ok(a.x+a.width+k<=b.x||b.x+b.width+k<=a.x||a.z+a.depth+k<=b.z||b.z+b.depth+k<=a.z);}
  }
 }
});
test('A spanning deck waits for both frames; selecting its cut row isolates the matching piece',()=>{
 const d=projectDefaultTracking(),set=(id,n)=>d.stages.find(s=>s.id==='platform').steps.find(s=>s.id===id).percent=n;
 for(const id of ['platform-frame','platform-legs','platform-deck'])set(id,100);set('platform-join',12.5);
 const part={kind:'platform',stage:34,total:8,members:[0,1],deckIndex:0,deckTotal:4};assert.equal(projectPartStatus(part,d).assembled,false);set('platform-join',25);assert.equal(projectPartStatus(part,d).assembled,true);
 set('platform-deck',0);assert.equal(projectPartStatus(part,d).assembled,false);set('platform-deck',25);assert.equal(projectPartStatus(part,d).assembled,true);
 const selection={family:'platform',part:'Decks',deckId:'deck-1'};assert.equal(matchesCutPart(selection,'Platform deck',undefined,'deck-0'),false);assert.equal(matchesCutPart(selection,'Platform deck',undefined,'deck-1'),true);
});
test('An older platform approval does not silently approve the new deck layout',()=>{
 const design={height:120,angle:45,wallColor:'#34383b',floor:'charcoal',platformShape:'square'};
 assert.equal(approvalMatchesDesign({design,estimate:null},design),false);assert.equal(approvalMatchesDesign({design,estimate:{deckLayoutRevision:'paired-v1'}},design),true);
 assert.equal(approvalMatchesDesign({design:{...design,platformShape:'none'},estimate:null},{...design,platformShape:'none'}),true);
});
