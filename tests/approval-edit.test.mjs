import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeApprovalEstimate} from '../public/pricing-config.js';
import {laborEstimate,laborCost} from '../public/labor.js';
const helper=fs.readFileSync(new URL('../public/pricing-config.js',import.meta.url),'utf8').replaceAll('export function ','function '),worker=fs.readFileSync(new URL('../worker/index.js',import.meta.url),'utf8');
const api=(await import('data:text/javascript;base64,'+Buffer.from('const assets={};\n'+helper+'\n'+worker).toString('base64'))).default;
const design={height:120,angle:45,wallColor:'#34383b',platformShape:'square',platformAngle:90,platformBack:12,platformSide:12,platformColor:'#34383b',floor:'charcoal',floorColor:'#34383b',figures:'rap'};
const estimate={crew:2,hours:57.5,defaultHours:57.5,personHours:114.5,rates:[5000,0],materialsCents:273651,pending:10};
const ids=['43d6ed9a-6b19-498f-870c-a9e272ce1b01','43d6ed9a-6b19-498f-870c-a9e272ce1b02'];
function database(){const rows=new Map();return {rows,DB:{prepare(sql){let a;return {bind(...args){a=args;return this;},async run(){if(sql.startsWith('INSERT')){if(!rows.has(a[0]))rows.set(a[0],{id:a[0],name:a[1],design:a[2],created_at:a[3],estimate:a[4],revision:0});return {meta:{changes:1}};}const r=rows.get(a[4]);if(!r||r.revision!==a[5])return {meta:{changes:0}};Object.assign(r,{name:a[0],design:a[1],estimate:a[2],updated_at:a[3],revision:r.revision+1});return {meta:{changes:1}};},async first(){return rows.get(a[0])||null;},async all(){return {results:[...rows.values()].sort((a,b)=>b.created_at-a.created_at||b.id.localeCompare(a.id))};}}}}};}
function request(method,body,origin='https://example.com'){return new Request('https://example.com/api/approvals',{method,headers:{'Content-Type':'application/json',Origin:origin},...(body?{body:JSON.stringify(body)}:{})});}
test('Two working people with one covered rate keep all hours and only charge the paid person',()=>{
 const two=laborEstimate(design,2),one=laborEstimate(design,1);assert.equal(two.personHours,114.5);assert.equal(two.hours,57.5);assert.equal(one.personHours,two.personHours);assert.ok(one.hours>two.hours*2);
 const covered=laborCost(two.hours,[5000,0]),blank=laborCost(two.hours,[5000,null]);assert.equal(covered.costCents,287500);assert.equal(blank.costCents,covered.costCents);assert.equal(covered.unrated,0);assert.equal(blank.unrated,1);
});
test('Recorded labor distinguishes zero from unknown and derives its own totals',()=>{
 const e=normalizeApprovalEstimate({...estimate,totalCents:1,laborCents:1});assert.equal(e.laborCents,287500);assert.equal(e.totalCents,561151);assert.deepEqual(e.rates,[5000,0]);assert.equal(normalizeApprovalEstimate(null),null);
 for(const patch of [{crew:0},{crew:13},{hours:-1},{rates:[5000]},{rates:[5000,-1]},{rates:[Infinity,0]},{materialsCents:1.5}])assert.throws(()=>normalizeApprovalEstimate({...estimate,...patch}));
});
test('Edits retain id and creation order, save the estimate, and prevent stale overwrites',async()=>{
 const db=database(),env={DB:db.DB};
 for(const [i,id]of ids.entries()){const r=await api.fetch(request('POST',{id,name:'Jeff '+i,design}),env);assert.equal(r.status,201);db.rows.get(id).created_at=100+i;}
 const payload={id:ids[0],revision:0,name:'Jeff revised',design:{...design,angle:60},estimate};
 let response=await api.fetch(request('PATCH',payload),env);assert.equal(response.status,200);const saved=(await response.json()).approval;assert.equal(saved.id,ids[0]);assert.equal(saved.createdAt,100);assert.equal(saved.revision,1);assert.equal(saved.design.angle,60);assert.equal(saved.estimate.laborCents,287500);assert.ok(saved.updatedAt);
 response=await api.fetch(request('PATCH',payload),env);assert.equal(response.status,200,'identical retry is safe');
 assert.equal((await api.fetch(request('PATCH',{...payload,name:'Stale other edit'}),env)).status,409);
 const list=await(await api.fetch(request('GET'),env)).json();assert.equal(list.approvals[0].id,ids[1],'editing an older approval does not promote it');assert.equal(list.approvals[1].name,'Jeff revised');assert.equal(list.approvals[0].estimate,null,'older estimates remain unrecorded');
 assert.equal((await api.fetch(request('PATCH',{...payload,revision:1},'https://other.example'),env)).status,403);
 assert.equal((await api.fetch(request('PATCH',{...payload,revision:1,estimate:{...estimate,crew:0}}),env)).status,400);
 assert.equal((await api.fetch(request('PATCH',{...payload,id:'43d6ed9a-6b19-498f-870c-a9e272ce1b03'}),env)).status,404);
});
