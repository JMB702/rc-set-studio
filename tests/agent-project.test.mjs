import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {agentProject} from '../public/agent-project.js';
import {priceRows,materialTax} from '../public/pricing-calc.js';
import {customizeRows} from '../public/pricing-config.js';
import {projectDefaultTracking} from '../public/project-model.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/data/flat-shopping-list.json',import.meta.url)));
const design={height:120,angle:90,floor:'charcoal',platformShape:'square',wallColor:'#34383b'};
const context={readAt:1000,tracking:{data:{...projectDefaultTracking(),design},revision:4},approvals:[],configurations:[],financeIncluded:false};
test('Agent estimates reuse UI rows and taxes for dynamic designs',()=>{
 for(const floorLip of [false,true])for(const height of [96,120])for(const angle of [0,45,90])for(const floor of ['none','wood','charcoal'])for(const seamlessCorners of [false,true]){
 const s=agentProject(data,context,{source:'supplied',configuration:{...design,height,angle,floor,floorLip,seamlessCorners,seamlessPerimeter:true}});
 const rows=customizeRows(priceRows(data,s.configuration),s.configuration);
 assert.deepEqual(s.materials.map(x=>x.row),rows);assert.equal(s.estimate.taxCents,materialTax(rows));assert.equal(s.estimate.labor.costCents,null);assert.ok(s.materials.every(x=>x.status==='unknown'));
 }
});
test('Provenance distinguishes draft, saved and shared designs; absent shared design is explicit',()=>{
 assert.equal(agentProject(data,context).provenance.source,'shared-build');
 const draft=agentProject(data,context,{source:'active-draft',configuration:{...design,seamlessCorners:true}});assert.equal(draft.configuration.seamlessCorners,true);assert.equal(draft.sharedBuild.data.design.seamlessCorners,undefined);
 assert.throws(()=>agentProject(data,{...context,tracking:null}),/No shared/);
 assert.throws(()=>agentProject(data,context,{source:'saved',configurationId:'missing'}),/not found/);
});
test('Receipt totals stay tax-inclusive, partial purchases and outside-plan links survive',()=>{
 const expenses=[{id:'e',amountCents:10700,items:[{materialId:'floorPly',quantity:1,amountCents:10000,complete:false},{materialId:'old-row',quantity:1,amountCents:0,complete:true}]}];
 const s=agentProject(data,{...context,financeIncluded:true,finance:{revision:7,data:{crew:[],expenses,shifts:[]}},receipts:[{id:'receipt',filename:'receipt.jpg'}]});
 assert.equal(s.projection.materials.spentCents,10700);assert.equal(s.materials.find(x=>x.row.id==='floorPly').status,'partial');assert.equal(s.projection.materials.outsidePlan.length,1);assert.equal(s.financeRevision,7);
 const locked=agentProject(data,{...context,finance:{data:{expenses}},receipts:[{id:'secret'}]});assert.equal(locked.expenses,null);assert.equal(locked.receipts,null);assert.equal(locked.projection,null);
});

test('Transport rejects calculator drift before calculating',async()=>{
 const {readAgentProject}=await import('../public/agent-project.js');
 await assert.rejects(readAgentProject({baseUrl:'https://example.test',expectedEngineRevision:'local',fetcher:async url=>Response.json(url.pathname.includes('agent-context')?{...context,engineRevision:'remote'}:data)}),/Calculator version/);
});

test('WebMCP validates input and uses the active pricing snapshot without a mutation',async()=>{
 const {installAgentProject}=await import('../public/agent-project.js');let tool;
 const previous={document:globalThis.document,window:globalThis.window,location:globalThis.location,fetch:globalThis.fetch};
 try{
 globalThis.document={modelContext:{registerTool:t=>{tool=t;}}};globalThis.window={addEventListener(){}};globalThis.location={href:'https://example.test'};
 globalThis.fetch=async url=>Response.json(url.pathname.includes('agent-context')?context:data);
 installAgentProject({pricingReady:Promise.resolve(),agentConfiguration:()=>({...design,seamlessCorners:true})});
 await assert.rejects(tool.execute({source:'shared-build',includeFinance:'yes'}),/Invalid/);
 const result=await tool.execute({source:'active-draft'});assert.equal(result.provenance.source,'active-draft');assert.equal(result.configuration.seamlessCorners,true);
 }finally{Object.assign(globalThis,previous);}
});
