import {cycloramaGaps} from './cyclorama.js';
// Raised platform floor: pure geometry shared by the 3D model, the Build guide and the Pricing guide.
// Pure geometry helpers are shared by Node tests and the pricing calculator.
// Units are inches. x runs along the back wall (center 0); z runs forward from the wall face.
// The floor footprint (and the platform's front edge) is 96″ deep.
export const PLATFORM={
 height:10,            // finished top above the floor
 deck:.578,            // Plytanium 19/32″ BC sanded plywood, actual thickness
 sheet:[47.938,95.938],// actual sheet size
 lumber:[1.5,3.5],     // actual 2×4
 rim:3.5,              // rims, bottom rims and joists all stand on edge
 minPiece:4,           // skip rims and legs on stub edges shorter than this at clipped corners
 module:48,            // frame columns follow the 4′ plywood width and run the full depth
 joistOC:16,           // joists run side to side, across the front-to-back face grain
 maxLegSpan:48,
 skin:.106,            // lauan fascia, actual thickness
 stud:96,kerf:.125,
 gap:12,gapMin:0,gapMax:48,
 front:0,frontMax:48,   // setback of the front edge from the floor's front edge (not the lip)
 minDepth:24            // the platform always keeps at least this much depth front to back
};
export const legLength=PLATFORM.height-PLATFORM.deck;           // 9.422″, floor to deck underside: every leg is this length
export const rimBottom=legLength-PLATFORM.rim;                   // 5.922″: the top rim's lower edge
export const bottomRimTop=PLATFORM.rim;                          // 3.5″: the bottom ring stands on the floor
export const clampFront=v=>Math.max(0,Math.min(PLATFORM.frontMax,Math.round(Number.isFinite(+v)?+v:PLATFORM.front)));
// A front setback never leaves the platform shallower than minDepth behind the back clearance.
export const frontFor=(back,front)=>Math.max(0,Math.min(clampFront(front),96-back-PLATFORM.minDepth));
export const clampGap=v=>Math.max(PLATFORM.gapMin,Math.min(PLATFORM.gapMax,Math.round(Number.isFinite(+v)?+v:PLATFORM.gap)));

export function footprint(a){let c=Math.cos(a*Math.PI/180)*96,s=Math.sin(a*Math.PI/180)*96;return[[-96,0],[96,0],[96+c,s],[96+c,96],[-96-c,96],[-96-c,s]].filter((p,i,ar)=>!i||Math.hypot(p[0]-ar[i-1][0],p[1]-ar[i-1][1])>.001);}
// Keep the part of a convex polygon where nx*x + nz*z >= c.
export function clipHalf(pg,nx,nz,c){const out=[],f=p=>nx*p[0]+nz*p[1]-c;for(let i=0;i<pg.length;i++){const A=pg[i],B=pg[(i+1)%pg.length],a=f(A),b=f(B);if(a>=-1e-9)out.push(A);if((a>=-1e-9)!==(b>=-1e-9)){const t=a/(a-b);out.push([A[0]+t*(B[0]-A[0]),A[1]+t*(B[1]-A[1])]);}}return dedupe(out);}
function dedupe(pg){const out=[];for(const p of pg)if(!out.length||Math.hypot(p[0]-out.at(-1)[0],p[1]-out.at(-1)[1])>1e-6)out.push(p);while(out.length>1&&Math.hypot(out[0][0]-out.at(-1)[0],out[0][1]-out.at(-1)[1])<=1e-6)out.pop();return out;}
export function area(pg){let s=0;for(let i=0;i<pg.length;i++){const p=pg[i],q=pg[(i+1)%pg.length];s+=p[0]*q[1]-q[0]*p[1];}return s/2;}
const ccw=pg=>area(pg)<0?[...pg].reverse():pg;
const extent=(pg,k)=>{const v=pg.map(p=>p[k]);return [Math.min(...v),Math.max(...v)];};

