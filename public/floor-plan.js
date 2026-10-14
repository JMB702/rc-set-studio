// One physical floor plan for geometry, instructions, procurement and labor. Inches.
// Fully supported overlay: continuous 8-foot top sheets avoid crosswise top joints.
export const FLOOR={width:48,length:96,thickness:.703,lip:12,kerf:1/8};
export function floorOutline(angle,lip=false){const c=Math.cos(angle*Math.PI/180)*96,s=Math.sin(angle*Math.PI/180)*96,d=96+(lip?FLOOR.lip:0);return clean([[-96,0],[96,0],[96+c,s],[96+c,d],[-96-c,d],[-96-c,s]]);}
const area=p=>Math.abs(p.reduce((a,v,i)=>{const q=p[(i+1)%p.length];return a+v[0]*q[1]-q[0]*v[1]},0))/2;
function clean(ps){const out=[];for(const p of ps)if(!out.length||Math.hypot(p[0]-out.at(-1)[0],p[1]-out.at(-1)[1])>1e-7)out.push(p);if(out.length>1&&Math.hypot(out[0][0]-out.at(-1)[0],out[0][1]-out.at(-1)[1])<1e-7)out.pop();return out;}
function clip(ps,axis,v,sign){const out=[];for(let i=0;i<ps.length;i++){let a=ps[i],b=ps[(i+1)%ps.length],A=sign*(a[axis]-v),B=sign*(b[axis]-v);if(A>=-1e-8)out.push(a);if((A>=-1e-8)!==(B>=-1e-8)){let t=A/(A-B);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}return clean(out);}
const onLine=(p,a,b)=>Math.abs((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))<1e-5;
const edgeOn=(a,b,pg)=>pg.some((p,i)=>onLine(a,p,pg[(i+1)%pg.length])&&onLine(b,p,pg[(i+1)%pg.length]));
export function floorSheetPlan(angle,layer=0,cfg={}){
 const lip=layer===0&&cfg.floorLip===true,outline=floorOutline(angle,lip),min=Math.min(...outline.map(p=>p[0])),max=Math.max(...outline.map(p=>p[0])),pieces=[];
 const phase=layer===0?24:0,shift=lip?FLOOR.lip:0,zRows=lip?[{z:shift-96,row:0},{z:shift,row:1}]:[{z:0,row:0}];
 for(const {z,row}of zRows)for(let x=Math.floor((min-phase)/48)*48+phase;x<max-1e-6;x+=48){
  const poly=clip(clip(clip(clip(outline,0,x,1),0,x+48,-1),1,z,1),1,z+96,-1);if(poly.length<3||area(poly)<1e-6)continue;
  const xs=poly.map(p=>p[0]),zs=poly.map(p=>p[1]),loX=Math.min(...xs),hiX=Math.max(...xs),loZ=Math.min(...zs),hiZ=Math.max(...zs);
  const stock=[[x,z],[x+48,z],[x+48,z+96],[x,z+96]],edges=poly.map((a,i)=>[a,poly[(i+1)%poly.length]]);
  const cuts=edges.filter(([a,b])=>!edgeOn(a,b,stock));
  pieces.push({id:`${layer?'U':'L'}${pieces.length+1}`,layer,row,x,z,poly,width:hiX-loX,depth:hiZ-loZ,full:Math.abs(area(poly)-48*96)<1e-6,cutCount:cuts.length,cutEdges:cuts.map(([a,b])=>[...a,...b]),seamEdges:edges.filter(([a,b])=>!edgeOn(a,b,outline)).map(([a,b])=>[...a,...b])});
 }
 return {outline,pieces,seamLength:pieces.reduce((n,p)=>n+p.seamEdges.reduce((s,[x,z,X,Z])=>s+Math.hypot(X-x,Z-z),0),0)/2};
}
// Conservative rectangular blanks; rotations and reusable offcuts allowed, 1/8-inch kerf retained.
// Angled triangle offcuts are not counted as reusable stock.
export function packFloorSheets(pieces){const sheets=[];
 for(const p of [...pieces].sort((a,b)=>b.width*b.depth-a.width*a.depth||b.depth-a.depth)){
  let best;
  for(let i=0;i<sheets.length;i++)for(let j=0;j<sheets[i].free.length;j++)for(const rotate of [false,true]){const r=sheets[i].free[j],w=rotate?p.depth:p.width,h=rotate?p.width:p.depth;if(w<=r.w+1e-6&&h<=r.h+1e-6){const score=r.w*r.h-w*h;if(!best||score<best.score)best={i,j,w,h,rotate,score};}}
  if(!best){sheets.push({cuts:[],free:[{x:0,z:0,w:48,h:96}]});const rotate=p.width>48+1e-6;best={i:sheets.length-1,j:0,w:rotate?p.depth:p.width,h:rotate?p.width:p.depth,rotate};}
  const s=sheets[best.i],r=s.free.splice(best.j,1)[0];if(best.w>r.w+1e-6||best.h>r.h+1e-6)throw Error('Floor cut exceeds stock');
  s.cuts.push({piece:p.id,x:r.x,z:r.z,width:best.w,depth:best.h,rotate:best.rotate});p.sheet=best.i+1;
  const rw=r.w-best.w-FLOOR.kerf,rh=r.h-best.h-FLOOR.kerf;if(rw>1e-6)s.free.push({x:r.x+best.w+FLOOR.kerf,z:r.z,w:rw,h:r.h});if(rh>1e-6)s.free.push({x:r.x,z:r.z+best.h+FLOOR.kerf,w:best.w,h:rh});
 }
 return sheets;
}
export function floorPlan(angle,cfg={}){const lower=floorSheetPlan(angle,0,cfg),upper=floorSheetPlan(angle,1,cfg),pieces=[...upper.pieces,...lower.pieces],sheets=packFloorSheets(pieces);return {lower,upper,pieces,sheets,sheetCount:sheets.length,topArea:area(upper.outline)/144,baseArea:area(lower.outline)/144,lipArea:(area(lower.outline)-area(upper.outline))/144,topSeamLength:upper.seamLength,fullSheets:pieces.filter(p=>p.full).length,cutPieces:pieces.filter(p=>!p.full).length,cutCount:pieces.reduce((n,p)=>n+p.cutCount,0),lip:cfg.floorLip===true?FLOOR.lip:0};}
// Heights above the existing supporting floor; paint thickness is negligible.
// The painted overlay includes the existing 1.4 mm felt and planned 1/16-inch skim.
export function floorSection(type){
 if(type==='charcoal'){const underlay=1.4/25.4,lower=underlay+FLOOR.thickness,upper=lower+FLOOR.thickness,top=upper+1/16;return {underlay,lower,upper,top,lipTop:lower};}
 if(type==='wood')return {underlay:0,lower:0,upper:7/25.4,top:7/25.4,lipTop:0};
 return {underlay:0,lower:0,upper:0,top:0,lipTop:0};
}
export function floorSurfaceHeight(d={}){return floorSection(typeof d==='string'?d:d.floor).top;}
