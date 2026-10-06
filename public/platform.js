// Raised platform floor: pure geometry shared by the 3D model, the Build guide and the Pricing guide.
// No imports, so Node tests and the pricing calculator can use it directly.
// Units are inches. x runs along the back wall (center 0); z runs forward from the wall face.
// The floor footprint (and the platform's front edge) is 96″ deep.
export const PLATFORM={
 height:10,            // finished top above the floor
 deck:.578,            // Plytanium 19/32″ BC sanded plywood, actual thickness
 sheet:[47.938,95.938],// actual sheet size
 lumber:[1.5,3.5],     // actual 2×4
 rim:3.5,              // rims and joists stand on edge
 sill:1.5,             // sills lie flat under the fascia
 module:48,            // largest module side; a half-sheet deck (47 29/32″ × 47 15/16″ actual) lands ≤3/32″ short, filled by compound
 joistOC:16,
 maxLegSpan:48,
 skin:.106,            // lauan fascia, actual thickness
 stud:96,kerf:.125,
 gap:12,gapMin:0,gapMax:48
};
export const legLength=PLATFORM.height-PLATFORM.deck;           // 9.422″ under the deck
export const sillLegLength=legLength-PLATFORM.sill;              // 7.922″ when standing on a sill
export const rimBottom=legLength-PLATFORM.rim;                   // 5.922″
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
export function platformOutline(a,back=PLATFORM.gap,side=PLATFORM.gap,pa=a){
 pa=platformAngleFor(a,pa);const L=wallLines(a),P=wallLines(pa);let p=footprint(a);
 p=clipHalf(p,...L.back.n,L.back.c+back);
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

// Split the outline into movable modules: each row is divided into equal columns and rows are of equal
// depth, none larger than 48″, so every deck is at most half a sheet. A sliver at either end merges into its neighbor.
function moduleCells(outline){
 const M=PLATFORM.module,[z0,z1]=extent(outline,1),depth=z1-z0,rows=Math.max(1,Math.ceil(depth/M-1e-6)),cells=[];
 for(let r=0;r<rows;r++){
  const lo=z0+depth*r/rows,hi=z0+depth*(r+1)/rows,strip=clipHalf(clipHalf(outline,0,1,lo),0,-1,-hi);if(strip.length<3)continue;
  const [x0,x1]=extent(strip,0),cols=Math.max(1,Math.ceil((x1-x0)/M-1e-6)),cuts=[];for(let k=0;k<=cols;k++)cuts.push(x0+(x1-x0)*k/cols);
  const cell=(a,b)=>ccw(clipHalf(clipHalf(strip,1,0,a),-1,0,-b));
  let small=i=>{const pg=cell(cuts[i],cuts[i+1]);if(pg.length<3)return true;const [a,b]=extent(pg,0);return b-a<16||Math.abs(area(pg))<288;};
  while(cuts.length>2&&small(0))cuts.splice(1,1);while(cuts.length>2&&small(cuts.length-2))cuts.splice(cuts.length-2,1);
  for(let i=0;i<cuts.length-1;i++){const pg=cell(cuts[i],cuts[i+1]);if(pg.length>=3&&Math.abs(area(pg))>1)cells.push({poly:pg,row:r,col:i});}
 }
 return cells;
}

export function platformPlan(a,back=PLATFORM.gap,side=PLATFORM.gap,pa=a){
 back=clampGap(back);side=clampGap(side);pa=platformAngleFor(a,pa);
 const outline=platformOutline(a,back,side,pa),T=PLATFORM.lumber[0],D=PLATFORM.lumber[1],modules=[];
 for(const {poly,row,col} of moduleCells(outline)){
  const E=edgeFrames(poly),n=E.length;
  E.forEach(e=>{e.shared=!onOutline(e.A,e.B,outline);Object.assign(e,e.shared?{wall:null,gap:null}:wallOf(e.A,e.B,a,back,side));e.fascia=!e.shared&&!(e.wall&&e.gap===0);});
  const next=i=>E[(i+1)%n],prev=i=>E[(i+n-1)%n];
  // Rims stand on edge around every module. Each one runs into the face of the next (pinwheel butt joints).
  const rims=E.map((e,i)=>{let pg=band(poly,e,0,T);pg=clipHalf(pg,...next(i).n,next(i).c+T);return {poly:pg,length:along(pg,e.u),edge:i};}).filter(r=>r.poly.length>2);
  // Sills lie flat under every edge that gets a fascia; they back its lower half.
  const sills=E.map((e,i)=>{if(!e.fascia)return null;let pg=band(poly,e,0,D);if(next(i).fascia)pg=clipHalf(pg,...next(i).n,next(i).c+D);return {poly:pg,length:along(pg,e.u),edge:i};}).filter(s=>s&&s.poly.length>2);
  // Joists run front-to-back at 16″ centers between the rims.
  let inner=poly;for(const e of E)inner=clipHalf(inner,...e.n,e.c+T);
  const joists=[];if(inner.length>2){const [x0,x1]=extent(poly,0);for(let x=x0+PLATFORM.joistOC;x<x1-8;x+=PLATFORM.joistOC){const pg=clipHalf(clipHalf(inner,1,0,x-T/2),-1,0,-(x+T/2));if(pg.length>2){const [lo,hi]=extent(pg,1);if(hi-lo>=6)joists.push({poly:pg,length:hi-lo,x});}}}
  // Legs: one tucked into every corner, plus intermediate legs so no rim spans more than 4′.
  const legs=[];
  const leg=(e,s0,s1,onSill,clipTo=[])=>{let pg=band(poly,e,T,T+T);pg=clipHalf(pg,...e.u,s0);pg=clipHalf(pg,-e.u[0],-e.u[1],-s1);for(const f of clipTo)pg=clipHalf(pg,...f.n,f.c+T);if(pg.length>2)legs.push({poly:pg,length:onSill?sillLegLength:legLength,onSill});};
  E.forEach((e,i)=>{
   const p=prev(i),useEnd=p.fascia&&!e.fascia;
   if(useEnd){// corner leg sits along the fascia edge so it lands fully on that edge's sill
    let r=band(poly,p,T,T+T);r=clipHalf(r,...e.n,e.c+T);if(r.length>2){const s=Math.max(...r.map(q=>q[0]*p.u[0]+q[1]*p.u[1]));leg(p,s-D,s,true,[e]);}
   }else{
    let r=band(poly,e,T,T+T);r=clipHalf(r,...p.n,p.c+T);if(r.length>2){const s=Math.min(...r.map(q=>q[0]*e.u[0]+q[1]*e.u[1]));leg(e,s,s+D,e.fascia,[p]);}
   }
   const extra=Math.ceil(e.len/PLATFORM.maxLegSpan)-1,sA=e.A[0]*e.u[0]+e.A[1]*e.u[1];
   for(let k=1;k<=extra;k++){const s=sA+e.len*k/(extra+1);leg(e,s-D/2,s+D/2,e.fascia);}
  });
  // Lauan fascia wraps every exposed edge, floor to top, covering the deck edge.
  const fascia=E.filter(e=>e.fascia).map(e=>{const o=PLATFORM.skin,A=[e.A[0]-e.u[0]*o,e.A[1]-e.u[1]*o],B=[e.B[0]+e.u[0]*o,e.B[1]+e.u[1]*o];return {poly:[A,B,[B[0]-e.n[0]*o,B[1]-e.n[1]*o],[A[0]-e.n[0]*o,A[1]-e.n[1]*o]].reverse(),length:e.len,wall:e.wall};});
  const [mx0,mx1]=extent(poly,0),[mz0,mz1]=extent(poly,1);
  modules.push({poly,row,col,center:centroid(poly),width:mx1-mx0,depth:mz1-mz0,area:Math.abs(area(poly)),edges:E,rims,sills,joists,legs,fascia,
   full:E.length===4&&Math.abs(mx1-mx0-PLATFORM.module)<.01&&Math.abs(mz1-mz0-PLATFORM.module)<.01,inside:p=>insidePoly(poly,p)});
 }
 return {angle:a,platformAngle:pa,back,side,outline,modules,...platformTotals(outline,modules)};
}

// Deck pieces nest by their bounding boxes: a piece up to 48″ square takes half a sheet, one that is also
// no more than 23⅞″ in one direction takes a quarter, and a merged end module larger than half a sheet is pieced from a whole one.
export function deckSheets(modules){const M=PLATFORM.module,slots=modules.reduce((s,m)=>{const a=Math.min(m.width,m.depth),b=Math.max(m.width,m.depth);return s+(b>M+1e-6?2:a<=23.875+1e-6?.5:1);},0);return Math.ceil(slots/2);}
// First-fit decreasing: how many 96″ studs the cut list needs, allowing a saw kerf per cut.
export function studCount(lengths,stock=PLATFORM.stud,kerf=PLATFORM.kerf){const bins=[];for(const len of [...lengths].sort((a,b)=>b-a)){const need=Math.ceil(len*16)/16;const bin=bins.find(b=>b+need<=stock+1e-9);if(bin!==undefined)bins[bins.indexOf(bin)]+=need+kerf;else bins.push(need+kerf);}return bins.length;}

function platformTotals(outline,modules){
 const sum=(f)=>modules.reduce((s,m)=>s+f(m),0),each=(k,f=x=>x.length)=>modules.flatMap(m=>m[k].map(f));
 const lumber=[...each('rims'),...each('joists'),...each('legs'),...each('sills')];
 const fasciaLength=sum(m=>m.fascia.reduce((s,f)=>s+f.length,0)),seamLength=sum(m=>m.edges.filter(e=>e.shared).reduce((s,e)=>s+e.len,0))/2;
 const fasciaCorners=sum(m=>m.edges.filter((e,i)=>e.fascia&&m.edges[(i+1)%m.edges.length].fascia).length);
 const legs=each('legs',l=>l),fullLegs=legs.filter(l=>!l.onSill).length;
 const deckArea=sum(m=>m.area),fasciaArea=fasciaLength*PLATFORM.height;
 return {
  deckArea:deckArea/144,deckSheets:deckSheets(modules),fasciaLength,seamLength,fasciaCorners,finishArea:(deckArea+fasciaArea)/144,
  lumberLengths:lumber,studs:studCount(lumber),
  counts:{modules:modules.length,fullModules:modules.filter(m=>m.full).length,rims:each('rims').length,joists:each('joists').length,legs:legs.length,sillLegs:legs.length-fullLegs,fullLegs,sills:each('sills').length},
  frameScrews:sum(m=>m.rims.length*2+m.joists.length*4+m.legs.length*4+m.legs.filter(l=>l.onSill).length*2+m.sills.length*2+m.edges.filter(e=>e.shared).reduce((s,e)=>s+Math.max(2,Math.ceil(e.len/24)),0)),
  deckScrews:sum(m=>m.rims.reduce((s,r)=>s+Math.ceil(r.length/6)+1,0)+m.joists.reduce((s,j)=>s+Math.ceil(j.length/12)+1,0)),
  staples:sum(m=>m.fascia.reduce((s,f)=>s+2*(Math.ceil(f.length/4)+1),0)+m.legs.filter(l=>l.onSill).length*3),
  padArea:fullLegs*PLATFORM.lumber[0]*PLATFORM.lumber[1]+sum(m=>m.sills.reduce((s,x)=>s+(Math.ceil(x.length/24)+1)*PLATFORM.lumber[1]**2,0)),
  fasciaStrips:Math.ceil(fasciaLength*1.1/PLATFORM.stud),
  tapeLength:seamLength+Math.ceil(fasciaLength*1.1/PLATFORM.stud)*PLATFORM.height,
  beadLength:fasciaLength+fasciaCorners*PLATFORM.height
 };
}
// Cut list grouped by part and length (rounded to 1/16″) for the Build guide.
export function platformCuts(plan){const groups=new Map(),add=(part,len,note)=>{const r=Math.round(len*16)/16,k=part+'|'+r;const g=groups.get(k)||{part,length:r,qty:0,note};g.qty++;groups.set(k,g);};
 for(const m of plan.modules){m.rims.forEach(r=>add('Rim',r.length,'2×4 on edge; follow the module outline at angled corners'));m.joists.forEach(j=>add('Joist',j.length,'2×4 on edge, 16″ centers'));m.legs.forEach(l=>add(l.onSill?'Leg on sill':'Leg',l.length,'2×4 upright under the deck'));m.sills.forEach(s=>add('Sill',s.length,'2×4 laid flat under the fascia'));}
 return [...groups.values()].sort((a,b)=>a.part.localeCompare(b.part)||b.length-a.length);}
export const inches=v=>{const w=Math.floor(v+1e-9),f=Math.round((v-w)*16);if(f===16)return `${w+1}″`;if(!f)return `${w}″`;let n=f,d=16;while(n%2===0){n/=2;d/=2;}return `${w?w+' ':''}${n}/${d}″`;};