// The wall lines the platform keeps its distance from, each as an inward half-plane n·p >= c.
function wallLines(a){const r=a*Math.PI/180,s=Math.sin(r),c=Math.cos(r);return {back:{n:[0,1],c:0},right:{n:[-s,c],c:-96*s},left:{n:[s,c],c:-96*s}};}
// The platform's side edges follow their own angle, which can turn further in than the walls but never
// further out: wall angle a, platform angle pa >= a. Both the real wing lines and the platform's own
// lines keep the side gap, so the platform never comes closer to a wall than the gap.
export const platformAngleFor=(a,pa)=>Math.min(90,Math.max(a,Number.isFinite(+pa)?+pa:a));
export function platformOutline(a,back=PLATFORM.gap,side=PLATFORM.gap,pa=a,front=PLATFORM.front){
 pa=platformAngleFor(a,pa);const L=wallLines(a),P=wallLines(pa);let p=footprint(a);
 p=clipHalf(p,...L.back.n,L.back.c+back);
 p=clipHalf(p,0,-1,-(96-frontFor(back,front)));
 for(const l of [L.right,L.left,P.right,P.left])p=clipHalf(p,...l.n,l.c+side);
 return ccw(p);
}
// Which wall (if any) an outline edge faces, so a flush edge can skip its fascia.
function wallOf(A,B,a,back,side){const L=wallLines(a),m=[(A[0]+B[0])/2,(A[1]+B[1])/2],on=(l,g)=>Math.abs(l.n[0]*m[0]+l.n[1]*m[1]-l.c-g)<1e-4&&Math.abs(l.n[0]*(B[0]-A[0])+l.n[1]*(B[1]-A[1]))<1e-6;
 if(on(L.back,back))return {wall:'back',gap:back};if(on(L.right,side))return {wall:'right',gap:side};if(on(L.left,side))return {wall:'left',gap:side};return {wall:null,gap:null};}
function onOutline(A,B,outline){const m=[(A[0]+B[0])/2,(A[1]+B[1])/2];for(let i=0;i<outline.length;i++){const P=outline[i],Q=outline[(i+1)%outline.length],dx=Q[0]-P[0],dz=Q[1]-P[1],len=Math.hypot(dx,dz);if(len<1e-9)continue;const cross=Math.abs((m[0]-P[0])*dz-(m[1]-P[1])*dx)/len,t=((m[0]-P[0])*dx+(m[1]-P[1])*dz)/len/len;if(cross<1e-4&&t>-1e-6&&t<1+1e-6)return true;}return false;}

// Each edge as an inward half-plane: distance from the edge = n·p - c.
function edgeFrames(pg){return pg.map((A,i)=>{const B=pg[(i+1)%pg.length],len=Math.hypot(B[0]-A[0],B[1]-A[1]),u=[(B[0]-A[0])/len,(B[1]-A[1])/len],n=[-u[1],u[0]];return {A,B,len,u,n,c:n[0]*A[0]+n[1]*A[1]};});}
const band=(pg,e,lo,hi)=>{let p=clipHalf(pg,...e.n,e.c+lo);return clipHalf(p,-e.n[0],-e.n[1],-(e.c+hi));};
const along=(pg,u)=>{const v=pg.map(p=>p[0]*u[0]+p[1]*u[1]);return Math.max(...v)-Math.min(...v);};
const insidePoly=(pg,p)=>pg.length>2&&edgeFrames(pg).every(e=>e.n[0]*p[0]+e.n[1]*p[1]-e.c>=-1e-6);
const centroid=pg=>[pg.reduce((s,p)=>s+p[0],0)/pg.length,pg.reduce((s,p)=>s+p[1],0)/pg.length];

