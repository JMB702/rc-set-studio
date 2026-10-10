import test from 'node:test';
import assert from 'node:assert/strict';
import {laborTasks,laborEstimate,laborCost,crewFactor,LABOR} from '../public/labor.js';
const base={height:120,angle:45,platformShape:'square',platformAngle:90,platformBack:12,platformSide:12,floor:'charcoal'};
const ids=d=>laborTasks(d).map(t=>t.id);
test('Labor follows the design: no platform or floor removes their tasks',()=>{
 assert.ok(ids(base).includes('platformFrame')&&ids(base).includes('floor'));
 assert.ok(!ids({...base,platformShape:'none'}).some(id=>id.startsWith('platform')));
 assert.ok(!ids({...base,floor:'none'}).includes('floor'));
 const full=laborEstimate(base).personHours,noPlatform=laborEstimate({...base,platformShape:'none'}).personHours,bare=laborEstimate({...base,platformShape:'none',floor:'none'}).personHours;
 assert.ok(full>noPlatform&&noPlatform>bare);
});
test('10′ walls take longer than 8′ walls',()=>{
 for(const d of [base,{...base,platformShape:'none',floor:'none'}])assert.ok(laborEstimate(d).personHours>laborEstimate({...d,height:96}).personHours);
});
test('The angled platform follows its module plan and takes longer than the square one',()=>{
 assert.ok(laborEstimate({...base,platformShape:'angled',platformAngle:45}).personHours>laborEstimate(base).personHours);
});
test('Older saves with floor "platform" estimate as an angled platform with no floor',()=>{
 assert.deepEqual(ids({height:96,angle:45,floor:'platform'}),ids({height:96,angle:45,floor:'none',platformShape:'angled',platformAngle:45}));
});
test('The default crew is two people and hours are person-hours split across the crew',()=>{
 assert.equal(LABOR.crew,2);
 const two=laborEstimate(base);assert.equal(two.crew,2);assert.equal(two.hours,Math.ceil((two.personHours-two.shoppingHours)/2*2)/2);
 assert.ok(laborEstimate(base,1).hours>two.hours*2,'one person is slowed by the two-person lifts');
 assert.ok(laborEstimate(base,4).hours<two.hours&&laborEstimate(base,4).hours>two.hours/2,'extra people help less than the first two');
 assert.equal(crewFactor(0),crewFactor(1));assert.equal(crewFactor(99),crewFactor(LABOR.maxCrew));
 for(const c of [1,2,3,5])assert.equal(laborEstimate(base,c).hours%0.5,0);
});
test('Each person has their own rate; people without one are left out of the cost',()=>{
 assert.deepEqual(laborCost(10,[null,null]),{costCents:null,crewRateCents:null,unrated:2});
 assert.deepEqual(laborCost(10,[4500,3000]),{costCents:75000,crewRateCents:7500,unrated:0});
 assert.deepEqual(laborCost(10,[4500,null]),{costCents:45000,crewRateCents:4500,unrated:1});
 assert.equal(laborCost(57.5,[4500,3000]).costCents,431250);
});

test('Shopping keeps reported time separate from remaining allowance and does not scale with crew size',()=>{
 const one=laborEstimate(base,1),two=laborEstimate(base,2);assert.equal(one.shoppingHours,8.5);assert.equal(two.shoppingHours,8.5);
 assert.equal(two.tasks.find(t=>t.id==='shoppingDone').personHours,3.5);assert.equal(two.tasks.find(t=>t.id==='shoppingRemaining').personHours,5);
 assert.doesNotMatch(two.tasks.find(t=>t.id==='setup').name,/pickup/i);
});
