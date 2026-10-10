import {projectParseReceipt} from './project-model.js';
const OCR='https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.esm.min.js';
const PDF='https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/build/pdf.min.mjs';
function canvasFor(image,maxEdge=2400){const scale=Math.min(2,maxEdge/Math.max(image.width,image.height)),c=document.createElement('canvas');c.width=Math.round(image.width*scale);c.height=Math.round(image.height*scale);const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(image,0,0,c.width,c.height);return c;}
async function receiptPages(file){
 if(file.size>20*1024*1024)throw Error('Choose a receipt smaller than 20 MB.');
 if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
  const pdfjs=await import(PDF);pdfjs.GlobalWorkerOptions.workerSrc=PDF.replace('pdf.min.mjs','pdf.worker.min.mjs');
  const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
  try{if(pdf.numPages>5)throw Error('Choose a receipt with no more than five pages.');const pages=[];for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),size=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(3,2400/Math.max(size.width,size.height))}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;pages.push(canvas);}return pages;}finally{await pdf.destroy();}
 }
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPG, PNG, WebP or PDF receipt.');
 const bitmap=await createImageBitmap(file);try{return [canvasFor(bitmap)];}finally{bitmap.close();}
}
export async function readProjectReceipt(file,onProgress){
 onProgress('Opening receipt…');const pages=await receiptPages(file);
 const hash=await crypto.subtle.digest('SHA-256',await file.arrayBuffer()),fingerprint=[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');
 const stored=pages.map(c=>{let out=canvasFor(c,1600).toDataURL('image/jpeg',.82);if(out.length>260000)out=canvasFor(c,1200).toDataURL('image/jpeg',.62);return out;});
 if(JSON.stringify(stored).length>1500000)throw Error('Receipt is too large. Try a closer crop or fewer pages.');
 let worker,text='',confidence=0,warning='';
 try{
  const {default:Tesseract}=await import(OCR);
  worker=await Tesseract.createWorker('eng',1,{workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',logger:m=>{if(m.status==='recognizing text')onProgress(`Reading receipt · ${Math.round(m.progress*100)}%`);}});
  await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1',user_defined_dpi:'300'});
  for(let i=0;i<pages.length;i++){
   onProgress(`Reading page ${i+1} of ${pages.length}…`);
   let {data}=await worker.recognize(pages[i],{rotateAuto:true});
   const first=projectParseReceipt(data.text);
   if(data.confidence<80||first.amountCents===null||first.warning){
    const gray=canvasFor(pages[i]),ctx=gray.getContext('2d');ctx.filter='grayscale(1) contrast(1.3)';ctx.drawImage(pages[i],0,0,gray.width,gray.height);
    const retry=await worker.recognize(gray,{rotateAuto:true});
    const second=projectParseReceipt(retry.data.text);
    if(first.amountCents!==null&&second.amountCents!==null&&first.amountCents!==second.amountCents)warning='Two reading passes disagree on the total. Check the receipt before saving.';
    if(retry.data.confidence>data.confidence)data=retry.data;
   }
   text+=data.text+'\n';confidence+=data.confidence/pages.length;
  }
 }catch(e){warning='Automatic reading was unavailable. The receipt is attached; enter its details below.';}
 finally{if(worker)await worker.terminate();}
 const parsed=projectParseReceipt(text);
 return {id:crypto.randomUUID(),filename:file.name,fingerprint,pages:stored,...parsed,text,warning:warning||parsed.warning||(confidence<80?'Some text was unclear. Check the total against the receipt.':'')};
}
