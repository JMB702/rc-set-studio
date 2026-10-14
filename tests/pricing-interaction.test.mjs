import test from 'node:test';
import assert from 'node:assert/strict';
import {installCanvasTap,pricingIsolationAllowed,pricingPartOpaque} from '../public/pricing-interaction.js';

function harness(enabled=()=>true){
 const canvas=new EventTarget(),taps=[];
 const controls=installCanvasTap(canvas,{enabled,onTap:event=>taps.push(event)});
 const send=(type,properties={})=>{
  const event=new Event(type);
  Object.assign(event,{pointerId:1,pointerType:'mouse',isPrimary:true,button:0,clientX:100,clientY:100,...properties});
  canvas.dispatchEvent(event);
  return event;
 };
 return {send,taps,...controls};
}

test('material isolation belongs only to the Pricing breakdown tab',()=>{
 for(const mode of ['finished','build','cameras'])for(const tab of ['pricing','finance','tracking'])assert.equal(pricingIsolationAllowed(mode,tab),false);
 assert.equal(pricingIsolationAllowed('pricing','pricing'),true);
 for(const tab of ['finance','tracking','',undefined])assert.equal(pricingIsolationAllowed('pricing',tab),false);
});

test('finance and tracking canvas taps cannot select materials; a deliberate breakdown tap can',()=>{
 let tab='finance';const h=harness(()=>pricingIsolationAllowed('pricing',tab));
 for(tab of ['finance','tracking']){h.send('pointerdown');h.send('pointerup');}
 assert.equal(h.taps.length,0);
 tab='pricing';h.send('pointerdown');const release=h.send('pointerup',{clientX:102,clientY:101});
 assert.deepEqual(h.taps,[release]);
 h.dispose();
});

test('a looping orbit drag is not a tap even when it ends at the starting point',()=>{
 const h=harness();h.send('pointerdown');h.send('pointermove',{clientX:140});h.send('pointermove',{clientX:100});h.send('pointerup');
 assert.equal(h.taps.length,0);
 h.send('pointerdown');h.send('pointerup',{clientX:130});
 assert.equal(h.taps.length,0,'a release far from the start also rejects a drag without move events');
 h.dispose();
});

test('pointer cancellation and a two-finger orbit never select a material',()=>{
 const h=harness();h.send('pointerdown');h.send('pointercancel');h.send('pointerup');
 assert.equal(h.taps.length,0);
 h.send('pointerdown',{pointerType:'touch'});
 h.send('pointerdown',{pointerType:'touch',pointerId:2,isPrimary:false});
 h.send('pointerup',{pointerType:'touch',pointerId:2,isPrimary:false});
 h.send('pointerup',{pointerType:'touch'});
 assert.equal(h.taps.length,0);
 h.send('pointerdown');h.send('pointerup');
 assert.equal(h.taps.length,1,'a fresh gesture after multitouch still works');
 h.dispose();
});

test('non-left buttons and mismatched pointer releases cannot select',()=>{
 const h=harness();for(const button of [1,2]){h.send('pointerdown',{button});h.send('pointerup',{button});}
 assert.equal(h.taps.length,0);
 h.send('pointerdown',{pointerId:4});h.send('pointerup',{pointerId:5});
 assert.equal(h.taps.length,0);
 h.reset();h.send('pointerup',{pointerId:4});
 assert.equal(h.taps.length,0);
 h.dispose();
});

test('a secondary touch cannot select when the primary touch began outside the canvas',()=>{
 const h=harness();
 h.send('pointerdown',{pointerType:'touch',pointerId:2,isPrimary:false});
 h.send('pointerup',{pointerType:'touch',pointerId:2,isPrimary:false});
 assert.equal(h.taps.length,0);
 h.dispose();
});

test('changing preview or tab during a gesture cancels selection',()=>{
 let enabled=true;const h=harness(()=>enabled);
 h.send('pointerdown');h.reset();h.send('pointerup');assert.equal(h.taps.length,0);
 h.send('pointerdown');enabled=false;h.send('pointerup');assert.equal(h.taps.length,0);
 h.send('pointerdown');enabled=true;h.send('pointerup');assert.equal(h.taps.length,0,'a gesture started while disabled must remain ineligible');
 h.send('pointerdown');h.send('pointerup');assert.equal(h.taps.length,1);
 h.dispose();h.send('pointerdown');h.send('pointerup');assert.equal(h.taps.length,1,'disposing removes event listeners');
});


test('Finished and lighting previews keep every physical part opaque, including unpriced ballast',()=>{
 const available=new Set(['skin','platformLumber']);
 for(const tags of [['bags','sand','tallBallast'],['skin'],['platformLumber'],[]]){
  for(const selected of [null,'skin','platformLumber'])assert.equal(pricingPartOpaque(tags,available,selected,true),true);
  assert.equal(pricingPartOpaque(tags,available,null,false),true,'No isolation means full base opacity; build progress supplies its own shading');
 }
 assert.equal(pricingIsolationAllowed('pricing','pricing',true),false,'Complete previews cannot start row or canvas isolation');
 assert.equal(pricingPartOpaque(['bags','sand'],new Set(['sand']),'sand',false),true,'Secondary cost tags can be selected');
 assert.equal(pricingPartOpaque(['bags','sand'],available,'skin',false),false,'Intentional construction-view isolation still works');
});
