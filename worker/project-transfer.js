// Explicit, temporary deployment-time transfer. No key in source; never available to browser clients.
// PROJECT_TRANSFER_SECRET is JSON {token,expiresAt}, provisioned only for an authorized import.
async function projectTransfer(request,env) {
 const deny=()=>json({error:'Not found.'},404);
 let config;try{config=JSON.parse(env.PROJECT_TRANSFER_SECRET||'null');}catch{return deny();}
 if(!config||typeof config.token!=='string'||config.token.length<64||!Number.isSafeInteger(config.expiresAt)||Date.now()>config.expiresAt)return deny();
 if(request.method!=='POST'||request.headers.get('Authorization')!==`Bearer ${config.token}`)return deny();
 if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'Expected JSON.'},415);
 if(Number(request.headers.get('Content-Length'))>8000000)return json({error:'Transfer is too large.'},413);
 const raw=await request.text();if(raw.length>8000000)return json({error:'Transfer is too large.'},413);
 let input;try{input=JSON.parse(raw);
  if(input.version!==1||!Array.isArray(input.documents)||input.documents.length!==2||new Set(input.documents.map(d=>d.id)).size!==2||!Array.isArray(input.receipts)||input.receipts.length>100)throw Error('Invalid transfer.');
  for(const d of input.documents){if(!['finance','tracking'].includes(d.id)||typeof d.content!=='string'||!Number.isSafeInteger(d.revision)||d.revision<0||!Number.isSafeInteger(d.updated_at))throw Error('Invalid document.');projectValidate(d.id,JSON.parse(d.content));}
  if(input.access?.id!=='main'||!/^[a-f0-9-]{36}$/i.test(input.access.salt)||!/^[a-f0-9]{64}$/i.test(input.access.hash))throw Error('Invalid PIN record.');
  for(const r of input.receipts){if(!/^[\w-]{1,80}$/.test(r.id)||!/^[a-f0-9]{64}$/.test(r.fingerprint)||typeof r.filename!=='string'||r.filename.length>200||typeof r.pages!=='string'||r.pages.length>1500000||!Number.isSafeInteger(r.created_at))throw Error('Invalid receipt.');const pages=JSON.parse(r.pages);if(!Array.isArray(pages)||!pages.length||pages.length>5||pages.some(p=>!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p)))throw Error('Invalid receipt image.');}
  const receipts=new Set(input.receipts.map(r=>r.id));for(const e of JSON.parse(input.documents.find(d=>d.id==='finance').content).expenses)if(e.receiptId&&!receipts.has(e.receiptId))throw Error('Missing receipt.');
 }catch(e){return json({error:e.message},400);}
 const db=env.DB,digest=await projectDigest(JSON.stringify(input));
 const prior=await db.prepare('SELECT content FROM project_documents WHERE id=?').bind('transfer-receipt').first();
 if(prior)return prior.content===digest?json({imported:true,digest,retry:true}):json({error:'A different project has already been imported.'},409);
 const occupied=await db.prepare('SELECT id FROM project_documents LIMIT 1').first(),access=await db.prepare('SELECT id FROM project_access LIMIT 1').first(),receipt=await db.prepare('SELECT id FROM project_receipts LIMIT 1').first();
 if(occupied||access||receipt)return json({error:'Destination contains project data; nothing was overwritten.'},409);
 const statements=[db.prepare('INSERT INTO project_documents (id,content,revision,updated_at) VALUES (?,?,?,?)').bind('transfer-receipt',digest,0,Date.now()),db.prepare('INSERT INTO project_access (id,salt,hash) VALUES (?,?,?)').bind('main',input.access.salt,input.access.hash)];
 for(const d of input.documents)statements.push(db.prepare('INSERT INTO project_documents (id,content,revision,updated_at) VALUES (?,?,?,?)').bind(d.id,d.content,d.revision,d.updated_at));
 for(const r of input.receipts)statements.push(db.prepare('INSERT INTO project_receipts (id,fingerprint,filename,pages,created_at) VALUES (?,?,?,?,?)').bind(r.id,r.fingerprint,r.filename,r.pages,r.created_at));
 // D1 batch is transactional. A collision rolls back the entire transfer.
 await db.batch(statements);
 return json({imported:true,digest,documents:input.documents.length,receipts:input.receipts.length});
}
