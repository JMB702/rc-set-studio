// Use physical module joints rather than a painted-on grid that drifts when the layout changes.
// tint scales the filler: 1 is the plain compound sample, SKIM_TINT reads as gray cement skim.
export const SKIM_TINT=.42;
export function applyPlatformSeamTexture(material,part,texture,tint=1){
 const edges=new Float32Array(32);edges.set((part.seamEdges||[]).slice(0,8).flat());
 material.customProgramCacheKey=()=> 'platform-seam-compound-v1';
 material.onBeforeCompile=shader=>{
  shader.uniforms.platformSeamMap={value:texture};shader.uniforms.platformSeamTint={value:tint};shader.uniforms.platformSeamEdges={value:edges};shader.uniforms.platformSeamCount={value:Math.min(8,(part.seamEdges||[]).length)};
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vPlatformLocal;\nvarying float vPlatformTop;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPlatformLocal = position / 0.0254;\nvPlatformTop = abs(normal.y);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vPlatformLocal; varying float vPlatformTop;
   uniform sampler2D platformSeamMap; uniform vec4 platformSeamEdges[8]; uniform int platformSeamCount; uniform float platformSeamTint;
   float platformSegmentDistance(vec2 p,vec2 a,vec2 b){vec2 ab=b-a;float t=clamp(dot(p-a,ab)/max(dot(ab,ab),0.0001),0.0,1.0);return length(p-a-t*ab);}
  `).replace('#include <map_fragment>',`#include <map_fragment>
   vec2 platformPoint=vec2(vPlatformLocal.x,vPlatformLocal.z);float jointDistance=10000.0;
   for(int i=0;i<8;i++){if(i>=platformSeamCount)break;vec4 edge=platformSeamEdges[i];
    if(vPlatformTop>0.5)jointDistance=min(jointDistance,platformSegmentDistance(platformPoint,edge.xy,edge.zw));
    else jointDistance=min(jointDistance,min(length(platformPoint-edge.xy),length(platformPoint-edge.zw)));
   }
   if(vPlatformTop<0.5)jointDistance=min(jointDistance,abs(vPlatformLocal.y-10.0));
   vec2 compoundUV=vPlatformTop>0.5?platformPoint/24.0:vec2(vPlatformLocal.x-vPlatformLocal.z,vPlatformLocal.y)/24.0;
   vec3 compoundSample=mix(texture2D(platformSeamMap,compoundUV).rgb,vec3(0.88),0.45);
   float feather=1.0-smoothstep(1.4,3.8+(compoundSample.r-0.5)*0.7,jointDistance);
   diffuseColor.rgb=mix(diffuseColor.rgb,pow(compoundSample,vec3(2.2))*platformSeamTint,feather);
  `);
 };
 material.needsUpdate=true;return material;
}

// A finish layer over the existing plywood material: same mesh, UVs and grain underneath.
const inch=.0254;
export function platformSeamSegments(edges,fascia=false,height=10){
 const out=[],point=(p,y)=>[p[0]*inch,y*inch,p[1]*inch];
 for(const e of edges){out.push([point(e.A,height),point(e.B,height)]);if(fascia){out.push([point(e.A,0),point(e.A,height)],[point(e.B,0),point(e.B,height)]);}}
 return out;
}
export function applyPlatformSeams(material,segments){
 if(!segments?.length)return material;
 const a=new Float32Array(segments.flatMap(s=>s[0])),b=new Float32Array(segments.flatMap(s=>s[1]));
 material.onBeforeCompile=shader=>{
  shader.uniforms.platformSeamA={value:a};shader.uniforms.platformSeamB={value:b};
  shader.vertexShader='varying vec3 platformFinishPoint;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nplatformFinishPoint = position;');
  shader.fragmentShader=`varying vec3 platformFinishPoint;\nuniform vec3 platformSeamA[${segments.length}];\nuniform vec3 platformSeamB[${segments.length}];\n`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float seamDistance = 10000.0;
   for (int i=0; i<${segments.length}; i++) {
    vec3 span=platformSeamB[i]-platformSeamA[i];
    float t=clamp(dot(platformFinishPoint-platformSeamA[i],span)/max(dot(span,span),0.000001),0.0,1.0);
    seamDistance=min(seamDistance,length(platformFinishPoint-platformSeamA[i]-span*t));
   }
   float toolEdge=0.003*sin(dot(platformFinishPoint,vec3(23.0,19.0,17.0)))+0.0015*sin(dot(platformFinishPoint,vec3(73.0,11.0,61.0)));
   float plaster=1.0-smoothstep(0.012,0.112,seamDistance+toolEdge);
   float toolMark=0.97+0.02*sin(dot(platformFinishPoint,vec3(41.0,37.0,31.0)));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.863,0.855,0.799)*toolMark,plaster);
  `);
 };
 material.customProgramCacheKey=()=>`platform-feathered-seams-v1-${segments.length}`;
 material.needsUpdate=true;return material;
}

