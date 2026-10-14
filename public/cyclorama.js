import {floorSurfaceHeight} from './floor-plan.js';
// Retrofit planning geometry in inches. Actual rib/skin fit must be templated on the assembled set.
// 36″ vertical radius leaves a 12″ corner radius at the toe of a 24″ floor sweep.
export const CYC={skinThickness:.106,ribThickness:.703,cornerRadius:36,floorRadius:24,feather:6,clearance:2,ribSpacing:16};
// Which wing corners get the 36″ curve: 'both' (default), 'left' or 'right' seen from the front of the set.
// Left is the negative-x wing (wall corner 1 in the tracker), right the positive-x wing (corner 2).
export const CORNER_SIDES=['both','left','right'];
export function cycloramaCornerSides(d={}){if(d.seamlessCorners!==true||!(Number(d.angle??45)>0))return [];const side=d.seamlessCornerSide??'both';return side==='left'?['left']:side==='right'?['right']:['left','right'];}
// One clearance for both platform sides: the platform keeps a single side gap even when only one corner is rounded.
export function cycloramaGaps(d={}){const a=Math.max(0,Math.min(90,Number(d.angle??45)))*Math.PI/180,corners=cycloramaCornerSides(d).length>0,r=d.seamlessPerimeter?CYC.floorRadius:0,margin=d.seamlessPerimeter?CYC.feather+CYC.clearance:CYC.clearance;
 const minimum=Math.ceil(corners?CYC.cornerRadius-(CYC.cornerRadius-r-margin)*Math.cos(a/2):d.seamlessPerimeter?r+margin:0);
 return {back:Math.max(d.platformBack??12,minimum),side:Math.max(d.platformSide??12,minimum),minimum};}

// Wall crossbar centers above the subfloor: bottom rail, 24″ toggles, the 10′ flat seam backer at 96″, top rail.
export function wallCrossbars(h){return h===120?[.375,24,48,72,96,119.625]:[.375,24,48,72,95.625];}
// Added crossbars go midway between the existing ones, so a corner panel has one every 12″.
export function infillCrossbars(h){return h===120?[12,36,60,84,108]:[12,36,60,84];}
// Each corner rib is centered on a crossbar and screwed from behind the wall, through the crossbar and the skin,
// into the rib's straight edge. No cleats, no separate seam backing. The bottom rib rests on the floor (or the
// cove top) and reuses the bottom rail when the rail is behind it; otherwise one low crossbar is added for it.
export function cornerRibLevels(h,base,t=CYC.ribThickness){
 const half=t/2,rails=wallCrossbars(h),top=rails.at(-1),low=base+half,reuse=rails.find(L=>Math.abs(L-low)<=.375);
 // A new low crossbar may not overlap an existing one; it then sits tight above it, still behind the rib edge.
 const clash=rails.find(L=>Math.abs(L-low)<.75),bottom={y:base,crossbar:reuse??(clash===undefined?low:clash+.75),added:reuse===undefined},last={y:top-half,crossbar:top,added:false};
 const middle=[...rails.slice(1,-1),...infillCrossbars(h)].sort((a,b)=>a-b).filter(L=>L-half>=base+t+3&&L+half<=last.y-3).map(L=>({y:L-half,crossbar:L,added:infillCrossbars(h).includes(L)}));
 return [bottom,...middle,last];}
// Screw from behind: through the crossbar's depth (1×3 on edge on 10′, 1×2 on 8′; the 10′ seam backer lies flat)
// and the .106″ skin, leaving at least ¾″ in the rib edge.
export function ribBackScrew(h){return h===120?{size:'#9 × 3½″',length:3.5,through:2.5+.106}:{size:'#9 × 3″',length:3,through:1.5+.106};}

