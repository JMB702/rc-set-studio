import {floorSurfaceHeight} from './floor-plan.js';
// Retrofit planning geometry in inches. Actual rib/skin fit must be templated on the assembled set.
// 36″ vertical radius leaves a 12″ corner radius at the toe of a 24″ floor sweep.
export const CYC={skinThickness:.106,ribThickness:.703,cornerRadius:36,floorRadius:24,feather:6,clearance:2,ribSpacing:16};
export function cycloramaGaps(d={}){const a=Math.max(0,Math.min(90,Number(d.angle??45)))*Math.PI/180,corners=d.seamlessCorners&&a>0,r=d.seamlessPerimeter?CYC.floorRadius:0,margin=d.seamlessPerimeter?CYC.feather+CYC.clearance:CYC.clearance;
 const minimum=Math.ceil(corners?CYC.cornerRadius-(CYC.cornerRadius-r-margin)*Math.cos(a/2):d.seamlessPerimeter?r+margin:0);
 return {back:Math.max(d.platformBack??12,minimum),side:Math.max(d.platformSide??12,minimum),minimum};}

export function cycloramaPlan(d={}){
 const angle=Math.max(0,Math.min(90,Number(d.angle??45)||0)),a=angle*Math.PI/180,h=d.height===120?120:96,corners=d.seamlessCorners&&a>0?2:0,perimeter=!!d.seamlessPerimeter,R=CYC.cornerRadius,r=CYC.floorRadius,tangent=corners?R*Math.tan(a/2):0,cornerArc=corners?R*a:0,cornerHeight=h-(perimeter?r:0),straightLength=384-4*tangent,perimeterLength=straightLength+corners*cornerArc;
 const verticalRibs=corners*(Math.ceil(cornerHeight/CYC.ribSpacing)+1),floorRibs=perimeter?Math.ceil((192-2*tangent)/16)+1+2*(Math.ceil((96-tangent)/16)+1):0,compoundRibs=perimeter&&corners?corners*(Math.ceil(cornerArc/8)+1):0,ribCount=verticalRibs+floorRibs+compoundRibs;
 const verticalArea=corners*cornerArc*cornerHeight/144,floorArea=perimeter?straightLength*r*Math.PI/2/144:0,junctionArea=perimeter&&corners?corners*a*(R*r*Math.PI/2-r*r*(Math.PI/2-1))/144:0,skinArea=verticalArea+floorArea+junctionArea;
 // Stock envelopes for ribs; wall-skin sheets are packed without rotating the grain.
 const skinCuts=[];
 const strips=(kind,length,developed)=>{const columns=Math.ceil(developed/47);for(let col=0;col<columns;col++)for(let remaining=length;remaining>1e-6;remaining-=96)skinCuts.push({kind,width:developed/columns+1,height:Math.min(96,remaining)});};
 for(let i=0;i<corners;i++)strips('corner',cornerHeight,cornerArc);
 if(perimeter){strips('back perimeter',192-2*tangent,r*Math.PI/2);for(let i=0;i<2;i++)strips('side perimeter',96-tangent,r*Math.PI/2);}

 const skinLayout=packCycloramaSkin(skinCuts),goreSheets=perimeter&&corners?2:0,skinSheets=skinLayout.sheets+goreSheets;

 const verticalSkinSeams=corners*Math.max(0,Math.ceil(cornerArc/47)-1);
 const fit=(w,h)=>Math.max(Math.floor((47.938+.125)/(w+.125))*Math.floor((95.938+.125)/(h+.125)),Math.floor((47.938+.125)/(h+.125))*Math.floor((95.938+.125)/(w+.125)));
 const rawBlank=[Math.max(2,tangent*(1+Math.cos(a))),Math.max(2,tangent*Math.sin(a))],chordBlank=[Math.max(2,2*R*Math.sin(a/2)),Math.max(2,tangent*Math.sin(a/2))],paired=angle===90,verticalBlank=fit(...rawBlank)>=fit(...chordBlank)?rawBlank:chordBlank;
 const verticalYield=paired?fit(R+.125,R+.125)*2:fit(...verticalBlank),floorYield=fit(r+.125,r+.125)*2,compoundBlank=[R/Math.cos(a/2)-(R-r),r],compoundYield=Math.max(1,fit(...compoundBlank));
 const ribStock={rotationDegrees:verticalBlank===chordBlank?-angle/2:0,verticalBlank:paired?[R+.125,R+.125]:verticalBlank,verticalYield,paired,floorBlank:[r+.125,r+.125],floorYield,compoundBlank,compoundYield};
 const ribSheets=Math.ceil(verticalRibs/Math.max(1,verticalYield))+Math.ceil(floorRibs/floorYield)+Math.ceil(compoundRibs/compoundYield),blockingFeet=Math.ceil((corners*cornerHeight*2+verticalSkinSeams*cornerHeight+(perimeter?straightLength*2:0)+ribCount*12)/12*1.15),fasteners=Math.ceil((ribCount*8+skinArea*4)*1.15),tapeFeet=Math.ceil((corners*cornerHeight*2+(perimeter?perimeterLength*2:0))/12+(skinSheets*8)+(perimeter&&corners?80:0)),compoundPails=skinArea?Math.ceil(skinArea/150)+(perimeter&&corners?2:0):0;
 const glueContactSqFt=((verticalRibs*cornerArc+(floorRibs+compoundRibs)*r*Math.PI/2)*CYC.ribThickness+(corners*cornerHeight*2+(perimeter?straightLength*2:0))*1.5+verticalSkinSeams*cornerHeight*3.5)/144;
 const adhesiveBottles=ribCount?Math.max(1,Math.ceil(glueContactSqFt*1.25/(250/8))):0;
 return {...CYC,fittedCornerHeight:cornerHeight-floorSurfaceHeight(d),floorBase:floorSurfaceHeight(d),ribStock,verticalSkinSeams,skinLayout,goreSheets,glueContactSqFt,adhesiveBottles,angle,corners,perimeter,margin:CYC.feather+CYC.clearance,cornerHeight,tangent,cornerArc,straightLength,perimeterLength,verticalRibs,floorRibs,compoundRibs,ribCount,skinArea,skinSheets,ribSheets,blockingFeet,fasteners,tapeFeet,compoundPails};
}
// Three straight runs and optional two rounded corners at an inward offset from the existing wall.
// Sweep this path from offset0/y24 to offset24/y0 for a continuously tangent floor cove.
export function cycloramaPath(d,offset=0){
 const p=cycloramaPlan(d),a=p.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),t=p.corners?p.tangent:offset*Math.tan(a/2),cx=96-p.tangent,R=p.cornerRadius-offset;
 const endAlong=s>1e-9?Math.min(96,(96-offset*c)/s):96;
 const rightStart=p.corners?[cx+R*s,p.cornerRadius-R*c]:[96-t,offset],rightEnd=[96+endAlong*c-offset*s,endAlong*s+offset*c],backRight=p.corners?[cx,offset]:[96-t,offset];
 const mirror=v=>[-v[0],v[1]],segments=[{kind:'back',points:[mirror(backRight),backRight]},{kind:'right',points:[rightStart,rightEnd]},{kind:'left',points:[mirror(rightStart),mirror(rightEnd)]}];
 if(p.corners)for(const side of [-1,1])segments.push({kind:'corner',side,points:Array.from({length:33},(_,i)=>{const u=a*i/32;return [side*(cx+R*Math.sin(u)),p.cornerRadius-R*Math.cos(u)];})});
 return segments;
}

// Match wall plywood: 48in across the curve, 96in along the grain. Never rotate a cut.
export function packCycloramaSkin(cuts){const bins=[],pieces=[],kerf=.125;
 for(const cut of [...cuts].sort((a,b)=>b.height-a.height||b.width-a.width)){
  let fit;for(let sheet=0;sheet<bins.length&&!fit;sheet++)for(let i=0;i<bins[sheet].length;i++){const space=bins[sheet][i];if(cut.width<=space.w+1e-8&&cut.height<=space.h+1e-8){fit={sheet,i,space};break;}}
  if(!fit){bins.push([{x:0,y:0,w:48,h:96}]);fit={sheet:bins.length-1,i:0,space:bins.at(-1)[0]};}
  const {sheet,i,space}=fit;bins[sheet].splice(i,1);if(space.w-cut.width>kerf)bins[sheet].push({x:space.x+cut.width+kerf,y:space.y,w:space.w-cut.width-kerf,h:cut.height});if(space.h-cut.height>kerf)bins[sheet].push({x:space.x,y:space.y+cut.height+kerf,w:space.w,h:space.h-cut.height-kerf});pieces.push({...cut,sheet:sheet+1,x:space.x,y:space.y});
 }return {sheets:bins.length,pieces};}
