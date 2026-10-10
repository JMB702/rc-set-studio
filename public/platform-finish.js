// Use physical module joints rather than a painted-on grid that drifts when the layout changes.
export function applyPlatformSeamTexture(material,part,texture){
 const edges=new Float32Array(32);edges.set((part.seamEdges||[]).slice(0,8).flat());
 material.customProgramCacheKey=()=> 'platform-seam-compound-v1';
 material.onBeforeCompile=shader=>{
  shader.uniforms.platformSeamMap={value:texture};shader.uniforms.platformSeamEdges={value:edges};shader.uniforms.platformSeamCount={value:Math.min(8,(part.seamEdges||[]).length)};
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vPlatformLocal;\nvarying float vPlatformTop;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPlatformLocal = position / 0.0254;\nvPlatformTop = abs(normal.y);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vPlatformLocal; varying float vPlatformTop;
   uniform sampler2D platformSeamMap; uniform vec4 platformSeamEdges[8]; uniform int platformSeamCount;
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
   diffuseColor.rgb=mix(diffuseColor.rgb,pow(compoundSample,vec3(2.2)),feather);
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
