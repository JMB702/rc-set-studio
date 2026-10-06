import * as T from 'three';
import {inch} from './model.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

// Inch-based, static scale figures. Bake each part into one mesh per material;
// no textures, skeletons, animation, or downloaded character assets.
export function podcastScene(){
  const root=new T.Group();root.name='Podcast scale reference';
  const colors={skin:0xc58e6f,hair:0x322723,shirtMan:0x637c81,shirtWoman:0x80648c,pants:0x343c48,black:0x20272a,table:0xa67b50};
  const bins=new Map();
  const v=p=>new T.Vector3(...p).multiplyScalar(inch);
  function add(g,color,matrix=new T.Matrix4()){
    g.applyMatrix4(matrix);const geo=g.index?g.toNonIndexed():g.clone();g.dispose();
    if(!bins.has(color))bins.set(color,[]);bins.get(color).push(geo);
  }
  function transform(p,scale,base){return new T.Matrix4().compose(v(p),new T.Quaternion(),new T.Vector3(...scale)).premultiply(base);}
  function ball(p,size,color,base){add(new T.SphereGeometry(inch,10,8),color,transform(p,size,base));}
  function box(p,size,color,base){add(new T.BoxGeometry(...size.map(n=>n*inch)),color,transform(p,[1,1,1],base));}
  function rod(a,b,r,color,base,r2=r){const A=v(a),B=v(b),direction=B.clone().sub(A);const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.clone().normalize());add(new T.CylinderGeometry(r2*inch,r*inch,direction.length(),8),color,new T.Matrix4().compose(A.add(B).multiplyScalar(.5),q,new T.Vector3(1,1,1)).premultiply(base));}
  const identity=new T.Matrix4();
  box([0,29.4,48],[48,1.2,30],'table',identity);
  for(const x of [-20,20])for(const z of [37,59])box([x,14.4,z],[1.5,28.8,1.5],'black',identity);
  function host(woman,x,angle){
    const base=new T.Matrix4().makeRotationY(angle);base.setPosition(x*inch,0,48*inch);
    const shirt=woman?'shirtWoman':'shirtMan';
    // 18-inch chair seat, feet on the floor, relaxed bent knees and elbows.
    box([0,17.5,-1],[18,1.5,18],'black',base);
    box([0,27,-9],[18,18,1.5],'black',base);
    for(const a of [-7,7])for(const b of [-7,6])rod([a,.5,b],[a,17,b],.65,'black',base);
    ball([0,21,0],[6.5,3.8,4.8],'pants',base);
    for(const side of [-1,1]){
      const hip=[side*3.4,21,1],knee=[side*3.5,19,13],ankle=[side*3.5,3.2,14];
      rod(hip,knee,2.6,'pants',base,2.3);ball(knee,[2.3,2.3,2.3],'pants',base);rod(knee,ankle,2.3,'pants',base,1.5);
      ball([side*3.5,1.8,16],[2.1,1.8,4],'black',base);
    }
    ball([0,29,0],[woman?6.3:7,8.6,4.1],shirt,base);
    rod([0,35.5,.3],[0,38.5,.3],1.6,'skin',base);
    const headY=42;
    ball([0,headY,.4],[3.4,4.5,3.25],'skin',base);
    ball([0,43.8,-.5],[3.5,3.2,3],'hair',base);
    if(woman){ball([0,40.5,-2.4],[3.7,5.6,1.7],'hair',base);for(const side of [-1,1])ball([side*3,40.4,-.5],[1.1,4.4,1.8],'hair',base);}
    ball([0,41.8,3.5],[.65,.9,.8],'skin',base);
    for(const side of [-1,1]){
      ball([side*3.3,41.6,.2],[.7,1,.65],'skin',base);
      ball([side*1.15,42.6,3.25],[.2,.2,.12],'black',base);
      const shoulder=[side*5.6,34,.3],elbow=[side*7.4,27.6,5.5],wrist=[side*5.8,31,15];
      ball(shoulder,[2.7,2.7,2.7],shirt,base);rod(shoulder,elbow,2.5,shirt,base,1.9);
      ball(elbow,[1.9,1.9,1.9],'skin',base);rod(elbow,wrist,1.7,'skin',base,1.1);ball([side*5.8,31,16],[1.4,.85,2],'skin',base);
    }
    // Each clamp sits on the tabletop; a two-link boom reaches mouth height.
    box([-10,29.4,19],[2,2.6,2.2],'black',base);
    rod([-10,30,19],[-10,44,21],.35,'black',base);
    rod([-10,44,21],[-4,41.3,15],.35,'black',base);
    for(const p of [[-10,44,21],[-4,41.3,15]])ball(p,[.7,.7,.7],'black',base);
    rod([-4,41.3,15],[-1,40.7,11.5],1.15,'black',base);
    ball([-1,40.7,11.5],[1.2,1.2,1.2],'black',base);
  }
  host(false,-38,Math.PI/2);host(true,38,-Math.PI/2);
  for(const [color,parts]of bins){const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());const material=new T.MeshStandardMaterial({color:colors[color],roughness:.88});const mesh=new T.Mesh(geometry,material);mesh.name=`Podcast ${color}`;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
  root.userData.reference={tableInches:[48,30,30],seatHeightInches:18,standingHeightApproxInches:[70,66]};
  return root;
}