export function cycloramaPlan(d={}){
 const angle=Math.max(0,Math.min(90,Number(d.angle??45)||0)),a=angle*Math.PI/180,h=d.height===120?120:96,cornerSides=cycloramaCornerSides(d),corners=cornerSides.length,perimeter=!!d.seamlessPerimeter,R=CYC.cornerRadius,r=CYC.floorRadius,tangent=corners?R*Math.tan(a/2):0,cornerArc=corners?R*a:0,cornerHeight=h-(perimeter?r:0);
 // Each rounded corner shortens the back run and its own wing run by one tangent; a sharp corner keeps the full run.
 const runs={back:192-corners*tangent,left:96-(cornerSides.includes('left')?tangent:0),right:96-(cornerSides.includes('right')?tangent:0)},straightLength=runs.back+runs.left+runs.right,perimeterLength=straightLength+corners*cornerArc;
 const lift=floorSurfaceHeight(d),ribLevels=corners?cornerRibLevels(h,lift+(perimeter?r:0)):[],addedCrossbarLevels=ribLevels.filter(l=>l.added).map(l=>l.crossbar),crossbarPanels=corners*2,addedCrossbars=crossbarPanels*addedCrossbarLevels.length;
 const verticalRibs=corners*ribLevels.length,floorRibs=perimeter?Object.values(runs).reduce((n,run)=>n+Math.ceil(run/16)+1,0):0,compoundRibs=perimeter&&corners?corners*(Math.ceil(cornerArc/8)+1):0,ribCount=verticalRibs+floorRibs+compoundRibs;
 const verticalArea=corners*cornerArc*cornerHeight/144,floorArea=perimeter?straightLength*r*Math.PI/2/144:0,junctionArea=perimeter&&corners?corners*a*(R*r*Math.PI/2-r*r*(Math.PI/2-1))/144:0,skinArea=verticalArea+floorArea+junctionArea;
 // Stock envelopes for ribs; wall-skin sheets are packed without rotating the grain.
 const skinCuts=[];
 const strips=(kind,length,developed)=>{const columns=Math.ceil(developed/47);for(let col=0;col<columns;col++)for(let remaining=length;remaining>1e-6;remaining-=96)skinCuts.push({kind,width:developed/columns+1,height:Math.min(96,remaining)});};
 for(let i=0;i<corners;i++)strips('corner',cornerHeight,cornerArc);
 if(perimeter){strips('back perimeter',runs.back,r*Math.PI/2);for(const side of ['left','right'])strips('side perimeter',runs[side],r*Math.PI/2);}

 const skinLayout=packCycloramaSkin(skinCuts),goreSheets=perimeter?corners:0,skinSheets=skinLayout.sheets+goreSheets;

 // Vertical skin joints land on the ribs' curved edges; there is no separate backer behind them.
 const verticalSkinSeams=corners*Math.max(0,Math.ceil(cornerArc/47)-1);
 const fit=(w,h)=>Math.max(Math.floor((47.938+.125)/(w+.125))*Math.floor((95.938+.125)/(h+.125)),Math.floor((47.938+.125)/(h+.125))*Math.floor((95.938+.125)/(w+.125)));
 const rawBlank=[Math.max(2,tangent*(1+Math.cos(a))),Math.max(2,tangent*Math.sin(a))],chordBlank=[Math.max(2,2*R*Math.sin(a/2)),Math.max(2,tangent*Math.sin(a/2))],paired=angle===90,verticalBlank=fit(...rawBlank)>=fit(...chordBlank)?rawBlank:chordBlank;
 const verticalYield=paired?fit(R+.125,R+.125)*2:fit(...verticalBlank),floorYield=fit(r+.125,r+.125)*2,compoundBlank=[R/Math.cos(a/2)-(R-r),r],compoundYield=Math.max(1,fit(...compoundBlank));
 const ribStock={rotationDegrees:verticalBlank===chordBlank?-angle/2:0,verticalBlank:paired?[R+.125,R+.125]:verticalBlank,verticalYield,paired,floorBlank:[r+.125,r+.125],floorYield,compoundBlank,compoundYield};
 const ribSheets=Math.ceil(verticalRibs/Math.max(1,verticalYield))+Math.ceil(floorRibs/floorYield)+Math.ceil(compoundRibs/compoundYield),blockingFeet=Math.ceil(((perimeter?straightLength*2:0)+(floorRibs+compoundRibs)*12)/12*1.15),fasteners=Math.ceil((ribCount*8+skinArea*4)*1.15),tapeFeet=Math.ceil((corners*cornerHeight*2+(perimeter?perimeterLength*2:0))/12+(skinSheets*8)+(perimeter?40*corners:0)),compoundPails=skinArea?Math.ceil(skinArea/150)+(perimeter?corners:0):0;
 const glueContactSqFt=((verticalRibs*cornerArc+(floorRibs+compoundRibs)*r*Math.PI/2)*CYC.ribThickness+(perimeter?straightLength*2:0)*1.5+addedCrossbars*46.5*.75)/144;
 const adhesiveBottles=ribCount?Math.max(1,Math.ceil(glueContactSqFt*1.25/(250/8))):0;
 // Fixings: added crossbars are glued to the skin, toe-screwed into the stiles and stapled through the face;
 // each corner rib takes two screws per wall from behind, through its crossbar into the rib edge.
 const crossbarScrews=addedCrossbars*4,crossbarStaples=addedCrossbars*16,ribBackScrews=verticalRibs*4,backScrew=ribBackScrew(h);
 // Back screws go where the rib is at least 2″ deep behind the wall: within this distance of the corner.
 const screwReach=corners?Math.max(0,tangent-Math.sqrt(R**2-(R-2)**2)):0;
 return {...CYC,screwReach,backScrew,ribBackScrews,cornerSides,runs,ribLevels,addedCrossbarLevels,crossbarPanels,addedCrossbars,crossbarScrews,crossbarStaples,fittedCornerHeight:cornerHeight-floorSurfaceHeight(d),floorBase:floorSurfaceHeight(d),ribStock,verticalSkinSeams,skinLayout,goreSheets,glueContactSqFt,adhesiveBottles,angle,corners,perimeter,margin:CYC.feather+CYC.clearance,cornerHeight,tangent,cornerArc,straightLength,perimeterLength,verticalRibs,floorRibs,compoundRibs,ribCount,skinArea,skinSheets,ribSheets,blockingFeet,fasteners,tapeFeet,compoundPails};
}
// Three straight runs and up to two rounded corners at an inward offset from the existing wall.
// A sharp corner meets at the miter point; a rounded one runs tangent into its arc.
// Sweep this path from offset0/y24 to offset24/y0 for a continuously tangent floor cove.
export function cycloramaPath(d,offset=0){
 const p=cycloramaPlan(d),a=p.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),miter=offset*Math.tan(a/2),tangent=p.cornerRadius*Math.tan(a/2),cx=96-tangent,R=p.cornerRadius-offset;
 const endAlong=s>1e-9?Math.min(96,(96-offset*c)/s):96,rounded=side=>p.cornerSides.includes(side<0?'left':'right');
 const wingStart=side=>rounded(side)?[side*(cx+R*s),p.cornerRadius-R*c]:[side*(96-miter),offset],wingEnd=side=>[side*(96+endAlong*c-offset*s),endAlong*s+offset*c],backEnd=side=>rounded(side)?[side*cx,offset]:[side*(96-miter),offset];
 const segments=[{kind:'back',points:[backEnd(-1),backEnd(1)]},{kind:'right',points:[wingStart(1),wingEnd(1)]},{kind:'left',points:[wingStart(-1),wingEnd(-1)]}];
 for(const side of [-1,1])if(rounded(side))segments.push({kind:'corner',side,points:Array.from({length:33},(_,i)=>{const u=a*i/32;return [side*(cx+R*Math.sin(u)),p.cornerRadius-R*Math.cos(u)];})});
 return segments;
}

// Match wall plywood: 48in across the curve, 96in along the grain. Never rotate a cut.
export function packCycloramaSkin(cuts){const bins=[],pieces=[],kerf=.125;
 for(const cut of [...cuts].sort((a,b)=>b.height-a.height||b.width-a.width)){
  let fit;for(let sheet=0;sheet<bins.length&&!fit;sheet++)for(let i=0;i<bins[sheet].length;i++){const space=bins[sheet][i];if(cut.width<=space.w+1e-8&&cut.height<=space.h+1e-8){fit={sheet,i,space};break;}}
  if(!fit){bins.push([{x:0,y:0,w:48,h:96}]);fit={sheet:bins.length-1,i:0,space:bins.at(-1)[0]};}
  const {sheet,i,space}=fit;bins[sheet].splice(i,1);if(space.w-cut.width>kerf)bins[sheet].push({x:space.x+cut.width+kerf,y:space.y,w:space.w-cut.width-kerf,h:cut.height});if(space.h-cut.height>kerf)bins[sheet].push({x:space.x,y:space.y+cut.height+kerf,w:space.w,h:space.h-cut.height-kerf});pieces.push({...cut,sheet:sheet+1,x:space.x,y:space.y});
 }return {sheets:bins.length,pieces};}