// The fascia gets the same drywall joint compound as the wall seams, so it is drawn the same way as
// wallSeamCoverage() in wall-appearance.js: a smoothstep feather about 4.4″ wide with a slight wave and
// trowel variation, in the same off-white, over the lauan. Bands sit on strip joints and outside corners
// (the ends of each fascia piece) plus a narrower band on the top edge where the side meets the deck.
export function applyFasciaCompound(material,part){
 const ends=new Float32Array(32);ends.set((part.seamEdges||[]).slice(0,8).flat());
 material.customProgramCacheKey=()=>'platform-fascia-compound-v1';
 material.onBeforeCompile=shader=>{
  shader.uniforms.fasciaEnds={value:ends};shader.uniforms.fasciaCount={value:Math.min(8,(part.seamEdges||[]).length)};
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFasciaLocal;\nvarying float vFasciaTop;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFasciaLocal = position / 0.0254;\nvFasciaTop = abs(normal.y);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vFasciaLocal; varying float vFasciaTop; uniform vec4 fasciaEnds[8]; uniform int fasciaCount;
   float fasciaFeather(float d,float w){float t=clamp(1.0-d/w,0.0,1.0);return t*t*(3.0-2.0*t);}
  `).replace('#include <map_fragment>',`#include <map_fragment>
   if(vFasciaTop<0.5){
    vec2 p=vFasciaLocal.xz;float y=vFasciaLocal.y,d=10000.0;
    for(int i=0;i<8;i++){if(i>=fasciaCount)break;vec4 e=fasciaEnds[i];d=min(d,min(length(p-e.xy),length(p-e.zw)));}
    float wave=.28*sin(y*.31)+.14*sin(y*1.13),width=4.4+.3*sin(y*.21),run=p.x+p.y;
    float a=max(fasciaFeather(abs(d+wave),width),fasciaFeather(abs(10.0-y)+.22*sin(run*.45),2.4))*(.94+.04*sin(y*1.7+run*.31));
    vec3 filler=vec3(.863,.855,.799)*(1.0+.007*sin(run*.7+y*.31));
    diffuseColor.rgb=mix(diffuseColor.rgb,filler,clamp(a,0.0,1.0));
   }
  `);
 };
 material.needsUpdate=true;return material;
}

// GLSL twin of fillPatch() in wall-appearance.js: one knifed dab of compound over a fastener.
const FILL_GLSL=`
 float fillHash(float n){return fract(sin(n*12.9898+78.233)*43758.5453);}
 float fillPatch(vec2 d,vec2 h,float seed){float ang=atan(d.y,d.x);vec2 q=abs(d)/h;float r=pow(q.x*q.x*q.x+q.y*q.y*q.y,1.0/3.0)*(1.0+.12*sin(ang*3.0+fillHash(seed+.9)*6.2832)+.06*sin(ang*7.0+fillHash(seed+.45)*6.2832));return (1.0-smoothstep(.82,1.0,r))*(.88+.12*fillHash(seed*3.1+.7));}
`;

// The rounded wall corner's skin at the wall finish: bare lauan like the walls, with the same feathered joint
// compound as the wall seams (wallSeamCoverage) only at its seams: both edges where the curve meets the flat
// walls, the vertical joints between skin sheets and the horizontal joint where the 8′ sheet meets the top piece.
// Uses the skin grid's UVs: u runs along the developed arc, v up the height. fastenerRows are the rib centers (inches
// from this piece's bottom edge): the skin is screwed into each rib about every 6″ along the arc, 8 per 48″ rib, and
// each screw head gets a dab of fill like the wall staples.
export function cornerScrewPositions(arc){const out=[];for(let s=3;s<=arc-2;s+=6)out.push(s);return out;}
export function applyCornerSkinSeams(material,{arc,height,uJoints,vJoints,fastenerRows=[]}){
 const u=new Float32Array(8),v=new Float32Array(4),f=new Float32Array(8);u.set(uJoints.slice(0,8));v.set(vJoints.slice(0,4));f.set(fastenerRows.slice(0,8));
 material.customProgramCacheKey=()=>'corner-skin-seams-v2';
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{seamArc:{value:arc},seamHeight:{value:height},seamU:{value:u},seamUCount:{value:Math.min(8,uJoints.length)},seamV:{value:v},seamVCount:{value:Math.min(4,vJoints.length)},fillRows:{value:f},fillRowCount:{value:Math.min(8,fastenerRows.length)}});
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vSeamUv;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSeamUv = uv;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec2 vSeamUv; uniform float seamArc,seamHeight,seamU[8],seamV[4],fillRows[8]; uniform int seamUCount,seamVCount,fillRowCount;
   float seamFeather(float d,float w){float t=clamp(1.0-d/w,0.0,1.0);return t*t*(3.0-2.0*t);}
  `+FILL_GLSL).replace('#include <map_fragment>',`#include <map_fragment>
   float x=vSeamUv.x*seamArc,y=vSeamUv.y*seamHeight,a=0.0;
   float wave=.28*sin(y*.31)+.14*sin(y*1.13),width=4.4+.3*sin(y*.21);
   for(int i=0;i<8;i++){if(i>=seamUCount)break;a=max(a,seamFeather(abs(x-seamU[i]*seamArc+wave),width));}
   for(int i=0;i<4;i++){if(i>=seamVCount)break;a=max(a,seamFeather(abs(y-seamV[i]+.22*sin(x*.45)),4.6));}
   a*=.94+.04*sin(y*1.7+x*.31);
   for(int i=0;i<8;i++){if(i>=fillRowCount)break;float dy=y-fillRows[i];if(abs(dy)>3.0)continue;float k0=floor((x-3.0)/6.0+.5);
    for(int j=-1;j<=1;j++){float k=k0+float(j),seed=float(i)*13.0+k+300.0;if(k<0.0||3.0+6.0*k>seamArc-2.0||fillHash(seed)<.08)continue;
     a=max(a,fillPatch(vec2(x-3.0-6.0*k-(fillHash(seed+.137)-.5)*.8,dy-(fillHash(seed+.274)-.5)*.5),vec2(1.1+.4*fillHash(seed+.411),1.2+.6*fillHash(seed+.685)),seed));}}
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.863,.855,.799)*(1.0+.007*sin(x*.7+y*.31)),clamp(a,0.0,1.0));
  `);
 };
 material.needsUpdate=true;return material;
}

