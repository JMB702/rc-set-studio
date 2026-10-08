import {interpolateCameraShot,normalizeCameraShot} from './camera-state.js';

export function createCameraMotion(api,{requestFrame=requestAnimationFrame,cancelFrame=cancelAnimationFrame,now=()=>performance.now(),reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches}={}) {
  let frame=null,oldDamping=true,done=null;
  const snapshot=()=>normalizeCameraShot({version:1,position:api.camera.position.toArray(),target:api.orbit.target.toArray(),...api.lens.get()});
  function apply(shot){api.camera.position.fromArray(shot.position);api.orbit.target.fromArray(shot.target);api.camera.lookAt(api.orbit.target);api.lens.set({...shot,on:true});api.invalidate();}
  function stop(){if(frame!==null)cancelFrame(frame);frame=null;if(api.cameraAnimating){api.cameraAnimating=false;api.orbit.enableDamping=oldDamping;const callback=done;done=null;callback?.(false);}}
  function freeze(){
    stop();const shot=snapshot(),damping=api.orbit.enableDamping;
    // Drain any leftover orbit gesture without moving the view being saved.
    api.orbit.enableDamping=false;api.orbit.update();apply(shot);api.orbit.enableDamping=damping;
    return shot;
  }
  function move(raw,onDone){
    const to=normalizeCameraShot(raw),from=freeze();oldDamping=api.orbit.enableDamping;api.orbit.enableDamping=false;api.cameraAnimating=true;done=onDone;
    const started=now(),duration=reducedMotion()?0:1000;
    function tick(time){const p=duration?Math.min(1,(time-started)/duration):1;apply(interpolateCameraShot(from,to,p));if(p<1)frame=requestFrame(tick);else{frame=null;api.cameraAnimating=false;api.orbit.enableDamping=oldDamping;const callback=done;done=null;callback?.(true);}}
    tick(started);
  }
  return {snapshot,freeze,move,stop};
}