// Deck sheets run front to back at their full 4′ width, laid from the left edge; only the last one is ripped.
// These x positions are the sheet joints, and every frame column follows them.
// A leftover narrower than 12″ is too small to frame under, so the last two decks share it evenly instead.
export function deckColumns(outline){const [x0,x1]=extent(outline,0),W=PLATFORM.module,cols=[x0];while(x1-cols.at(-1)>W+1e-6)cols.push(cols.at(-1)+W);if(cols.length>1&&x1-cols.at(-1)<12-1e-6)cols[cols.length-1]=(cols.at(-2)+x1)/2;cols.push(x1);return cols;}
// Rims stand on edge around a frame with the same joint at every corner: the side-to-side (front and back)
// rims run the full width and the other rims fit between them. Where two neighbors are the same kind
// (odd angled frames), the earlier one butts into the later one.
const runsThrough=e=>Math.abs(e.u[0])>Math.abs(e.u[1])+1e-9;
function rimPieces(poly){const T=PLATFORM.lumber[0],E=edgeFrames(poly),n=E.length,owner=(a,b)=>runsThrough(a)!==runsThrough(b)?(runsThrough(a)?a:b):b;
 return E.map((e,i)=>{const p=E[(i+n-1)%n],f=E[(i+1)%n];let pg=band(poly,e,0,T);if(owner(p,e)!==e)pg=clipHalf(pg,...p.n,p.c+T);if(owner(e,f)!==e)pg=clipHalf(pg,...f.n,f.c+T);return {poly:pg,length:along(pg,e.u),edge:i};}).filter(r=>r.poly.length>2&&r.length>=PLATFORM.minPiece);}
// Split the outline into movable modules. Frames run the full depth and group whole deck sheet columns,
// as wide as one 8′ stud allows, so rims are single studs and a plywood joint inside a frame sits on a
// doubled pair of seam joists, just like the doubled rims where two frames meet. Rows appear only if an edge would outgrow a stud. A sliver at
// either end merges into its neighbor.
function moduleCells(outline){
 const [z0,z1]=extent(outline,1),depth=z1-z0,fits=pg=>rimPieces(pg).every(r=>r.length<=PLATFORM.stud+1e-6);
 for(let rows=Math.max(1,Math.ceil(depth/PLATFORM.stud-1e-6));;rows++){
  const cells=[];let ok=true;
  for(let r=0;r<rows;r++){
   const lo=z0+depth*r/rows,hi=z0+depth*(r+1)/rows,strip=clipHalf(clipHalf(outline,0,1,lo),0,-1,-hi);if(strip.length<3)continue;
   const cuts=deckColumns(outline);
   const cell=(a,b)=>ccw(clipHalf(clipHalf(strip,1,0,a),-1,0,-b));
   let small=i=>{const pg=cell(cuts[i],cuts[i+1]);if(pg.length<3)return true;const [a,b]=extent(pg,0);return b-a<16||Math.abs(area(pg))<288;};
   while(cuts.length>2&&small(0))cuts.splice(1,1);while(cuts.length>2&&small(cuts.length-2))cuts.splice(cuts.length-2,1);
   const keep=[cuts[0]];for(let i=1;i<cuts.length-1;i++){const pg=cell(keep.at(-1),cuts[i+1]);if(!(pg.length>=3&&fits(pg)))keep.push(cuts[i]);}keep.push(cuts.at(-1));
   for(let i=0;i<keep.length-1;i++){const pg=cell(keep[i],keep[i+1]);if(pg.length>=3&&Math.abs(area(pg))>1){if(!fits(pg))ok=false;cells.push({poly:pg,row:r,col:i});}}
  }
  if(ok||rows>=4)return cells;
 }
}

