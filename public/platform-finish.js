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
