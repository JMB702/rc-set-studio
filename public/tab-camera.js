// Each tab keeps its own camera: leaving a tab saves the shot, returning restores it untouched.
// A tab only frames itself the first time it is opened.
export function installTabCamera(api){
 const shots=new Map();
 function capture(){return {position:api.camera.position.toArray(),target:api.orbit.target.toArray(),minDistance:api.orbit.minDistance,maxDistance:api.orbit.maxDistance,far:api.camera.far,lensOn:api.lens.get().on};}
 function restore(shot){
  api.lens.set({on:shot.lensOn});
  const damping=api.orbit.enableDamping;api.orbit.enableDamping=false;
  api.orbit.minDistance=shot.minDistance;api.orbit.maxDistance=shot.maxDistance;api.camera.far=shot.far;api.camera.updateProjectionMatrix();
  api.camera.position.fromArray(shot.position);api.orbit.target.fromArray(shot.target);api.camera.lookAt(api.orbit.target);api.orbit.update();
  api.orbit.enableDamping=damping;api.invalidate();
 }
 api.hasTabCamera=mode=>shots.has(mode);
 const baseMode=api.setMode;
 api.setMode=m=>{
  const from=api.state.mode;if(m===from)return baseMode(m);
  shots.set(from,capture());
  const shot=shots.get(m),result=baseMode(m);
  if(shot)restore(shot);
  return result;
 };
}