export function platformPlan(a,back=PLATFORM.gap,side=PLATFORM.gap,pa=a,cfg={}){
 ({back,side}=cycloramaGaps({...cfg,angle:a,platformBack:back,platformSide:side}));
 back=clampGap(back);side=clampGap(side);pa=platformAngleFor(a,pa);const front=frontFor(back,cfg.platformFront);
 const outline=platformOutline(a,back,side,pa,front),T=PLATFORM.lumber[0],D=PLATFORM.lumber[1],modules=[],columns=deckColumns(outline);
 for(const {poly,row,col} of moduleCells(outline)){
  const E=edgeFrames(poly),n=E.length;
  E.forEach(e=>{e.shared=!onOutline(e.A,e.B,outline);Object.assign(e,e.shared?{wall:null,gap:null}:wallOf(e.A,e.B,a,back,side));e.fascia=!e.shared&&!(e.wall&&e.gap===0);});
  const next=i=>E[(i+1)%n],prev=i=>E[(i+n-1)%n];
  // Rims stand on edge around every module. Each one runs into the face of the next (pinwheel butt joints).
  // The bottom ring is an identical copy standing on the floor, so both rings come from one cut list.
  const rims=rimPieces(poly);
  const bottomRims=rims.map(r=>({...r}));
  // A deck joint inside the frame lands on a doubled pair of seam joists running front to back, one under
  // each sheet edge, the same as the doubled rims where two frames meet.
  // Joists run side to side at 16″ centers, across the deck grain, between the rims and any seam joist.
  // A bay under 16″ wide already holds its deck on both long edges, so it gets no joist stubs.
  let inner=poly;for(const e of E)inner=clipHalf(inner,...e.n,e.c+T);
  const [px0,px1]=extent(poly,0),seams=columns.filter(c=>c>px0+2*T+1e-6&&c<px1-2*T-1e-6),seamJoists=[],joists=[];
  if(inner.length>2){
   for(const c of seams)for(const [a,b] of [[c-T,c],[c,c+T]]){const pg=clipHalf(clipHalf(inner,1,0,a),-1,0,-b);if(pg.length>2){const [lo,hi]=extent(pg,1);if(hi-lo>=PLATFORM.minPiece)seamJoists.push({poly:pg,length:hi-lo,x:c,side:a<c?-1:1});}}
   const bays=[-Infinity,...seams.flatMap(c=>[c-T,c+T]),Infinity],[z0,z1]=extent(poly,1);
   for(let z=z0+PLATFORM.joistOC;z<z1-8;z+=PLATFORM.joistOC){const row=clipHalf(clipHalf(inner,0,1,z-T/2),0,-1,-(z+T/2));
    for(let k=0;k<bays.length;k+=2){let pg=row;if(bays[k]>-Infinity)pg=clipHalf(pg,1,0,bays[k]);if(bays[k+1]<Infinity)pg=clipHalf(pg,-1,0,-bays[k+1]);if(pg.length>2){const [lo,hi]=extent(pg,0);if(hi-lo>=PLATFORM.joistOC)joists.push({poly:pg,length:hi-lo,z});}}}
  }
  // Legs: one length, floor to deck, tucked inside both rings at every corner and at least every 4′.
  // Each leg screws through the top rim and the bottom rim, so it is fixed at both ends.
  const legs=[];
  const legPoly=(e,s0,s1,clipTo=[])=>{let pg=band(poly,e,T,T+T);pg=clipHalf(pg,...e.u,s0);pg=clipHalf(pg,-e.u[0],-e.u[1],-s1);for(const f of clipTo)pg=clipHalf(pg,...f.n,f.c+T);return pg;};
  const leg=(e,s0,s1,clipTo=[])=>{const pg=legPoly(e,s0,s1,clipTo);if(pg.length>2)legs.push({poly:pg,length:legLength});};
  // Boxes of the joists and seam joists, so legs can stay out of their way.
  const box=pg=>{const xs=pg.map(q=>q[0]),zs=pg.map(q=>q[1]);return [Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs)];};
  const hits=(a,b)=>a[0]<b[1]-1e-6&&a[1]>b[0]+1e-6&&a[2]<b[3]-1e-6&&a[3]>b[2]+1e-6;
  const blocked=pg=>pg.length>2&&[...joists,...seamJoists].some(j=>hits(box(pg),box(j.poly)));
  E.forEach((e,i)=>{
   if(e.len<PLATFORM.minPiece)return;
   const p=prev(i);let r=band(poly,e,T,T+T);r=clipHalf(r,...p.n,p.c+T);if(r.length>2){const s=Math.min(...r.map(q=>q[0]*e.u[0]+q[1]*e.u[1]));leg(e,s,s+D,[p]);}
   const extra=Math.ceil(e.len/PLATFORM.maxLegSpan)-1,sA=e.A[0]*e.u[0]+e.A[1]*e.u[1];
   // An intermediate leg that would land on a joist or seam joist end slides along the rim to sit beside it.
   for(let k=1;k<=extra;k++){const s0=sA+e.len*k/(extra+1);let s=s0;for(let t=1;t<=60&&blocked(legPoly(e,s-D/2,s+D/2));t++)s=s0+(t%2?1:-1)*Math.ceil(t/2)*.25;leg(e,s-D/2,s+D/2);}
  });
  // A corner leg on an odd-shaped frame can still meet a joist end; that joist stops at the leg's face.
  for(const j of [...joists,...seamJoists]){const alongX=j.z!==undefined;for(const l of legs){const a=box(l.poly),b=box(j.poly);if(!hits(a,b))continue;
   if(alongX){const mid=(b[0]+b[1])/2;j.poly=(a[0]+a[1])/2<mid?clipHalf(j.poly,1,0,a[1]):clipHalf(j.poly,-1,0,-a[0]);}
   else{const mid=(b[2]+b[3])/2;j.poly=(a[2]+a[3])/2<mid?clipHalf(j.poly,0,1,a[3]):clipHalf(j.poly,0,-1,-a[2]);}
   const c=box(j.poly);j.length=alongX?c[1]-c[0]:c[3]-c[2];}}
  // Lauan fascia wraps every exposed edge, floor to top, covering the deck edge.
  const fascia=E.filter(e=>e.fascia).map(e=>{const o=PLATFORM.skin,A=[e.A[0]-e.u[0]*o,e.A[1]-e.u[1]*o],B=[e.B[0]+e.u[0]*o,e.B[1]+e.u[1]*o];return {poly:[A,B,[B[0]-e.n[0]*o,B[1]-e.n[1]*o],[A[0]-e.n[0]*o,A[1]-e.n[1]*o]].reverse(),length:e.len,wall:e.wall};});
  const [mx0,mx1]=extent(poly,0),[mz0,mz1]=extent(poly,1);
  modules.push({poly,row,col,center:centroid(poly),width:mx1-mx0,depth:mz1-mz0,area:Math.abs(area(poly)),edges:E,rims,bottomRims,joists,seamJoists,legs,fascia,
   full:E.length===4&&Math.abs((mx1-mx0)/PLATFORM.module-Math.round((mx1-mx0)/PLATFORM.module))<.001,inside:p=>insidePoly(poly,p)});
 }
 const decks=platformDecks(outline,modules,columns),sheetLayout=packDecks(decks),fasciaPieces=platformFascia(outline,modules);
 return {angle:a,platformAngle:pa,back,side,front,outline,columns,modules,decks,sheetLayout,fasciaPieces,...platformTotals(outline,modules,decks,sheetLayout,fasciaPieces,columns)};
}

