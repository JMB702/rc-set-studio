// Retrofit planning geometry in inches. Actual rib/skin fit must be templated on the assembled set.
// 36″ vertical radius leaves a 12″ corner radius at the toe of a 24″ floor sweep.
export const CYC={cornerRadius:36,floorRadius:24,feather:6,clearance:2,ribSpacing:16};
export function cycloramaGaps(d={}){const a=Math.max(0,Math.min(90,Number(d.angle??45)))*Math.PI/180,corners=d.seamlessCorners&&a>0,r=d.seamlessPerimeter?CYC.floorRadius:0,margin=d.seamlessPerimeter?CYC.feather+CYC.clearance:CYC.clearance;
 const minimum=Math.ceil(corners?CYC.cornerRadius-(CYC.cornerRadius-r-margin)*Math.cos(a/2):d.seamlessPerimeter?r+margin:0);
 return {back:Math.max(d.platformBack??12,minimum),side:Math.max(d.platformSide??12,minimum),minimum};}

export function cycloramaPlan(d={}){
 const angle=Math.max(0,Math.min(90,Number(d.angle??45)||0)),a=angle*Math.PI/180,h=d.height===120?120:96,corners=d.seamlessCorners&&a>0?2:0,perimeter=!!d.seamlessPerimeter,R=CYC.cornerRadius,r=CYC.floorRadius,tangent=corners?R*Math.tan(a/2):0,cornerArc=corners?R*a:0,cornerHeight=h-(perimeter?r:0),straightLength=384-4*tangent,perimeterLength=straightLength+corners*cornerArc;
 const verticalRibs=corners*(Math.ceil(cornerHeight/CYC.ribSpacing)+1),floorRibs=perimeter?Math.ceil((192-2*tangent)/16)+1+2*(Math.ceil((96-tangent)/16)+1):0,compoundRibs=perimeter&&corners?corners*(Math.ceil(cornerArc/8)+1):0,ribCount=verticalRibs+floorRibs+compoundRibs;
 const verticalArea=corners*cornerArc*cornerHeight/144,floorArea=perimeter?straightLength*r*Math.PI/2/144:0,junctionArea=perimeter&&corners?corners*a*(R*r*Math.PI/2-r*r*(Math.PI/2-1))/144:0,skinArea=verticalArea+floorArea+junctionArea;
 // Separate stock envelopes: no optimistic sharing of irregular offcuts or compound gores.
 const verticalSheets=corners*(cornerArc<=48?Math.ceil(cornerHeight/96):Math.ceil(cornerHeight/48)),floorSheets=perimeter?Math.ceil((192-2*tangent)/96)+2*Math.ceil((96-tangent)/96):0,skinSheets=verticalSheets+floorSheets+(perimeter&&corners?2:0);
 const ribSheets=Math.ceil(verticalRibs/2)+Math.ceil((floorRibs+compoundRibs)/3),blockingFeet=Math.ceil((corners*cornerHeight*2+(perimeter?straightLength*2:0)+ribCount*12)/12*1.15),fasteners=Math.ceil((ribCount*8+skinArea*4)*1.15),tapeFeet=Math.ceil((corners*cornerHeight*2+(perimeter?perimeterLength*2:0))/12+(skinSheets*8)+(perimeter&&corners?80:0)),compoundPails=skinArea?Math.ceil(skinArea/150)+(perimeter&&corners?2:0):0;
 return {...CYC,angle,corners,perimeter,margin:CYC.feather+CYC.clearance,cornerHeight,tangent,cornerArc,straightLength,perimeterLength,verticalRibs,floorRibs,compoundRibs,ribCount,skinArea,skinSheets,ribSheets,blockingFeet,fasteners,tapeFeet,compoundPails};
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
