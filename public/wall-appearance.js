// Deterministic, geometry-aligned appearance. Inches refer to the real 4 x 8 sheets.
export function sheetVariation(panel,upper=false){
 const seed=panel*7+(upper?103:3),hash=n=>{const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x);};
 return {offsetX:hash(seed),offsetY:hash(seed+1),tone:(hash(seed+2)-.5)*.10,warmth:(hash(seed+3)-.5)*.025};
}
export function wallSeamCoverage(x,y,height,panel){
 const feather=(distance,width)=>{const t=Math.max(0,Math.min(1,1-distance/width));return t*t*(3-2*t);};
 const waviness=.28*Math.sin(y*.31)+.14*Math.sin(y*1.13),width=4.4+.3*Math.sin(y*.21);
 // Slots 4 and 7 are the free outer wing ends. The other wall ends meet a corner.
 const left=panel===4?0:feather(Math.abs(x+waviness),width),right=panel===7?0:feather(Math.abs(48-x-waviness),width);
 const horizontal=height>96?feather(Math.abs(y-96+.22*Math.sin(x*.45)),4.6):0;
 const trowel=.94+.04*Math.sin(y*1.7+x*.31);
 return Math.min(1,Math.max(left,right,horizontal)*trowel);
}
// Fastener fills, matched to Jeff's photos of the first plaster coat (Oct 19, 2026): one knife swipe of compound
// over each pair of neighboring staples (they are 4″ apart), crisp-edged rather than feathered, about 3½–5″ wide and
// 2–3″ tall, so a 4′ panel's toggle shows about six dabs. Some swipes catch one staple, some run into the next pair
// and a few are missed. Seeded, so every render matches.
export function fillHash(n){const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x);}
// One patch: a wobbly rounded rectangle (half-sizes hw × hh) with a one-pixel-soft edge and slightly uneven cover.
export function fillPatch(dx,dy,hw,hh,seed){
 const ang=Math.atan2(dy,dx),r=Math.cbrt(Math.abs(dx/hw)**3+Math.abs(dy/hh)**3)*(1+.12*Math.sin(ang*3+fillHash(seed+.9)*6.2832)+.06*Math.sin(ang*7+fillHash(seed+.45)*6.2832));
 const t=Math.max(0,Math.min(1,(r-.82)/.18));return (1-t*t*(3-2*t))*(.88+.12*fillHash(seed*3.1+.7));
}
// along/across are measured from the midpoint between a pair of staples.
function swipeFill(along,across,seed,vertical){
 const h=i=>fillHash(seed+i*.137);if(h(0)<.08)return 0;
 const one=h(4)<.2,long=h(4)>.85,hw=one?1.2+h(3)*.4:2.0+h(3)*.6+(long?3:0),hh=1.0+h(5)*.5;
 const da=along-(h(1)-.5)*.8-(one?(h(6)<.5?-2:2):long?(h(6)<.5?-4:4):0),dc=across-(h(2)-.5)*.5;
 return vertical?fillPatch(dc,da,hh,hw,seed):fillPatch(da,dc,hw,hh,seed);
}
// The skin staples model.js draws: every 4″ along the rails, toggles and 10′ seam backer, and up both stiles.
export function wallStapleRows(height){return [.375,24,48,72,height-.375,...(height>96?[95,97]:[])];}
export function wallFastenerFill(x,y,height,panel){
 let a=0;const rows=wallStapleRows(height);
 // Staple pairs along a row sit at 2″+6″, 10″+14″ … 42″+46″: swipe centers 4″, 12″ … 44″.
 for(let r=0;r<rows.length;r++){if(Math.abs(y-rows[r])>2.5)continue;const k0=Math.round((x-4)/8);
  for(let k=Math.max(0,k0-1);k<=Math.min(5,k0+1);k++)a=Math.max(a,swipeFill(x-4-8*k,y-rows[r],panel*97+r*13+k,false));}
 // Stile staples sit under the seam bands except at the free wing ends (slots 4 and 7), where they show as a column.
 for(const [free,sx] of [[panel===4,.375],[panel===7,47.625]]){if(!free||Math.abs(x-sx)>2.5)continue;const k0=Math.round((y-4)/8);
  for(let k=Math.max(0,k0-1);k<=k0+1&&4+8*k<height;k++)a=Math.max(a,swipeFill(y-4-8*k,x-sx,panel*97+500+k,true));}
 return a;
}
export function makeWallAtlas(image,{height=120,seams=false,tile=256}={}){
 const canvas=document.createElement('canvas');canvas.width=tile*8;canvas.height=tile*2.5;const ctx=canvas.getContext('2d');
 const swatch=document.createElement('canvas');swatch.width=tile;swatch.height=tile*2;const wood=swatch.getContext('2d');wood.drawImage(image,0,0,tile,tile*2);
 // Warm and slightly darken only the veneer; filler is composited afterward and stays off-white.
 wood.globalCompositeOperation='multiply';wood.fillStyle='#f5edd6';wood.fillRect(0,0,tile,tile*2);
 for(let panel=0;panel<8;panel++)for(const upper of [false,true]){
  const v=sheetVariation(panel,upper),top=upper?0:tile*.5,h=upper?tile*.5:tile*2;
  ctx.save();ctx.beginPath();ctx.rect(panel*tile,top,tile,h);ctx.clip();
  const ox=Math.round(v.offsetX*tile),oy=upper?Math.round(v.offsetY*tile*1.5):0;
  for(let ix=-1;ix<=1;ix++)for(let iy=-1;iy<=2;iy++)ctx.drawImage(swatch,panel*tile-ox+ix*tile,top-oy+iy*tile*2);
  ctx.globalAlpha=Math.abs(v.tone);ctx.fillStyle=v.tone>0?'#fffdf5':'#766959';ctx.fillRect(panel*tile,top,tile,h);
  ctx.globalAlpha=Math.abs(v.warmth);ctx.fillStyle=v.warmth>0?'#ad8656':'#879697';ctx.fillRect(panel*tile,top,tile,h);ctx.restore();
 }
 if(seams){
  const data=ctx.getImageData(0,0,canvas.width,canvas.height),p=data.data;
  for(let iy=0;iy<canvas.height;iy++){const y=120*(1-(iy+.5)/canvas.height);for(let ix=0;ix<canvas.width;ix++){
   const panel=Math.floor(ix/tile),x=((ix%tile)+.5)*48/tile,a=Math.max(wallSeamCoverage(x,y,height,panel),wallFastenerFill(x,y,height,panel));if(a<=0)continue;
   const k=(iy*canvas.width+ix)*4,shade=1.8*Math.sin(ix*.7+iy*.31);
   for(let c=0;c<3;c++)p[k+c]=p[k+c]*(1-a)+([239,238,231][c]+shade)*a;
  }}ctx.putImageData(data,0,0);
 }
 return canvas;
}
