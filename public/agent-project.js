// Shared agent adapter: all quantities, tax and projections come from the UI's calculators.
import {priceRows,materialTax,summary} from './pricing-calc.js';
import {normalizeConfiguration,customizeRows} from './pricing-config.js';
import {laborFor} from './labor.js';
import {projectCost} from './projection.js';

export function agentProject(data,context,{source='shared-build',configuration=null,configurationId=null,now=context.readAt}={}){
 let selected,provenance;
 if(source==='active-draft'||source==='supplied'){
  if(!configuration)throw Error('An explicit configuration is required for a draft.');
  selected=configuration;provenance={source,persisted:false};
 }else if(source==='saved'){
  const saved=context.configurations.find(c=>c.id===configurationId);if(!saved)throw Error('Saved configuration not found.');
  selected=saved.configuration;provenance={source,id:saved.id,createdAt:saved.createdAt,persisted:true};
 }else if(source==='shared-build'){
  selected=context.tracking?.data?.design;
  provenance={source,revision:context.tracking?.revision??null,persisted:!!selected};
  if(!selected){const latest=context.approvals[0];if(!latest)throw Error('No shared build or approval exists. Supply a configuration explicitly.');selected=latest.design;provenance={source:'latest-approval',id:latest.id,revision:latest.revision,persisted:true};}
 }else throw Error('Unknown configuration source.');
 const config=normalizeConfiguration({version:1,scope:'set',supports:true,ballast:true,finishes:true,excluded:[],customItems:[],...selected});
 const rows=customizeRows(priceRows(data,config),config),finance=context.financeIncluded?context.finance?.data:null;
 const labor=laborFor(config,finance?.crew??null),materials=summary(rows),taxCents=materialTax(rows);
 const projection=finance?projectCost({rows,finance,tracking:context.tracking?.data,design:config,labor,now}):null;
 return {version:1,readAt:context.readAt,calculatedAt:now,provenance,configuration:config,sharedBuild:context.tracking,approvals:context.approvals,savedConfigurations:context.configurations,
  estimate:{materialsCents:materials.subtotal,taxCents,pending:materials.pending,labor,totalCents:materials.subtotal+taxCents+(labor.costCents??0),shippingIncluded:false},
  materials:rows.map(row=>({row,...(projection?.materials.plan.find(p=>p.row.id===row.id)??{status:'unknown',reason:'Private purchase records not requested or unavailable'}),supplierEvidence:{productUrl:row.productUrl??null,checkedDate:row.checkedDate??null,observedStock:row.observedStock??null,availability:row.availability??null,fulfillment:row.fulfillment??null,currentStockVerified:false}})),
  projection,financeRevision:context.finance?.revision??null,receipts:context.financeIncluded?context.receipts:null,expenses:finance?.expenses??null};
}

export async function readAgentProject({baseUrl,source='shared-build',configuration=null,configurationId=null,includeFinance=false,expectedEngineRevision=null,fetcher=fetch}){
 const base=new URL(baseUrl),get=async path=>{const response=await fetcher(new URL(path,base));if(!response.ok)throw Error(`Project read failed (${response.status}).`);return response.json();};
 const [data,context]=await Promise.all([get('/data/flat-shopping-list.json'),get('/api/project/agent-context'+(includeFinance?'?finance=1':''))]);
 if(expectedEngineRevision&&context.engineRevision!==expectedEngineRevision)throw Error('Calculator version differs from the deployed site. Use its matching source revision or WebMCP.');
 return agentProject(data,context,{source,configuration,configurationId});
}

export function installAgentProject(api){
 const ctx=document.modelContext;if(!ctx?.registerTool)return;
 const controller=new AbortController();window.addEventListener('pagehide',()=>controller.abort(),{once:true});
 try{Promise.resolve(ctx.registerTool({name:'read_project',title:'Read project estimate and purchases',description:'Structured project snapshot using the same calculations as the UI. Choose active-draft, shared-build or saved explicitly. Private receipts/purchases require the existing unlocked session; never supply a PIN to this tool. Supplier evidence is historical, not live stock.',inputSchema:{type:'object',properties:{source:{type:'string',enum:['active-draft','shared-build','saved']},configurationId:{type:'string'},includeFinance:{type:'boolean'}},required:['source'],additionalProperties:false},annotations:{readOnlyHint:true},execute:async input=>{if(!input||typeof input!=='object'||Object.keys(input).some(k=>!['source','configurationId','includeFinance'].includes(k))||!['active-draft','shared-build','saved'].includes(input.source)||input.includeFinance!==undefined&&typeof input.includeFinance!=='boolean'||input.configurationId!==undefined&&typeof input.configurationId!=='string')throw Error('Invalid project read request.');await api.pricingReady;return readAgentProject({baseUrl:location.href,...input,configuration:input.source==='active-draft'?api.agentConfiguration():null});}},{signal:controller.signal})).catch(()=>console.warn('Project tool registration unavailable.'));}catch{console.warn('Project tool registration unavailable.');}
}
