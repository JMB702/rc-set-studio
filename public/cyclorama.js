import {floorSurfaceHeight} from './floor-plan.js';
// Retrofit planning geometry in inches. Actual rib/skin fit must be templated on the assembled set.
// 30 9/16″ vertical radius: at a 90° corner the curve is 48″ around, the full width of a lauan sheet, so each row of
// skin is one uncut-width piece with no vertical seam (Jeff's choice; tighter than the 42″ full-size cyc standard).
// With a 24″ floor sweep it leaves a 6 9/16″ corner radius at the toe.
export const LAUAN=[48,96];
export const CYC={skinThickness:.106,ribThickness:.703,cornerRadius:30.5625,floorRadius:24,feather:6,clearance:2,ribSpacing:16};
// Which wing corners get the rounded curve: 'both' (default), 'left' or 'right' seen from the front of the set.
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
// Added crossbars lie flat against the back of the skin, like the 10′ seam backer, so a screw from behind passes
// only ¾″ of wood and the skin before it reaches the rib. Same stock as the toggles: 1×3 on 10′, 1×2 on 8′.
export function addedCrossbar(h){return {width:h===120?2.5:1.5,thickness:.75};}
// Each corner rib is centered on a crossbar and screwed from behind the wall, through the crossbar and the skin,
// into the rib's straight edge. No cleats, no separate seam backing. The bottom rib rests on the floor (or the
// cove top) and reuses the bottom rail when the rail is behind it; otherwise one low crossbar is added for it.
export function cornerRibLevels(h,base,t=CYC.ribThickness){
 const half=t/2,rails=wallCrossbars(h),top=rails.at(-1),low=base+half,reuse=rails.find(L=>Math.abs(L-low)<=.375),w=addedCrossbar(h).width;
 // A new low crossbar may not overlap an existing on-edge one; it then sits tight above it, still behind the rib.
 const clearance=.375+w/2,clash=rails.find(L=>Math.abs(L-low)<clearance),flat=L=>h===120&&L===96;
 const bottom={y:base,crossbar:reuse??(clash===undefined?low:clash+clearance),added:reuse===undefined},last={y:top-half,crossbar:top,added:false};
 const middle=[...rails.slice(1,-1),...infillCrossbars(h)].sort((a,b)=>a-b).filter(L=>L-half>=base+t+3&&L+half<=last.y-3).map(L=>({y:L-half,crossbar:L,added:infillCrossbars(h).includes(L)}));
 return [bottom,...middle,last].map(l=>({...l,flat:l.added||flat(l.crossbar)}));}
// Screw from behind, leaving at least ¾″ in the rib edge. Flat crossbars (added ones and the 10′ seam backer) take a
// 2½″ SPAX; the existing on-edge rails and toggles (1×3 on 10′, 1×2 on 8′) need a longer deck screw.
export function ribBackScrew(h,flat=false){return flat?{size:'#8 × 2½″',length:2.5,through:.75+.106}:h===120?{size:'#9 × 3½″',length:3.5,through:2.5+.106}:{size:'#9 × 3″',length:3,through:1.5+.106};}

// A cut length you can mark: the nearest 1/16″ that does not overrun the space by more than a hair (1/320″).
export const cutLength=v=>Math.floor(v*16+.05)/16;
export function cornerSkinPlan(ribCenters,base,top,arc,[W,L]=LAUAN){
 // Each row is full-width sheets plus one ripped strip for the rest, so only one piece per row is ripped.
 const count=Math.ceil((arc-1/32)/W),columns=Array.from({length:count},(_,i)=>i<count-1?W:Math.min(W,arc-W*(count-1))),rows=[];let start=base;
 while(top-start>L+1e-9){const seam=Math.max(...ribCenters.filter(c=>c>start+1&&c-start<=L+1e-9));if(!Number.isFinite(seam))break;rows.push({index:rows.length,bottom:start,top:seam,height:seam-start,columns});start=seam;}
 rows.push({index:rows.length,bottom:start,top,height:top-start,columns});
 return {arc,columns,rows,seams:rows.slice(0,-1).map(r=>r.top)};}

