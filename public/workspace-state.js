import {normalizeDesign} from './pricing-config.js';
export const workspaceKey='rc-set-workspace-v1';
export function normalizeWorkspace(raw){
  if(!raw||raw.version!==1||!['finished','build','pricing','cameras'].includes(raw.mode))throw Error('Invalid workspace');
  const design=normalizeDesign(raw.design);
  if(raw.design.figureScale!==undefined){if(!Number.isFinite(raw.design.figureScale)||raw.design.figureScale<.8||raw.design.figureScale>1.25)throw Error('Invalid figure scale');design.figureScale=raw.design.figureScale;}
  if(raw.design.clothing){design.clothing={};for(const person of ['host','woman','rapper']){const clothes=raw.design.clothing[person];if(!clothes)continue;design.clothing[person]={};for(const part of ['shirt','pants']){if(clothes[part]!==undefined){if(!/^#[0-9a-f]{6}$/i.test(clothes[part]))throw Error('Invalid clothing');design.clothing[person][part]=clothes[part];}}}}
  const stage=raw.stage??0;if(!Number.isInteger(stage)||stage<0||stage>42)throw Error('Invalid guide stage');
  const jackViewRevision=raw.jackViewRevision===1?1:0;let camera=null;
  if(raw.camera&&!(raw.mode==='build'&&stage>=13&&stage<=16&&jackViewRevision===0)){const c=raw.camera,vector=v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=1000);
    if(vector(c.position)&&vector(c.target)&&Math.hypot(...c.position.map((n,i)=>n-c.target[i]))>.01&&Number.isFinite(c.mm)&&c.mm>=14&&c.mm<=200&&['16:9','9:16'].includes(c.ratio))camera={position:[...c.position],target:[...c.target],mm:c.mm,ratio:c.ratio,on:c.on===true};
  }
  const scroll=v=>Number.isFinite(v)?Math.max(0,Math.min(100000,v)):0;
  return {version:1,jackViewRevision,mode:raw.mode,design,stage,camera,scrollY:scroll(raw.scrollY),panelScroll:scroll(raw.panelScroll),openDetails:Array.isArray(raw.openDetails)?raw.openDetails.filter(id=>typeof id==='string'&&/^[a-z][a-z0-9-]{0,60}$/.test(id)).slice(0,30):[]};
}
export function readWorkspace(defaults,storage){
  try{storage??=localStorage;const raw=storage.getItem(workspaceKey);if(raw)return normalizeWorkspace(JSON.parse(raw));
    // Upgrade the former guide-only progress record on the first visit after this release.
    const legacy=JSON.parse(storage.getItem('rc-set-build-progress-v1'));if(legacy)return normalizeWorkspace({version:1,mode:'build',design:{...defaults,...legacy},stage:legacy.stage});
  }catch{}return null;
}
export function saveWorkspace(raw,storage){try{storage??=localStorage;storage.setItem(workspaceKey,JSON.stringify(normalizeWorkspace(raw)));return true;}catch{return false;}}
