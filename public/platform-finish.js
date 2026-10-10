import * as THREE from 'three';
// Use physical module joints rather than a painted-on grid that drifts when the layout changes.
export function applyPlatformSeamTexture(material,part,texture){
 const edges=(part.seamEdges||[]).slice(0,8).map(e=>new THREE.Vector4(...e));while(edges.length<8)edges.push(new THREE.Vector4());
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
   if(vPlatformTop<0.5)jointDistance=min(jointDistance,min(abs(vPlatformLocal.y-10.0),abs(vPlatformLocal.y)));
   vec2 compoundUV=vPlatformTop>0.5?platformPoint/24.0:vec2(vPlatformLocal.x-vPlatformLocal.z,vPlatformLocal.y)/24.0;
   vec3 compoundSample=mix(texture2D(platformSeamMap,compoundUV).rgb,vec3(0.88),0.45);
   float feather=1.0-smoothstep(1.4,3.8+(compoundSample.r-0.5)*0.7,jointDistance);
   diffuseColor.rgb=mix(diffuseColor.rgb,pow(compoundSample,vec3(2.2)),feather);
  `);
 };
 material.needsUpdate=true;return material;
}
