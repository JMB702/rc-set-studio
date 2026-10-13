export {normalizeLightingRig} from './camera-state.js';
// Metres in saved data; the editor displays feet and inches. Shared with the Worker.
export function defaultLightingRig(){
  const make=(id,name,position,width,height,power)=>({id,name,type:'diffuse',enabled:true,position,target:[0,1.5,1.5],width,height,power,beam:60,edge:80,roll:0,color:'#fff5e6'});
  return {version:1,lights:[make('key','Key',[-2.1,2.6,3.1],.9144,1.2192,100),make('fill','Fill',[2.2,2.2,3.4],1.2192,1.2192,45),make('rim','Rim',[1.3,2.7,.4],.3048,1.2192,85)]};
}

// Cylindrical controls orbit the subject, not the set origin. Distance is horizontal,
// so rotating or raising a light never changes the other placement controls.
export function subjectCoordinates(point,subject,fallbackRotation=0){
  const x=point[0]-subject[0],z=point[2]-subject[2],distance=Math.hypot(x,z);
  return {rotation:distance<1e-8?fallbackRotation:Math.atan2(x,z)*180/Math.PI,height:point[1]-subject[1],distance};
}
export function subjectPoint({rotation,height,distance},subject){
  const angle=rotation*Math.PI/180;
  return [subject[0]+Math.sin(angle)*distance,subject[1]+height,subject[2]+Math.cos(angle)*distance];
}