// Long side strips bridge frames. Each run of exposed edge splits into the fewest equal strips that fit
// 96″ stock; a joint can land anywhere along the run because the top and bottom rims back it end to end.
export function platformFascia(outline,modules){
 const pieces=[],o=PLATFORM.skin;
 for(const edge of edgeFrames(outline)){
  const project=p=>(p[0]-edge.A[0])*edge.u[0]+(p[1]-edge.A[1])*edge.u[1];
  const spans=modules.flatMap((m,module)=>m.edges.filter(e=>e.fascia&&Math.abs(e.n[0]*edge.n[0]+e.n[1]*edge.n[1]-1)<1e-6&&Math.abs(e.c-edge.c)<1e-6).map(e=>({start:project(e.A),end:project(e.B),module}))).sort((a,b)=>a.start-b.start);
  for(let i=0;i<spans.length;){
   const start=spans[i].start;let end=spans[i].end;while(i+1<spans.length&&Math.abs(spans[i+1].start-end)<1e-6)end=spans[++i].end;i++;
   const left=start<1e-6?o:0,right=end>edge.len-1e-6?o:0,count=Math.max(1,Math.ceil((end-start)/(96-o)-1e-9)),step=(end-start)/count;
   const point=t=>[edge.A[0]+edge.u[0]*t,edge.A[1]+edge.u[1]*t];
   for(let k=0;k<count;k++){
    const s0=start+k*step,s1=k===count-1?end:s0+step,l=k?0:left,r=k===count-1?right:0,A=point(s0-l),B=point(s1+r);
    const members=[...new Set(spans.filter(sp=>Math.min(sp.end,s1)-Math.max(sp.start,s0)>1e-6).map(sp=>sp.module))];
    pieces.push({id:'fascia-'+pieces.length,label:'F'+(pieces.length+1),A:point(s0),B:point(s1),length:s1-s0,cutLength:s1-s0+l+r,height:PLATFORM.height,moduleIndices:members,joint:s0>1e-6,poly:[A,B,[B[0]-edge.n[0]*o,B[1]-edge.n[1]*o],[A[0]-edge.n[0]*o,A[1]-edge.n[1]*o]].reverse()});
   }
  }
 }
 const stock=[];
 for(const p of [...pieces].sort((a,b)=>b.cutLength-a.cutLength)){const length=Math.ceil(p.cutLength*16)/16;let index=stock.findIndex(used=>used+length<=96);if(index<0){index=stock.length;stock.push(0);}stock[index]+=length+PLATFORM.kerf;p.strip=index+1;p.sheet=Math.floor(index/4)+1;}
 return pieces;
}

