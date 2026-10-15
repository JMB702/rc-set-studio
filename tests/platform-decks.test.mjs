import test from 'node:test';
import assert from 'node:assert/strict';
import {platformPlan,PLATFORM,area} from '../public/platform.js';
import {projectDefaultTracking,projectPartStatus} from '../public/project-model.js';
import {matchesCutPart} from '../public/cut-selection.js';
import {approvalMatchesDesign} from '../public/pricing-config.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
test('Rotated decks keep full-width sheets running front to back and need fewer saw cuts',()=>{
 const approved=platformPlan(90,18,18,90,{platformFront:12}),square=platformPlan(45,12,12,90),angled=platformPlan(45,12,12,45);
 assert.deepEqual([approved.modules.length,approved.decks.length,approved.deckSheets,approved.deckCuts],[2,4,4,5]);
 assert.deepEqual(approved.decks.map(d=>[d.rip,d.crosscut]),[[false,true],[false,true],[false,true],[true,true]],'only the last deck is ripped');
 for(const d of approved.decks.slice(0,3)){assert.equal(d.width,PLATFORM.sheet[0]);assert.equal(d.depth,66);}
 assert.deepEqual(approved.modules.map(m=>[Math.round(m.width),m.depth]),[[96,66],[60,66]],'full-depth frames as wide as one stud allows');assert.equal(approved.counts.seamJoists,4,'each plywood joint inside a frame sits on a doubled pair');
 assert.deepEqual([...new Set(approved.modules.flatMap(m=>m.joists.map(j=>j.length)))],[45],'every joist is the same length');
 // Every corner joins the same way: front and back rims run through, side rims fit between them.
 for(const m of approved.modules)for(const r of m.rims){const e=m.edges[r.edge];close(r.length,Math.abs(e.u[0])>.5?e.len:e.len-3);}
 assert.deepEqual([...new Set(approved.lumberLengths.map(l=>Math.round(l*16)/16))].sort((a,b)=>b-a),[96,63,60,45,9.4375],'five cut lengths');
 for(const m of approved.modules)for(const r of m.rims)assert.ok(r.length<=PLATFORM.stud,'every rim is one stud');
 assert.ok(approved.modules.every(m=>m.joists.every(j=>j.length>=PLATFORM.joistOC)),'no joist stubs in narrow bays');
 assert.deepEqual([square.modules.length,square.decks.length,square.deckSheets],[2,4,4]);assert.deepEqual([angled.modules.length,angled.decks.length,angled.deckSheets],[5,7,7]);
 assert.equal(approved.deckScrews,197);assert.equal(approved.deckSeamLength,198);
 assert.equal(platformPlan(90,0,0,90).deckCuts,0,'a flush 16′ × 8′ platform uses four whole sheets');
});
test('Decks cover the outline once, every deck edge is supported, and stock cuts fit without overlap',()=>{
 for(const angle of [0,15,30,45,60,75,90])for(const back of [0,12,24,48])for(const side of [0,12,24,48])for(const pa of [angle,90]){
  const p=platformPlan(angle,back,side,pa),members=new Set(p.decks.flatMap(d=>d.moduleIndices));assert.deepEqual([...members].sort((a,b)=>a-b),p.modules.map((_,i)=>i));
  close(p.decks.reduce((s,d)=>s+Math.abs(area(d.nominalPoly)),0),p.deckArea*144);
  for(const d of p.decks){assert.ok(d.moduleIndices.length<=2);assert.ok(d.width<=PLATFORM.sheet[0]+1e-7&&d.depth<=PLATFORM.sheet[1]+1e-7);assert.ok(d.edgeAllowance.x<=3/64+1e-7&&d.edgeAllowance.z<=3/64+1e-7);
   // Every deck edge sits on a rim line of a supporting frame or over a seam joist.
   for(const e of d.edges){const mid=[(e.A[0]+e.B[0])/2,(e.A[1]+e.B[1])/2];assert.ok(d.moduleIndices.some(i=>p.modules[i].edges.some(f=>Math.abs(f.n[0]*mid[0]+f.n[1]*mid[1]-f.c)<1e-5)||p.modules[i].seamJoists.some(j=>Math.abs(j.x-mid[0])<1e-5)),`deck ${d.label} edge supported at ${angle}°`);}
  }
  // Legs never land on a joist or seam joist, and every frame piece fits one stud.
  const box=pg=>{const xs=pg.map(q=>q[0]),zs=pg.map(q=>q[1]);return [Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs)];};
  for(const m of p.modules)for(const l of m.legs)for(const j of [...m.joists,...m.seamJoists]){const a=box(l.poly),b=box(j.poly);assert.ok(!(a[0]<b[1]-1e-6&&a[1]>b[0]+1e-6&&a[2]<b[3]-1e-6&&a[3]>b[2]+1e-6),`leg clear of joists at ${angle}°`);}
  assert.ok(p.lumberLengths.every(l=>l<=PLATFORM.stud+1e-6));
  assert.equal(p.sheetLayout.flatMap(s=>s.cuts).length,p.decks.length);assert.equal(p.deckCuts,p.decks.reduce((s,d)=>s+d.sawCuts,0));
  for(const sheet of p.sheetLayout){for(const c of sheet.cuts){assert.ok(c.x>=0&&c.z>=0&&c.x+c.width<=PLATFORM.sheet[0]+1e-6&&c.z+c.depth<=PLATFORM.sheet[1]+1e-6);}
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
 assert.equal(approvalMatchesDesign({design,estimate:null},design),false);assert.equal(approvalMatchesDesign({design,estimate:{deckLayoutRevision:'paired-v1'}},design),false);assert.equal(approvalMatchesDesign({design,estimate:{deckLayoutRevision:'rotated-v1'}},design),true);
 assert.equal(approvalMatchesDesign({design:{...design,platformShape:'none'},estimate:null},{...design,platformShape:'none'}),true);
});