// Plaster at the rounded corner's edges carries onto the flat wall: a band of the wall seams' joint compound
// centered on each line where the curve meets the wall. tangents are [x, z] points in inches (world space).
// fills (cornerBackboardFills() in cyclorama.js) are the backboards added behind the panel beside each corner: their
// staples go through the wall face every 3″, from the band out to the panel's far stile, and each gets a dab of fill.
export function applyWallTangentSeams(material,tangents,fills={}){
 const t=new Float32Array(8),rows=new Float32Array(4),reach=fills.reach??0;t.set(tangents.slice(0,4).flat());rows.set((fills.rows||[]).slice(0,4));
 material.customProgramCacheKey=()=>'wall-tangent-seams-v2';
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{tangentPoints:{value:t},tangentCount:{value:Math.min(4,tangents.length)},fillRows:{value:rows},fillRowCount:{value:reach>0?Math.min(4,(fills.rows||[]).length):0},fillReach:{value:reach}});
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vTangentWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTangentWorld = (modelMatrix * vec4(position, 1.0)).xyz / 0.0254;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vTangentWorld; uniform vec2 tangentPoints[4]; uniform int tangentCount,fillRowCount; uniform float fillRows[4],fillReach;
   float tangentFeather(float d,float w){float t=clamp(1.0-d/w,0.0,1.0);return t*t*(3.0-2.0*t);}
  `+FILL_GLSL).replace('#include <map_fragment>',`#include <map_fragment>
   float y=vTangentWorld.y,a=0.0,wave=.28*sin(y*.31)+.14*sin(y*1.13),width=4.4+.3*sin(y*.21);
   for(int i=0;i<4;i++){if(i>=tangentCount)break;a=max(a,tangentFeather(abs(length(vTangentWorld.xz-tangentPoints[i])+wave),width));}
   a*=.94+.04*sin(y*1.7+vTangentWorld.x*.31);
   for(int i=0;i<4;i++){if(i>=tangentCount)break;float d=length(vTangentWorld.xz-tangentPoints[i]);if(d>fillReach)continue;
    for(int r=0;r<4;r++){if(r>=fillRowCount)break;float dy=y-fillRows[r];if(abs(dy)>2.0)continue;float k0=floor((fillReach-2.25-d)/3.0+.5);
     for(int j=-1;j<=1;j++){float k=k0+float(j),at=fillReach-2.25-3.0*k,seed=float(i)*41.0+float(r)*13.0+k+700.0;if(k<0.0||at<.5||fillHash(seed)<.1)continue;
      a=max(a,fillPatch(vec2(d-at-(fillHash(seed+.137)-.5)*.5,dy-(fillHash(seed+.274)-.5)*.4),vec2(1.0+.4*fillHash(seed+.411),.7+.3*fillHash(seed+.685)),seed));}}}
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.863,.855,.799)*(1.0+.007*sin(vTangentWorld.x*.7+y*.31)),clamp(a,0.0,1.0));
  `);
 };
 material.needsUpdate=true;return material;
}

// Wood filler on the painted floor's top and the platform deck (Jeff, Oct 23, 2026): crisp, sanded-flush spots over every
// screw head and a narrow filled strip along each plywood joint, on the bare sanded wood. Same patch shape as the plaster
// fills (FILL_GLSL), smaller, in the filler's dried light tan. fill: {grid, lines, seams} in plan inches, from
// deckFillLayout() or the floor's 8″ screw grid; only the top face is filled.
export function applyWoodFill(material,{grid=0,lines=[],seams=[]}={}){
 const L=new Float32Array(96),S=new Float32Array(24),E=new Float32Array(64);lines.slice(0,24).forEach((l,i)=>{L.set(l.slice(0,4),i*4);S[i]=l[4]||12;});E.set(seams.slice(0,16).flat());
 material.customProgramCacheKey=()=>'wood-fill-v1';
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{fillGrid:{value:grid},fillLines:{value:L},fillSpacing:{value:S},fillLineCount:{value:Math.min(24,lines.length)},fillSeams:{value:E},fillSeamCount:{value:Math.min(16,seams.length)}});
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWoodLocal;\nvarying float vWoodTop;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWoodLocal = position / 0.0254;\nvWoodTop = normal.y;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vWoodLocal; varying float vWoodTop; uniform float fillGrid,fillSpacing[24]; uniform vec4 fillLines[24],fillSeams[16]; uniform int fillLineCount,fillSeamCount;
  `+FILL_GLSL).replace('#include <map_fragment>',`#include <map_fragment>
   if(abs(vWoodTop)>0.5){
    vec2 p=vWoodLocal.xz;float a=0.0;
    for(int i=0;i<16;i++){if(i>=fillSeamCount)break;vec4 e=fillSeams[i];vec2 ab=e.zw-e.xy;float t=clamp(dot(p-e.xy,ab)/max(dot(ab,ab),0.0001),0.0,1.0),run=t*length(ab),d=length(p-e.xy-ab*t),w=.5+.18*sin(run*.37+float(i))+.1*sin(run*1.3);
     a=max(a,(1.0-smoothstep(w-.08,w+.08,d))*(.88+.08*sin(run*.9)));}
    for(int i=0;i<24;i++){if(i>=fillLineCount)break;vec4 e=fillLines[i];vec2 ab=e.zw-e.xy;float len=length(ab);if(len<0.01)continue;vec2 u=ab/len,q=p-e.xy;float along=dot(q,u),across=dot(q,vec2(-u.y,u.x));if(abs(across)>1.5||along<-1.5||along>len+1.5)continue;
     float n=max(1.0,floor(len/fillSpacing[i]+.5)),gap=len/n,k=clamp(floor(along/gap),0.0,n-1.0),seed=float(i)*31.0+k+900.0;
     a=max(a,fillPatch(vec2(along-(k+.5)*gap-(fillHash(seed+.137)-.5)*.4,across-(fillHash(seed+.274)-.5)*.3),vec2(.45+.2*fillHash(seed+.411),.4+.2*fillHash(seed+.685)),seed));}
    if(fillGrid>0.0){vec2 g=floor((p-fillGrid*.5)/fillGrid+.5)*fillGrid+fillGrid*.5;float seed=g.x*.37+g.y*1.13+1700.0;
     a=max(a,fillPatch(p-g-(vec2(fillHash(seed+.1),fillHash(seed+.2))-.5)*.4,vec2(.45+.2*fillHash(seed+.3),.4+.2*fillHash(seed+.4)),seed));}
    // Dried filler is a warmer, darker tan than the sanded pine; taken relative to the wood so it reads under any light.
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.62,.50,.36)*(.96+.06*fillHash(floor(p.x*2.0)+floor(p.y*2.0)*7.0)),clamp(a,0.0,1.0)*.95);
   }
  `);
 };
 material.needsUpdate=true;return material;
}
