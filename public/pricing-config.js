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
 if(!['set','panel','floor'].includes(input.scope)||![96,120].includes(input.height)||!Number.isInteger(input.angle)||input.angle<0||input.angle>90||!['wood','charcoal'].includes(input.floor))throw Error('Invalid set configuration.');
 const wallColor=input.wallColor??'#34383b';if(typeof wallColor!=='string'||!/^#[0-9a-f]{6}$/i.test(wallColor))throw Error('Invalid wall color.');
 if(!['supports','ballast','finishes'].every(k=>typeof input[k]==='boolean'))throw Error('Invalid material options.');
 if(!Array.isArray(input.excluded)||input.excluded.length>200||input.excluded.some(id=>typeof id!=='string'||!/^[-a-zA-Z\d]{1,80}$/.test(id)))throw Error('Invalid removed items.');
 if(!Array.isArray(input.customItems)||input.customItems.length>100)throw Error('Too many custom items.');const customItems=input.customItems.map(normalizeCustom);if(new Set(customItems.map(i=>i.id)).size!==customItems.length)throw Error('Duplicate custom item IDs.');
 return {version:1,scope:input.scope,height:input.height,angle:input.angle,floor:input.floor,wallColor:wallColor.toLowerCase(),supports:input.supports,ballast:input.ballast,finishes:input.finishes,excluded:[...new Set(input.excluded)],customItems};
}
export function customizeRows(rows,configuration){const excluded=new Set(configuration.excluded);return [...rows.filter(r=>!excluded.has(r.id)),...configuration.customItems.map(i=>({id:i.id,custom:true,name:i.title,description:i.description,availability:i.description,productUrl:i.link,purchaseQuantity:i.quantity,packSize:1,needed:i.quantity,unitPriceCents:i.unitPriceCents,subtotalCents:i.quantity*i.unitPriceCents,group:'custom'}))];}
export function removedPart(tags,floor,excluded){const physical=tags.includes('laminate')?(floor==='wood'?'laminate':'floorPly'):tags[0];return excluded.includes(physical);}
