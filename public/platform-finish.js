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

// The rounded wall corner's skin at the wall finish: bare lauan like the walls, with the same feathered joint
// compound as the wall seams (wallSeamCoverage) only at its seams: both edges where the curve meets the flat
// walls, the vertical joints between skin sheets and the horizontal joint where the 8′ sheet meets the top piece.
// Uses the skin grid's UVs: u runs along the developed arc, v up the height.
export function applyCornerSkinSeams(material,{arc,height,uJoints,vJoints}){
 const u=new Float32Array(8),v=new Float32Array(4);u.set(uJoints.slice(0,8));v.set(vJoints.slice(0,4));
 material.customProgramCacheKey=()=>'corner-skin-seams-v1';
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{seamArc:{value:arc},seamHeight:{value:height},seamU:{value:u},seamUCount:{value:Math.min(8,uJoints.length)},seamV:{value:v},seamVCount:{value:Math.min(4,vJoints.length)}});
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vSeamUv;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSeamUv = uv;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec2 vSeamUv; uniform float seamArc,seamHeight,seamU[8],seamV[4]; uniform int seamUCount,seamVCount;
   float seamFeather(float d,float w){float t=clamp(1.0-d/w,0.0,1.0);return t*t*(3.0-2.0*t);}
  `).replace('#include <map_fragment>',`#include <map_fragment>
   float x=vSeamUv.x*seamArc,y=vSeamUv.y*seamHeight,a=0.0;
   float wave=.28*sin(y*.31)+.14*sin(y*1.13),width=4.4+.3*sin(y*.21);
   for(int i=0;i<8;i++){if(i>=seamUCount)break;a=max(a,seamFeather(abs(x-seamU[i]*seamArc+wave),width));}
   for(int i=0;i<4;i++){if(i>=seamVCount)break;a=max(a,seamFeather(abs(y-seamV[i]+.22*sin(x*.45)),4.6));}
   a*=.94+.04*sin(y*1.7+x*.31);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.863,.855,.799)*(1.0+.007*sin(x*.7+y*.31)),clamp(a,0.0,1.0));
  `);
 };
 material.needsUpdate=true;return material;
}

// Plaster at the rounded corner's edges carries onto the flat wall: a band of the wall seams' joint compound
// centered on each line where the curve meets the wall. tangents are [x, z] points in inches (world space).
export function applyWallTangentSeams(material,tangents){
 const t=new Float32Array(8);t.set(tangents.slice(0,4).flat());
 material.customProgramCacheKey=()=>'wall-tangent-seams-v1';
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{tangentPoints:{value:t},tangentCount:{value:Math.min(4,tangents.length)}});
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vTangentWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTangentWorld = (modelMatrix * vec4(position, 1.0)).xyz / 0.0254;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vTangentWorld; uniform vec2 tangentPoints[4]; uniform int tangentCount;
   float tangentFeather(float d,float w){float t=clamp(1.0-d/w,0.0,1.0);return t*t*(3.0-2.0*t);}
  `).replace('#include <map_fragment>',`#include <map_fragment>
   float y=vTangentWorld.y,a=0.0,wave=.28*sin(y*.31)+.14*sin(y*1.13),width=4.4+.3*sin(y*.21);
   for(int i=0;i<4;i++){if(i>=tangentCount)break;a=max(a,tangentFeather(abs(length(vTangentWorld.xz-tangentPoints[i])+wave),width));}
   a*=.94+.04*sin(y*1.7+vTangentWorld.x*.31);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.863,.855,.799)*(1.0+.007*sin(vTangentWorld.x*.7+y*.31)),clamp(a,0.0,1.0));
  `);
 };
 material.needsUpdate=true;return material;
}