// One deck per sheet column: the sheet's 8′ length and face grain run front to back, across the side-to-side
// joists, and its full 4′ width is kept. Actual undersized stock is centered over the supporting rims.
export function platformDecks(outline,modules,columns=deckColumns(outline)){
 const decks=[],tolerance=3/32,[W,L]=PLATFORM.sheet;
 for(let k=0;k<columns.length-1;k++){
  const nominalPoly=ccw(clipHalf(clipHalf(outline,1,0,columns[k]),-1,0,-columns[k+1]));if(nominalPoly.length<3||Math.abs(area(nominalPoly))<1)continue;
  const [x0,x1]=extent(nominalPoly,0),[z0,z1]=extent(nominalPoly,1),nominalWidth=x1-x0,nominalDepth=z1-z0;
  if(nominalWidth>W+tolerance||nominalDepth>L+tolerance)throw Error('Deck does not fit the selected plywood stock.');
  const width=Math.min(nominalWidth,W),depth=Math.min(nominalDepth,L),dx=(nominalWidth-width)/2,dz=(nominalDepth-depth)/2;
  const poly=clipHalf(clipHalf(clipHalf(clipHalf(nominalPoly,1,0,x0+dx),-1,0,-(x1-dx)),0,1,z0+dz),0,-1,-(z1-dz));
  const members=modules.flatMap((m,i)=>{const o=clipHalf(clipHalf(m.poly,1,0,x0),-1,0,-x1);return o.length>2&&Math.abs(area(o))>1?[i]:[];});
  decks.push({id:'deck-'+decks.length,label:'D'+(decks.length+1),moduleIndices:members,poly,nominalPoly,width,depth,nominalWidth,nominalDepth,edges:edgeFrames(nominalPoly),area:Math.abs(area(poly)),edgeAllowance:{x:dx,z:dz}});
 }
 return decks;
}
// A conservative, reproducible rectangular cut layout; no rotation, so face grain stays across joists.
// Blanks are width (x, across the sheet) by depth (z, along the 8′ length). Each deck records its saw cuts.
export function packDecks(decks){
 const sheets=[],kerf=PLATFORM.kerf,[W,L]=PLATFORM.sheet;
 for(const deck of [...decks].sort((a,b)=>b.width*b.depth-a.width*a.depth)){
  let target;for(let sheet=0;sheet<sheets.length;sheet++){const index=sheets[sheet].free.findIndex(r=>deck.width<=r.w+1e-7&&deck.depth<=r.h+1e-7);if(index>=0){target={sheet,index};break;}}
  if(!target){sheets.push({cuts:[],free:[{x:0,z:0,w:W,h:L}]});target={sheet:sheets.length-1,index:0};}
  const sheet=sheets[target.sheet],r=sheet.free.splice(target.index,1)[0];if(deck.width>r.w+1e-7||deck.depth>r.h+1e-7)throw Error('Plywood blank exceeds stock.');
  deck.rip=deck.width<r.w-1e-6;deck.crosscut=deck.depth<r.h-1e-6;deck.sawCuts=deck.rip+deck.crosscut;
  sheet.cuts.push({deckId:deck.id,label:deck.label,x:r.x,z:r.z,width:deck.width,depth:deck.depth,sawCuts:deck.sawCuts});deck.sheet=target.sheet+1;
  if(r.w-deck.width>kerf)sheet.free.push({x:r.x+deck.width+kerf,z:r.z,w:r.w-deck.width-kerf,h:r.h});
  if(r.h-deck.depth>kerf)sheet.free.push({x:r.x,z:r.z+deck.depth+kerf,w:deck.width,h:r.h-deck.depth-kerf});
 }
 return sheets;
}
// First-fit decreasing: how many 96″ studs the cut list needs, allowing a saw kerf per cut.
export function studCount(lengths,stock=PLATFORM.stud,kerf=PLATFORM.kerf){const bins=[];for(const len of [...lengths].sort((a,b)=>b-a)){const need=Math.ceil(len*16)/16;const bin=bins.find(b=>b+need<=stock+1e-9);if(bin!==undefined)bins[bins.indexOf(bin)]+=need+kerf;else bins.push(need+kerf);}return bins.length;}

