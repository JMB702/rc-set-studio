import * as T from 'three';
import {inch} from './model.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

// Inch-based, static scale figures. Bake each part into one mesh per material;
// no textures, skeletons, animation, or downloaded character assets.
export const figureScenes={podcast:{label:'Podcast',sub:'Seated at a table',commentId:'podcast-reference',commentLabel:'Podcast table and seated figures'},rap:{label:'Rap',sub:'Standing at a mic',commentId:'rap-reference',commentLabel:'Standing figures and hung mic'}};
// Standing height of the shared host (crown of the hair), used for the scale readout.
export const HOST_STANDING_INCHES=68.9;
// One scene of scale figures. `scale` sizes the whole vignette (people and their
// furniture) about its floor centre. `lift` raises it onto a platform deck and
// `depth` is how far forward of the back wall it stands; all in inches.
// `ceiling` is where the hung mic's cable ends, in set inches, regardless of lift or scale.
export function podcastScene({scene='podcast',scale=1,lift=0,depth=48,ceiling=126}={}){
  const outer=new T.Group(),root=new T.Group();outer.add(root);outer.name='Scale figures';root.name=scene==='rap'?'Rap scale reference':'Podcast scale reference';
  const colors={skin:0xd8ab8b,skinDeep:0x5b3a29,hair:0xd4b260,hairLight:0xe7cf8b,locs:0x1f1915,lips:0xaa776c,lipsDeep:0x4a2c22,white:0xe5e2d9,shirtMan:0x486775,shirtWoman:0x80648c,shirtOrange:0xe8641f,pants:0x343c48,leather:0x1b1d1f,black:0x20272a,lens:0x2a1a12,table:0xa67b50,mic:0xc9bfa9,cable:0x161819};
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
  function host(woman,x,angle){
    const base=new T.Matrix4().makeRotationY(angle);base.setPosition(x*inch,0,0);
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
    head(base,{skin:'skin',lips:'lips',hair:woman?'blondeLong':'blonde'});
    for(const side of [-1,1]){
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
  // Head in the seated frame (chin at 38.2″); standing figures pass a raised base.
  function head(base,{skin,lips,hair,shades=false}){
    // Chin, jaw, cheeks, brow and forehead avoid a round mannequin head.
    contour([[38.2,.8,1.2,1],[38.8,1.7,1.8,.7],[39.8,2.5,2.4,.3],
      [41,3,2.8,.1],[42.5,3.15,2.9,0],[44,3,2.7,-.1],[45.4,2.3,2.1,-.2],[46.1,.6,.6,-.2]],skin,base);
    const brow=hair==='locs'?'locs':'hair';
    if(hair==='locs'){
      // Shoulder-length locs fall from a close cap, clear of the face.
      contour([[42.6,3.25,2.95,-.35],[44.3,3.3,2.9,-.3],[45.7,2.6,2.3,-.3],[46.6,.4,.4,-.3]],'locs',base);
      for(let i=0;i<17;i++){
        const a=(-115+i*230/16)*Math.PI/180,side=Math.abs(a)/(Math.PI/180),r=4.4+(i%3)*.35;
        const end=31-((i*7)%5)*.6+Math.max(0,side-60)/55*7;
        rod([Math.sin(a)*3.05,44.6,-Math.cos(a)*2.75-.3],[Math.sin(a)*r,end,-Math.cos(a)*r-.4],.36,'locs',base,.42);
      }
    }else{
      // A fitted blonde cap with a swept fringe, plus shoulder-length hair on her.
      contour([[43.2,3.15,2.8,-.3],[44.5,3.2,2.8,-.3],[45.7,2.5,2.2,-.3],[46.5,.4,.4,-.3]],'hair',base);
      for(let i=0;i<5;i++){
        const x=-2.2+i*.9;
        rod([x,44.1,2.15],[x+.6,45.4,.9],.32,'hairLight',base,.45);
      }
    }
    if(hair==='blondeLong'){
      ball([0,40.5,-2.3],[3.2,5.1,1.2],'hair',base);
      for(const side of [-1,1]){
        rod([side*2.9,43,-.7],[side*3.25,38.6,.2],.95,'hair',base,1.05);
        rod([side*3.25,38.6,.2],[side*2.6,35.8,.7],1.05,'hair',base,.55);
        rod([side*3.45,42.8,.1],[side*3.6,38.4,.5],.2,'hairLight',base,.3);
      }
    }
    // Small nose bridge, nostrils, lips, whites, irises and eyebrows.
    ball([0,41.8,2.9],[.45,1,.45],skin,base);
    ball([0,41.25,3.35],[.55,.42,.5],skin,base);
    ball([0,40.25,2.78],[.75,.15,.14],lips,base);
    ball([0,39.95,2.73],[.65,.12,.12],lips,base);
    for(const side of [-1,1]){
      ball([side*3,41.5,-.1],[.45,.85,.5],skin,base);
      if(shades){
        // Wraparound sunglasses: two dark lenses, a bridge and arms to the ears.
        ball([side*1.3,42.45,2.95],[1.1,.55,.28],'lens',base);
        rod([side*2.35,42.6,2.55],[side*3.05,42.7,.1],.12,'black',base);
      }else{
        ball([side*1.25,42.5,2.68],[.63,.26,.17],'white',base);
        ball([side*1.18,42.5,2.84],[.23,.23,.09],'shirtMan',base);
        ball([side*1.18,42.5,2.92],[.1,.13,.04],'black',base);
      }
      rod([side*.65,43.15,2.68],[side*1.85,43.15,2.5],.12,brow,base);
    }
    if(shades)rod([-.3,42.6,3.15],[.3,42.6,3.15],.12,'black',base);
  }
  // A standing figure, feet on the deck, about 5′9″ to the crown at scale 1.
  const rapGuy={skin:'skin',lips:'lips',hair:'blonde',shirt:'shirtMan',lower:'pants',shorts:false,longSleeves:true,pose:'clasp'};
  const rapper={skin:'skinDeep',lips:'lipsDeep',hair:'locs',shades:true,shirt:'shirtOrange',lower:'leather',shorts:true,longSleeves:false,pose:'mic'};
  function standing(p,x,angle){
    const base=new T.Matrix4().makeRotationY(angle);base.setPosition(x*inch,0,0);
    const mix=(a,b,t)=>a.map((n,i)=>n+(b[i]-n)*t);
    ball([0,35.6,0],[6.1,4.1,3.8],p.lower,base);
    for(const side of [-1,1]){
      const hip=[side*3.6,35,0],knee=[side*3.8,19.5,.8],ankle=[side*3.8,3.6,-.2];
      if(p.shorts){
        // Long, loose shorts finish just below the knee; boots rise over the ankle.
        rod(hip,[side*4.3,16.5,.9],2.85,p.lower,base,2.55);
        ball(knee,[1.95,2,2],p.skin,base);rod(knee,ankle,2,p.skin,base,1.4);
        rod([side*3.8,.6,.4],[side*3.8,7,-.2],2.05,'black',base,1.9);
      }else{
        rod(hip,knee,2.9,p.lower,base,2.4);ball(knee,[2.4,2.4,2.4],p.lower,base);rod(knee,ankle,2.4,p.lower,base,1.9);
      }
      ball([side*3.8,1.6,1.8],[2.1,1.7,4.3],'black',base);
    }
    contour([[34,6.4,4,0],[38,6.1,3.9,0],[43,5.8,3.7,.2],[48,6.8,4,.3],[52.5,7.9,4.1,.1],[56,8.1,3.6,0],[57.8,6,2.8,0],[59,2.2,2,.15]],p.shirt,base);
    rod([0,58.2,.3],[0,61.4,.3],1.45,p.skin,base);
    head(new T.Matrix4().makeTranslation(0,22.4*inch,0).premultiply(base),p);
    for(const side of [-1,1]){
      const shoulder=[side*7,56.3,0];let elbow,wrist,hand;
      if(p.pose==='clasp'){elbow=[side*8.2,45,.5];wrist=[side*3.2,40.5,5.5];hand=[[side*2.2,40.3,6.2],[1.3,1.1,1.6]];}
      else if(side>0){elbow=[side*8.5,47,5];wrist=[side*3.2,57.2,5.2];hand=[[side*2.1,58.6,5],[1.2,1.5,1]];}
      else{elbow=[side*8.6,44.5,-.2];wrist=[side*8.7,34,1];hand=[[side*8.6,31.8,1.2],[1,1.8,1.3]];}
      ball(shoulder,[2.3,2.4,2.4],p.shirt,base);
      if(p.longSleeves){
        rod(shoulder,elbow,2.1,p.shirt,base,1.7);ball(elbow,[1.7,1.7,1.7],p.shirt,base);
        const cuff=mix(elbow,wrist,.85);rod(elbow,cuff,1.65,p.shirt,base,1.3);rod(cuff,wrist,1.1,p.skin,base,.85);
      }else{
        rod(shoulder,mix(shoulder,elbow,.55),2.35,p.shirt,base,2.05);
        rod(shoulder,elbow,1.8,p.skin,base,1.5);ball(elbow,[1.5,1.5,1.5],p.skin,base);rod(elbow,wrist,1.5,p.skin,base,.95);
      }
      ball(...hand,p.skin,base);
      rod([side*1.9,59.1,1.1],[side*2.6,57.9,2.6],.18,p.shirt,base);
    }
  }
  if(scene==='rap'){
    standing(rapGuy,-12,Math.PI/2-.42);standing(rapper,12,-(Math.PI/2-.42));
    // A side-address condenser hangs on its cable between them at mouth height.
    const top=(ceiling-lift)/scale;
    rod([0,top,1],[0,67.5,1],.12,'cable',identity);
    rod([0,67.5,1],[0,66.4,1],.45,'mic',identity,.25);
    rod([0,66.4,1],[0,61.6,1],1.05,'mic',identity);
    ball([0,61.6,1],[1.05,.7,1.05],'mic',identity);
    for(const y of [65.2,62.4])rod([0,y,1],[0,y+.25,1],1.12,'black',identity);
  }else{
    box([0,29.4,0],[48,1.2,30],'table',identity);
    for(const x of [-20,20])for(const z of [-11,11])box([x,14.4,z],[1.5,28.8,1.5],'black',identity);
    host(false,-38,Math.PI/2);host(true,38,-Math.PI/2);
  }
  for(const [color,parts]of bins){const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());const material=new T.MeshStandardMaterial({color:colors[color],roughness:color==='mic'?.35:.88,metalness:color==='mic'?.7:0});const mesh=new T.Mesh(geometry,material);mesh.name=`${root.name} ${color}`;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
  outer.position.set(0,lift*inch,depth*inch);outer.scale.setScalar(scale);
  root.userData.figures={scene,...figureScenes[scene]};
  root.userData.reference=scene==='rap'?{standingHeightApproxInches:[HOST_STANDING_INCHES*scale,HOST_STANDING_INCHES*scale],micHeightInches:64*scale,lift}:{tableInches:[48,30,30].map(n=>n*scale),seatHeightInches:18*scale,standingHeightApproxInches:[70,66].map(n=>n*scale),lift};
  return outer;
}
