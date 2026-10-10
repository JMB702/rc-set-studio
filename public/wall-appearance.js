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
export function makeWallAtlas(image,{height=120,seams=false,tile=256}={}){
 const canvas=document.createElement('canvas');canvas.width=tile*8;canvas.height=tile*2.5;const ctx=canvas.getContext('2d');
 const swatch=document.createElement('canvas');swatch.width=tile;swatch.height=tile*2;swatch.getContext('2d').drawImage(image,0,0,tile,tile*2);
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
   const panel=Math.floor(ix/tile),x=((ix%tile)+.5)*48/tile,a=wallSeamCoverage(x,y,height,panel);if(a<=0)continue;
   const k=(iy*canvas.width+ix)*4,shade=1.8*Math.sin(ix*.7+iy*.31);
   for(let c=0;c<3;c++)p[k+c]=p[k+c]*(1-a)+([239,238,231][c]+shade)*a;
  }}ctx.putImageData(data,0,0);
 }
 return canvas;
}