function platformTotals(outline,modules,decks,sheetLayout,fasciaPieces,columns){
 const sum=(f)=>modules.reduce((s,m)=>s+f(m),0),each=(k,f=x=>x.length)=>modules.flatMap(m=>m[k].map(f));
 const lumber=[...each('rims'),...each('bottomRims'),...each('joists'),...each('seamJoists'),...each('legs')];
 const fasciaLength=sum(m=>m.fascia.reduce((s,f)=>s+f.length,0)),seamLength=sum(m=>m.edges.filter(e=>e.shared).reduce((s,e)=>s+e.len,0))/2;
 const fasciaCorners=sum(m=>m.edges.filter((e,i)=>e.fascia&&m.edges[(i+1)%m.edges.length].fascia).length);
 const deckSeamLength=decks.reduce((sum,d)=>sum+d.edges.filter(e=>!onOutline(e.A,e.B,outline)).reduce((n,e)=>n+e.len,0),0)/2;
 // A rim carries a deck edge when it sits on the outline or on a sheet joint; elsewhere it is mid-sheet.
 const deckEdge=e=>onOutline(e.A,e.B,outline)||columns.some(c=>Math.abs(e.A[0]-c)<1e-6&&Math.abs(e.B[0]-c)<1e-6);
 const deckArea=sum(m=>m.area),fasciaArea=fasciaLength*PLATFORM.height;
 return {
  deckArea:deckArea/144,deckSheets:sheetLayout.length,deckSeamLength,fasciaLength,seamLength,fasciaCorners,finishArea:(deckArea+fasciaArea)/144,
  lumberLengths:lumber,studs:studCount(lumber),
  counts:{modules:modules.length,decks:decks.length,fullModules:modules.filter(m=>m.full).length,rims:each('rims').length,joists:each('joists').length,seamJoists:each('seamJoists').length,bottomRims:each('bottomRims').length,legs:each('legs').length},
  frameScrews:sum(m=>m.rims.length*2+m.bottomRims.length*2+(m.joists.length+m.seamJoists.length)*4+m.legs.length*4+m.edges.filter(e=>e.shared).reduce((s,e)=>s+2*Math.max(2,Math.ceil(e.len/24)),0)),
  deckScrews:sum(m=>m.rims.reduce((s,r)=>s+Math.ceil(r.length/(deckEdge(m.edges[r.edge])?6:12))+1,0)+m.joists.reduce((s,j)=>s+Math.ceil(j.length/12)+1,0)+m.seamJoists.reduce((s,j)=>s+Math.ceil(j.length/6)+1,0)),
  deckCuts:decks.reduce((s,d)=>s+d.sawCuts,0),
  staples:fasciaPieces.reduce((s,f)=>s+2*(Math.ceil(f.length/4)+1),0),
  padArea:(sum(m=>m.legs.length+m.bottomRims.reduce((s,x)=>s+Math.ceil(x.length/24)+1,0)))*PLATFORM.lumber[0]*PLATFORM.lumber[1],
  fasciaStrips:Math.max(0,...fasciaPieces.map(f=>f.strip)),fasciaSheets:Math.max(0,...fasciaPieces.map(f=>f.sheet)),
  tapeLength:deckSeamLength+fasciaPieces.filter(f=>f.joint).length*PLATFORM.height,
  beadLength:fasciaLength+fasciaCorners*PLATFORM.height
 };
}
// Cut list grouped by part and length (rounded to 1/16″) for the Build guide.
export function platformCuts(plan){const groups=new Map(),add=(part,len,note)=>{const r=Math.round(len*16)/16,k=part+'|'+r;const g=groups.get(k)||{part,length:r,qty:0,note};g.qty++;groups.set(k,g);};
 for(const m of plan.modules){m.rims.forEach(r=>add('Rim',r.length,'2×4 on edge; follow the module outline at angled corners'));m.bottomRims.forEach(r=>add('Bottom rim',r.length,'2×4 on edge on the floor; same as the top rims'));m.joists.forEach(j=>add('Joist',j.length,'2×4 on edge, side to side at 16″ centers'));m.seamJoists.forEach(j=>add('Seam joist',j.length,'2×4 on edge, doubled front to back under a plywood joint'));m.legs.forEach(l=>add('Leg',l.length,'2×4 upright, floor to deck, inside both rims'));}
 return [...groups.values()].sort((a,b)=>a.part.localeCompare(b.part)||b.length-a.length);}
// The same cuts by length, longest first, so the guide can walk through them one stop-block setting at a time.
const PART_ORDER=['Rim','Bottom rim','Joist','Seam joist','Leg'];
export function cutSequence(plan){const by=new Map();for(const c of platformCuts(plan)){const g=by.get(c.length)||{length:c.length,qty:0,parts:[]};g.qty+=c.qty;g.parts.push({part:c.part,qty:c.qty});by.set(c.length,g);}
 return [...by.values()].map(g=>({...g,parts:g.parts.sort((a,b)=>PART_ORDER.indexOf(a.part)-PART_ORDER.indexOf(b.part))})).sort((a,b)=>b.length-a.length);}
export const inches=v=>{const w=Math.floor(v+1e-9),f=Math.round((v-w)*16);if(f===16)return `${w+1}″`;if(!f)return `${w}″`;let n=f,d=16;while(n%2===0){n/=2;d/=2;}return `${w?w+' ':''}${n}/${d}″`;};

// Floor overlay planning is independent of the raised platform.
export {floorSheetPlan} from './floor-plan.js';