export function cycloramaPlan(d={}){
 const angle=Math.max(0,Math.min(90,Number(d.angle??45)||0)),a=angle*Math.PI/180,h=d.height===120?120:96,cornerSides=cycloramaCornerSides(d),corners=cornerSides.length,perimeter=!!d.seamlessPerimeter,R=CYC.cornerRadius,r=CYC.floorRadius,tangent=corners?R*Math.tan(a/2):0,cornerArc=corners?R*a:0,cornerHeight=h-(perimeter?r:0);
 // Each rounded corner shortens the back run and its own wing run by one tangent; a sharp corner keeps the full run.
 const runs={back:192-corners*tangent,left:96-(cornerSides.includes('left')?tangent:0),right:96-(cornerSides.includes('right')?tangent:0)},straightLength=runs.back+runs.left+runs.right,perimeterLength=straightLength+corners*cornerArc;
 const lift=floorSurfaceHeight(d),singleRibs=corners?cornerRibLevels(h,lift+(perimeter?r:0)):[];
 // Where two stacked skin pieces meet, the rib is doubled: two ribs face to face, centered on the joint, so each piece
 // lands on a full rib edge. Both sit on the same crossbar and take their own screws from behind.
  const cornerSkin=corners?cornerSkinPlan(singleRibs.map(l=>l.y+CYC.ribThickness/2),lift+(perimeter?r:0),h,cornerArc):null,t=CYC.ribThickness;
 const ribLevels=singleRibs.flatMap(l=>cornerSkin?.seams.some(sm=>Math.abs(sm-(l.y+t/2))<1e-6)?[{...l,y:l.y+t/2-t,double:'lower'},{...l,y:l.y+t/2,double:'upper'}]:[l]),addedCrossbarLevels=ribLevels.filter(l=>l.added).map(l=>l.crossbar),crossbarPanels=corners*2,addedCrossbars=crossbarPanels*addedCrossbarLevels.length;
 const verticalRibs=corners*ribLevels.length,floorRibs=perimeter?Object.values(runs).reduce((n,run)=>n+Math.ceil(run/16)+1,0):0,compoundRibs=perimeter&&corners?corners*(Math.ceil(cornerArc/8)+1):0,ribCount=verticalRibs+floorRibs+compoundRibs;
 const verticalArea=corners*cornerArc*cornerHeight/144,floorArea=perimeter?straightLength*r*Math.PI/2/144:0,junctionArea=perimeter&&corners?corners*a*(R*r*Math.PI/2-r*r*(Math.PI/2-1))/144:0,skinArea=verticalArea+floorArea+junctionArea;
 // Stock envelopes for ribs; wall-skin sheets are packed without rotating the grain.
 const skinCuts=[];
 const strips=(kind,length,developed)=>{const columns=Math.ceil(developed/47);for(let col=0;col<columns;col++)for(let remaining=length;remaining>1e-6;remaining-=96)skinCuts.push({kind,width:developed/columns+1,height:Math.min(96,remaining)});};
 // Corner skin is cut exactly: the developed arc wide (one sheet when it fits 48″) and from the curve base to the wall
 // top, split into stacked pieces whose joints land on the center of a rib no more than one sheet length apart.
 const cornerCuts=skinRows=>{const out=[];for(let i=0;i<corners;i++)for(const row of skinRows)for(const [col,c] of row.columns.entries())out.push({kind:'corner',width:c,height:row.height,row:row.index,col});return out;};
 // A short upper row fits beside the lower strip if its full-width piece is cut into narrower pieces; keep that
 // layout when it saves a lauan sheet. The pieces split the full width evenly, so one joint still lines up below.
 if(cornerSkin&&cornerSkin.rows.length>1&&cornerSkin.columns.length>1){
  const strip=cornerSkin.columns.at(-1),room=LAUAN[0]-strip-.125,split=cornerSkin.columns.slice(0,-1).flatMap(w=>{const n=Math.ceil(w/room-1e-9);return Array(n).fill(w/n);});
  const alt=cornerSkin.rows.map(r=>r.index?{...r,columns:[...split,strip]}:r);
  if(packCycloramaSkin(cornerCuts(alt)).sheets<packCycloramaSkin(cornerCuts(cornerSkin.rows)).sheets)cornerSkin.rows=alt;
 }
 if(cornerSkin)skinCuts.push(...cornerCuts(cornerSkin.rows));
 if(perimeter){strips('back perimeter',runs.back,r*Math.PI/2);for(const side of ['left','right'])strips('side perimeter',runs[side],r*Math.PI/2);}

 const skinLayout=packCycloramaSkin(skinCuts),goreSheets=perimeter?corners:0,skinSheets=skinLayout.sheets+goreSheets;

 // Vertical skin joints land on the ribs' curved edges; there is no separate backer behind them.
 const verticalSkinSeams=corners*Math.max(0,Math.ceil(cornerArc/47)-1);
 const fit=(w,h)=>Math.max(Math.floor((47.938+.125)/(w+.125))*Math.floor((95.938+.125)/(h+.125)),Math.floor((47.938+.125)/(h+.125))*Math.floor((95.938+.125)/(w+.125)));
 const rawBlank=[Math.max(2,tangent*(1+Math.cos(a))),Math.max(2,tangent*Math.sin(a))],chordBlank=[Math.max(2,2*R*Math.sin(a/2)),Math.max(2,tangent*Math.sin(a/2))],paired=angle===90,verticalBlank=fit(...rawBlank)>=fit(...chordBlank)?rawBlank:chordBlank;
 const verticalYield=paired?fit(R+.125,R+.125)*2:fit(...verticalBlank),floorYield=fit(r+.125,r+.125)*2,compoundBlank=[R/Math.cos(a/2)-(R-r),r],compoundYield=Math.max(1,fit(...compoundBlank));
 const ribStock={rotationDegrees:verticalBlank===chordBlank?-angle/2:0,verticalBlank:paired?[R+.125,R+.125]:verticalBlank,verticalYield,paired,floorBlank:[r+.125,r+.125],floorYield,compoundBlank,compoundYield};
 const ribSheets=Math.ceil(verticalRibs/Math.max(1,verticalYield))+Math.ceil(floorRibs/floorYield)+Math.ceil(compoundRibs/compoundYield),blockingFeet=Math.ceil(((perimeter?straightLength*2:0)+(floorRibs+compoundRibs)*12)/12*1.15),fasteners=Math.ceil((ribCount*8+skinArea*4)*1.15),tapeFeet=Math.ceil((corners*cornerHeight*2+(perimeter?perimeterLength*2:0))/12+(skinSheets*8)+(perimeter?40*corners:0)),compoundPails=skinArea?Math.ceil(skinArea/150)+(perimeter?corners:0):0;
 const glueContactSqFt=((verticalRibs*cornerArc+(floorRibs+compoundRibs)*r*Math.PI/2)*CYC.ribThickness+(perimeter?straightLength*2:0)*1.5+addedCrossbars*46.5*addedCrossbar(h).width)/144;
 const adhesiveBottles=ribCount?Math.max(1,Math.ceil(glueContactSqFt*1.25/(250/8))):0;
 // Fixings: added crossbars are glued to the skin, toe-screwed into the stiles and stapled through the face;
 // each corner rib takes two screws per wall from behind, through its crossbar into the rib edge.
 const crossbarScrews=addedCrossbars*4,crossbarStaples=addedCrossbars*16,ribBackScrews=corners*4*ribLevels.filter(l=>!l.flat).length,ribFlatScrews=corners*4*ribLevels.filter(l=>l.flat).length,backScrew=ribBackScrew(h),flatScrew=ribBackScrew(h,true);
 // Back screws go where the rib is at least 2″ deep behind the wall: within this distance of the corner.
 const screwReach=corners?Math.max(0,tangent-Math.sqrt(R**2-(R-2)**2)):0;
 return {...CYC,cornerSkin,screwReach,backScrew,ribBackScrews,flatScrew,ribFlatScrews,crossbarStock:addedCrossbar(h),cornerSides,runs,ribLevels,addedCrossbarLevels,crossbarPanels,addedCrossbars,crossbarScrews,crossbarStaples,fittedCornerHeight:cornerHeight-floorSurfaceHeight(d),floorBase:floorSurfaceHeight(d),ribStock,verticalSkinSeams,skinLayout,goreSheets,glueContactSqFt,adhesiveBottles,angle,corners,perimeter,margin:CYC.feather+CYC.clearance,cornerHeight,tangent,cornerArc,straightLength,perimeterLength,verticalRibs,floorRibs,compoundRibs,ribCount,skinArea,skinSheets,ribSheets,blockingFeet,fasteners,tapeFeet,compoundPails};
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

// Rib cutting for 90° wall corners: each rib is a quarter-round fillet whose straight edges sit on the two walls.
// A square 1/8″ larger than the radius holds two of them in opposite corners: pin a string at one corner, swing the
// radius to draw the curve of the rib in the opposite corner, repeat from that corner, then cut the square into two
// triangles along the diagonal joining the two corners the curves pass and bandsaw each curve.
// Two squares fit along a 4×8 sheet, so a sheet gives four full-profile ribs.
export const RIB_SHEET=[47.938,95.938];
export function ribCutPlan(plan){
 const radius=plan.cornerRadius,square=radius+.125,kerf=.125,[W,L]=RIB_SHEET,across=Math.floor((W+kerf)/(square+kerf)),along=Math.floor((L+kerf)/(square+kerf));
 const squaresPerSheet=across*along,ribs=plan.verticalRibs,squares=Math.ceil(ribs/2),sheets=Math.ceil(squares/squaresPerSheet);
 const rip=W-square-kerf,leftover=L-along*square-along*kerf;
 return {radius,square,kerf,sheet:RIB_SHEET,across,along,squaresPerSheet,ribsPerSheet:squaresPerSheet*2,ribs,squares,ribsMade:squares*2,sheets,rip,leftover};
}
