import * as T from 'three';
import {inch} from './model.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

// Inch-based, static scale figures. Bake each part into one mesh per material;
// no textures, skeletons, animation, or downloaded character assets.
export function podcastScene(){
  const root=new T.Group();root.name='Podcast scale reference';
  const colors={skin:0xd8ab8b,hair:0xd4b260,hairLight:0xe7cf8b,lips:0xaa776c,white:0xe5e2d9,shirtMan:0x486775,shirtWoman:0x80648c,pants:0x343c48,black:0x20272a,table:0xa67b50};
  const bins=new Map();
  const v=p=>new T.Vector3(...p).multiplyScalar(inch);
  function add(g,color,matrix=new T.Matrix4()){
    g.deleteAttribute('uv');g.applyMatrix4(matrix);const geo=g.index?g.toNonIndexed():g.clone();g.dispose();
    if(!bins.has(color))bins.set(color,[]);bins.get(color).push(geo);
  }
  function transform(p,scale,base){return new T.Matrix4().compose(v(p),new T.Quaternion(),new T.Vector3(...scale)).premultiply(base);}
  function ball(p,size,color,base){add(new T.SphereGeometry(inch,12,8),color,transform(p,size,base));}
  function box(p,size,color,base){add(new T.BoxGeometry(...size.map(n=>n*inch)),color,transform(p,[1,1,1],base));}
  function rod(a,b,r,color,base,r2=r){const A=v(a),B=v(b),direction=B.clone().sub(A);const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.clone().normalize());add(new T.CylinderGeometry(r2*inch,r*inch,direction.length(),8),color,new T.Matrix4().compose(A.add(B).multiplyScalar(.5),q,new T.Vector3(1,1,1)).premultiply(base));}
  // Contoured rings form continuous tailored torsos and anatomical heads.
  // Each ring is [height, half-width, half-depth, forward offset].
  function contour(rings,color,base,segments=16){
    const positions=[],indices=[];
    for(const [y,rx,rz,z]of rings)for(let i=0;i<segments;i++){
      const a=i/segments*Math.PI*2;positions.push(Math.sin(a)*rx*inch,y*inch,(Math.cos(a)*rz+z)*inch);
    }
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){
      const a=j*segments+i,b=j*segments+(i+1)%segments,c=a+segments,d=b+segments;
      indices.push(a,b,c,b,d,c);
    }
    for(let i=1;i<segments-1;i++){indices.push(0,i+1,i);const t=(rings.length-1)*segments;indices.push(t,t+i,t+i+1);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();add(g,color,base);
  }
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
    const shoulderWidth=woman?6.5:7.5;
    contour([[21,5.7,3.5,0],[23,5.5,3.5,0],[27, woman?4.8:6,3.2,.2],
      [31, woman?5.9:7,3.7,.25],[34,shoulderWidth,3.5,0],[35.8,5.8,2.7,0],[37,2,1.8,.15]],shirt,base);
    rod([0,36,.3],[0,39,.3],1.4,'skin',base);
    // Chin, jaw, cheeks, brow and forehead avoid a round mannequin head.
    contour([[38.2,.8,1.2,1],[38.8,1.7,1.8,.7],[39.8,2.5,2.4,.3],
      [41,3,2.8,.1],[42.5,3.15,2.9,0],[44,3,2.7,-.1],[45.4,2.3,2.1,-.2],[46.1,.6,.6,-.2]],'skin',base);
    // A fitted blonde cap with a swept fringe, plus shoulder-length hair on her.
    contour([[43.2,3.15,2.8,-.3],[44.5,3.2,2.8,-.3],[45.7,2.5,2.2,-.3],[46.5,.4,.4,-.3]],'hair',base);
    for(let i=0;i<5;i++){
      const x=-2.2+i*.9;
      rod([x,44.1,2.15],[x+.6,45.4,.9],.32,'hairLight',base,.45);
    }
    if(woman){
      ball([0,40.5,-2.3],[3.2,5.1,1.2],'hair',base);
      for(const side of [-1,1]){
        rod([side*2.9,43,-.7],[side*3.25,38.6,.2],.95,'hair',base,1.05);
        rod([side*3.25,38.6,.2],[side*2.6,35.8,.7],1.05,'hair',base,.55);
        rod([side*3.45,42.8,.1],[side*3.6,38.4,.5],.2,'hairLight',base,.3);
      }
    }
    // Small nose bridge, nostrils, lips, whites, irises and eyebrows.
    ball([0,41.8,2.9],[.45,1,.45],'skin',base);
    ball([0,41.25,3.35],[.55,.42,.5],'skin',base);
    ball([0,40.25,2.78],[.75,.15,.14],'lips',base);
    ball([0,39.95,2.73],[.65,.12,.12],'lips',base);
    for(const side of [-1,1]){
      ball([side*3,41.5,-.1],[.45,.85,.5],'skin',base);
      ball([side*1.25,42.5,2.68],[.63,.26,.17],'white',base);
      ball([side*1.18,42.5,2.84],[.23,.23,.09],'shirtMan',base);
      ball([side*1.18,42.5,2.92],[.1,.13,.04],'black',base);
      rod([side*.65,43.15,2.68],[side*1.85,43.15,2.5],.12,'hair',base);
      const shoulder=[side*(shoulderWidth-1),34,.1],elbow=[side*7.4,27.8,5.5],wrist=[side*5.8,30.7,15];
      ball(shoulder,[2.2,2.3,2.3],shirt,base);
      rod(shoulder,elbow,2.1,shirt,base,1.65);
      ball(elbow,[1.65,1.65,1.65],shirt,base);
      rod(elbow,[side*6.6,29.4,10.5],1.65,shirt,base,1.3);
      rod([side*6.6,29.4,10.5],wrist,1.25,'skin',base,.85);
      ball([side*5.8,30.75,16],[1.05,.55,1.5],'skin',base);
      for(let finger=0;finger<4;finger++)rod([side*5.8+(finger-1.5)*.44,30.7,16.4],[side*5.8+(finger-1.5)*.44,30.55,18-(Math.abs(finger-1.5)*.2)],.19,'skin',base,.14);
      rod([side*6.5,30.6,15.7],[side*7,30.6,16.6],.28,'skin',base,.2);
    }
    // Shirt seams and a collar give clothing a clear silhouette.
    for(const side of [-1,1])rod([side*1.9,36.7,1.1],[side*2.6,35.5,2.6],.18,shirt,base);
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
