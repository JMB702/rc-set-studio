export function optionalLink(value){const text=String(value??'').trim();if(!text)return '';const url=new URL(/^[a-z][a-z\d+.-]*:/i.test(text)?text:'https://'+text);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Use an http or https link.');if(url.href.length>2048)throw Error('Link is too long.');return url.href;}
export function dollarsToCents(value){const text=String(value??'').trim();if(!text)return 0;if(!/^\d{1,8}(\.\d{1,2})?$/.test(text))throw Error('Enter a nonnegative price with up to two decimal places.');const [whole,fraction='']=text.split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));}
export function normalizeCustom(item){
 if(!item||typeof item!=='object')throw Error('Invalid custom item.');
 const title=typeof item.title==='string'?item.title.trim():'',description=typeof item.description==='string'?item.description.trim():'';
 if(!title||title.length>160)throw Error('Enter a title (up to 160 characters).');if(description.length>2000)throw Error('Description is too long.');
 const quantity=item.quantity??1,unitPriceCents=item.unitPriceCents??0;
 if(!Number.isInteger(quantity)||quantity<1||quantity>10000||!Number.isSafeInteger(unitPriceCents)||unitPriceCents<0||unitPriceCents>9999999999)throw Error('Invalid quantity or price.');
 if(typeof item.id!=='string'||!/^custom-[0-9a-f-]{36}$/i.test(item.id))throw Error('Invalid custom item ID.');
 return {id:item.id,title,description,link:optionalLink(item.link),quantity,unitPriceCents};
}
export function normalizeConfiguration(input){
 if(!input||typeof input!=='object'||input.version!==1)throw Error('Unsupported pricing configuration.');
 if(!['set','panel','floor'].includes(input.scope)||![96,120].includes(input.height)||!Number.isInteger(input.angle)||input.angle<0||input.angle>90||!['none','wood','charcoal','platform'].includes(input.floor))throw Error('Invalid set configuration.');
 // floor:'platform' was the earlier way to save a platform with no floor under it.
 const legacy=input.floor==='platform',floor=legacy?'none':input.floor,platformShape=input.platformShape??(legacy?((input.platformAngle??input.angle)>=90?'square':'angled'):'none');if(!['none','angled','square'].includes(platformShape))throw Error('Invalid platform shape.');
 const platformColor=input.platformColor??'#34383b';if(typeof platformColor!=='string'||!/^#[0-9a-f]{6}$/i.test(platformColor))throw Error('Invalid platform color.');
 const platformBack=input.platformBack??12,platformSide=input.platformSide??12;if(![platformBack,platformSide].every(v=>Number.isInteger(v)&&v>=0&&v<=48))throw Error('Invalid platform gap.');
 const platformAngle=platformShape==='square'?90:Math.max(input.angle,input.platformAngle??input.angle);if(!Number.isInteger(platformAngle)||platformAngle>90)throw Error('Invalid platform angle.');
 const floorColor=input.floorColor??'#34383b';if(typeof floorColor!=='string'||!/^#[0-9a-f]{6}$/i.test(floorColor))throw Error('Invalid floor color.');
 const wallColor=input.wallColor??'#34383b';if(typeof wallColor!=='string'||!/^#[0-9a-f]{6}$/i.test(wallColor))throw Error('Invalid wall color.');
 if(!['supports','ballast','finishes'].every(k=>typeof input[k]==='boolean'))throw Error('Invalid material options.');
 if(!Array.isArray(input.excluded)||input.excluded.length>200||input.excluded.some(id=>typeof id!=='string'||!/^[-a-zA-Z\d]{1,80}$/.test(id)))throw Error('Invalid removed items.');
 if(!Array.isArray(input.customItems)||input.customItems.length>100)throw Error('Too many custom items.');const customItems=input.customItems.map(normalizeCustom);if(new Set(customItems.map(i=>i.id)).size!==customItems.length)throw Error('Duplicate custom item IDs.');
 return {version:1,scope:input.scope,height:input.height,angle:input.angle,floor,platformShape,platformBack,platformSide,platformAngle,platformColor:platformColor.toLowerCase(),wallColor:wallColor.toLowerCase(),floorColor:floorColor.toLowerCase(),supports:input.supports,ballast:input.ballast,finishes:input.finishes,excluded:[...new Set(input.excluded)],customItems};
}
export function customizeRows(rows,configuration){const excluded=new Set(configuration.excluded);return [...rows.filter(r=>!excluded.has(r.id)),...configuration.customItems.map(i=>({id:i.id,custom:true,name:i.title,description:i.description,availability:i.description,productUrl:i.link,purchaseQuantity:i.quantity,packSize:1,needed:i.quantity,unitPriceCents:i.unitPriceCents,subtotalCents:i.quantity*i.unitPriceCents,group:'custom'}))];}
export function removedPart(tags,floor,excluded){const physical=tags.includes('laminate')?(floor==='wood'?'laminate':'floorPly'):tags[0];return excluded.includes(physical);}
// An approved design: every setting the design panel controls, validated the same way in the browser and the Worker.
export function normalizeDesign(input){
 if(!input||typeof input!=='object')throw Error('Invalid design.');
 const hex=(v,name)=>{if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))throw Error('Invalid '+name+' color.');return v.toLowerCase();};
 const angle=Number(input.angle);if(![96,120].includes(input.height)||!Number.isFinite(angle)||angle<0||angle>90)throw Error('Invalid wall height or angle.');
 const legacy=input.floor==='platform',floor=legacy?'none':input.floor,platformShape=input.platformShape??(legacy?'angled':'none');
 if(!['none','wood','charcoal'].includes(floor)||!['none','angled','square'].includes(platformShape))throw Error('Invalid floor or platform.');
 const platformBack=input.platformBack??12,platformSide=input.platformSide??12;if(![platformBack,platformSide].every(v=>Number.isInteger(v)&&v>=0&&v<=48))throw Error('Invalid platform gap.');
 const a=Math.round(angle),pa=platformShape==='square'?90:Math.round(Math.max(a,Number(input.platformAngle??a)));if(!Number.isFinite(pa)||pa>90)throw Error('Invalid platform angle.');
 const figures=input.figures??'rap';if(!['podcast','rap'].includes(figures))throw Error('Invalid figures.');
 return {height:input.height,angle:a,wallColor:hex(input.wallColor,'wall'),platformShape,platformAngle:pa,platformBack,platformSide,platformColor:hex(input.platformColor??'#34383b','platform'),floor,floorColor:hex(input.floorColor??'#34383b','floor'),figures};
}

// The estimate actually reviewed with an approval. Older approvals have no recorded estimate.
export function normalizeApprovalEstimate(input){
 if(input==null)return null;
 const n=(v,name,max=1000000000)=>{if(!Number.isFinite(v)||v<0||v>max)throw Error('Invalid '+name+'.');return v;};
 const crew=n(input.crew,'crew',12);if(!Number.isInteger(crew)||crew<1)throw Error('Invalid crew.');
 const hours=n(input.hours,'labor hours',10000),defaultHours=n(input.defaultHours,'estimated hours',10000),personHours=n(input.personHours,'person-hours',100000);
 if(hours<.5||defaultHours<.5||personHours<=0)throw Error('Invalid labor hours.');
 if(!Array.isArray(input.rates)||input.rates.length!==crew)throw Error('Enter one rate per crew member.');
 const rates=input.rates.map(r=>{if(r===null)return null;n(r,'hourly rate',10000000);if(!Number.isInteger(r))throw Error('Rates must be whole cents.');return r;});
 const materialsCents=n(input.materialsCents,'material total'),pending=n(input.pending,'pending materials',10000);
 if(!Number.isInteger(materialsCents)||!Number.isInteger(pending))throw Error('Invalid material total.');
 if(input.deckLayoutRevision!==undefined&&input.deckLayoutRevision!=='paired-v1')throw Error('Invalid deck layout revision.');
 const shoppingHours=n(input.shoppingHours??0,'shopping hours',10000),shoppingRateCents=input.shoppingRateCents==null?null:n(input.shoppingRateCents,'shopping rate',10000000),taxCents=n(input.taxCents??0,'estimated tax');if(!Number.isInteger(taxCents)||shoppingRateCents!==null&&!Number.isInteger(shoppingRateCents))throw Error('Use whole cents for tax and shopping rate.');
 const priced=rates.filter(r=>r!==null),laborCents=priced.length||shoppingRateCents!==null?Math.round(hours*priced.reduce((s,r)=>s+r,0)+shoppingHours*(shoppingRateCents??0)):null;
 return {...(input.deckLayoutRevision?{deckLayoutRevision:input.deckLayoutRevision}:{}),crew,hours,defaultHours,personHours,rates,shoppingHours,shoppingRateCents,taxCents,materialsCents,pending,laborCents,totalCents:materialsCents+taxCents+(laborCents??0)};
}

export function approvalMatchesDesign(approval,design){return JSON.stringify(normalizeDesign(approval.design))===JSON.stringify(normalizeDesign(design))&&(normalizeDesign(design).platformShape==='none'||approval.estimate?.deckLayoutRevision==='paired-v1');}
