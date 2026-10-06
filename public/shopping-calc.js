export function calculate(data,key,count,withSupports,withBallast){
 const v=data.variants[key],requirements={};
 const add=r=>Object.entries(r||{}).forEach(([id,n])=>requirements[id]=(requirements[id]||0)+n*count);
 add(v.panelRequirements);requirements.glue=Math.ceil(count/4);
 if(key==='10x4')requirements.skin=count+Math.ceil(count/3);
 if(withSupports)add(v.supportRequirements);
 if(withSupports&&withBallast&&v.ballastRequirements)add(v.ballastRequirements);
 return data.products.filter(p=>requirements[p.id]).map(p=>({...p,needed:requirements[p.id],purchaseQuantity:Math.ceil(requirements[p.id]/p.packSize),subtotalCents:Math.ceil(requirements[p.id]/p.packSize)*p.unitPriceCents}));
}
