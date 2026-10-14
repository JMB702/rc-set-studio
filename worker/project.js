// Inlined by build.mjs together with project-model.js. Finance is protected at every API boundary.
async function projectDigest(value) {return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function projectPinHash(pin,salt) {const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);return [...new Uint8Array(bits)].map(v=>v.toString(16).padStart(2,'0')).join('');}
// Until a build design is saved, every device reads progress through the newest approved design (the site default),
// never its own locally explored design. Returned with the record; it is stored the next time tracking is saved.
async function projectApprovedDesign(db){try{const r=await db.prepare('SELECT design FROM design_approvals ORDER BY created_at DESC, id DESC LIMIT 1').first();if(!r)return null;const d=JSON.parse(r.design);return projectBuildDesign({seamlessCorners:d.seamlessCorners,seamlessCornerSide:d.seamlessCornerSide,seamlessPerimeter:d.seamlessPerimeter,height:d.height,angle:Math.round(d.angle),floor:d.floor,platformShape:d.platformShape,platformAngle:Math.round(d.platformAngle),platformBack:d.platformBack,platformSide:d.platformSide,wallColor:d.wallColor,platformColor:d.platformColor,floorColor:d.floorColor});}catch{return null;}}
async function projectAPI(request,env) {
 const url=new URL(request.url),path=url.pathname.slice('/api/project/'.length),db=env.DB,now=Date.now();
 if(!db)return json({error:'Project storage is unavailable.'},503);
 try {
  if(path==='transfer')return await projectTransfer(request,env);
  if(env.PROJECT_TRANSFER_SECRET&&!await db.prepare('SELECT id FROM project_documents WHERE id=?').bind('transfer-receipt').first())return json({error:'Project transfer is in progress. Please try again shortly.'},503);
  if(!['GET','POST','PUT'].includes(request.method))return json({error:'Method not allowed.'},405);
  if(request.method!=='GET'&&(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site'))return json({error:'Please save from this site.'},403);
  const token=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)rc_project_session=([a-f0-9-]+)/)?.[1];
  const sessionId=token?await projectDigest(token):null;
  const session=sessionId?await db.prepare('SELECT expires_at FROM project_sessions WHERE id=? AND expires_at>?').bind(sessionId,now).first():null;
  const cookie=value=>`rc_project_session=${value}; Path=/api/project; HttpOnly; SameSite=Strict; Max-Age=${value?43200:0}${url.protocol==='https:'?'; Secure':''}`;
  if(path==='access'&&request.method==='GET'){const access=await db.prepare('SELECT id FROM project_access WHERE id=?').bind('main').first();return json({configured:!!access,unlocked:!!session});}
  let input;
  if(request.method!=='GET'){
   if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'Expected JSON.'},415);
   const max=path==='receipts'?1600000:900000;
   if(Number(request.headers.get('Content-Length'))>max)return json({error:'This record is too large.'},413);
   const raw=await request.text();if(raw.length>max)return json({error:'This record is too large.'},413);
   try{input=JSON.parse(raw);}catch{return json({error:'Invalid JSON.'},400);}
  }
  if(path==='access'&&request.method==='POST'){
   if(input?.action==='lock'){if(sessionId)await db.prepare('DELETE FROM project_sessions WHERE id=?').bind(sessionId).run();return json({unlocked:false},200,{'Set-Cookie':cookie('')});}
   if(!/^\d{4}$/.test(input?.pin||''))return json({error:'Enter a four-digit PIN.'},400);
   let access=await db.prepare('SELECT * FROM project_access WHERE id=?').bind('main').first();
   if(input.action==='setup'){
    if(access)return json({error:'A PIN already exists. Unlock with the existing PIN.'},409);
    const salt=crypto.randomUUID(),hash=await projectPinHash(input.pin,salt);
    const inserted=await db.prepare('INSERT INTO project_access (id,salt,hash) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING').bind('main',salt,hash).run();
    if(inserted.meta.changes!==1)return json({error:'A PIN was just created elsewhere. Use that PIN.'},409);
   }else if(input.action==='unlock'){
    if(!access)return json({error:'Create the project PIN first.'},409);
    if(access.locked_until>now)return json({error:'Too many attempts. Try again in 15 minutes.'},429);
    if(access.locked_until&&access.locked_until<=now)await db.prepare('UPDATE project_access SET failures=0,locked_until=0 WHERE id=? AND locked_until>0 AND locked_until<=?').bind('main',now).run();
    // Reserve attempts before hashing; concurrent requests cannot bypass the five-attempt limit.
    const reserved=await db.prepare('UPDATE project_access SET failures=failures+1,locked_until=CASE WHEN failures>=4 THEN ? ELSE locked_until END WHERE id=? AND failures<5').bind(now+15*60000,'main').run();
    if(reserved.meta.changes!==1)return json({error:'Too many attempts. Try again in 15 minutes.'},429);
    if(await projectPinHash(input.pin,access.salt)!==access.hash)return json({error:'Incorrect PIN.'},401);
    await db.prepare('UPDATE project_access SET failures=0,locked_until=0 WHERE id=?').bind('main').run();
   }else return json({error:'Unknown access action.'},400);
   const nextToken=crypto.randomUUID()+crypto.randomUUID();
   await db.prepare('DELETE FROM project_sessions WHERE expires_at<=?').bind(now).run();
   await db.prepare('INSERT INTO project_sessions (id,expires_at) VALUES (?,?)').bind(await projectDigest(nextToken),now+43200000).run();
   return json({unlocked:true},200,{'Set-Cookie':cookie(nextToken)});
  }
  // Agent reads never initialize or migrate documents. Finance remains behind the same session gate.
  if(path==='agent-context'&&request.method==='GET'){
   const includeFinance=url.searchParams.get('finance')==='1';
   if(includeFinance&&!session)return json({error:'Unlock Cost projection first.'},401);
   const tracking=await db.prepare('SELECT * FROM project_documents WHERE id=?').bind('tracking').first();
   const approvals=await db.prepare('SELECT * FROM design_approvals ORDER BY created_at DESC, id DESC LIMIT 50').all();
   const configurations=await db.prepare('SELECT * FROM pricing_configurations ORDER BY created_at DESC,id DESC LIMIT 100').all();
   const record=r=>r?{data:JSON.parse(r.content),revision:r.revision,updatedAt:r.updated_at}:null;
   const result={version:1,engineRevision:typeof AGENT_ENGINE_REVISION==='string'?AGENT_ENGINE_REVISION:null,readAt:now,tracking:record(tracking),approvals:approvals.results.map(r=>({id:r.id,name:r.name,design:JSON.parse(r.design),revision:r.revision??0,createdAt:r.created_at})),configurations:configurations.results.map(r=>({id:r.id,name:r.name,configuration:JSON.parse(r.configuration),createdAt:r.created_at})),finance:null,receipts:null,financeIncluded:includeFinance};
   if(includeFinance){result.finance=record(await db.prepare('SELECT * FROM project_documents WHERE id=?').bind('finance').first());const receipts=await db.prepare('SELECT id,filename,created_at FROM project_receipts ORDER BY created_at DESC').all();result.receipts=receipts.results.map(r=>({id:r.id,filename:r.filename,createdAt:r.created_at}));}
   return json(result);
  }
  if(path!=='tracking'&&!session)return json({error:'Unlock project burn-down with your PIN.'},401);
  if(path==='receipts'&&request.method==='POST'){
   if(!/^[\w-]{1,80}$/.test(input?.id)||!/^([a-f0-9]{64})$/.test(input.fingerprint)||typeof input.filename!=='string'||input.filename.length>200||!Array.isArray(input.pages)||!input.pages.length||input.pages.length>5||input.pages.some(p=>typeof p!=='string'||p.length>1000000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p)))return json({error:'Upload a receipt image or PDF, up to five pages.'},400);
   const sameId=await db.prepare('SELECT fingerprint FROM project_receipts WHERE id=?').bind(input.id).first();
   if(sameId&&sameId.fingerprint!==input.fingerprint)return json({error:'This receipt ID is already in use.'},409);
   const existing=await db.prepare('SELECT id FROM project_receipts WHERE fingerprint=?').bind(input.fingerprint).first();
   if(existing)return json({id:existing.id,duplicate:true});
   await db.prepare('INSERT INTO project_receipts (id,fingerprint,filename,pages,created_at) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING').bind(input.id,input.fingerprint,input.filename,JSON.stringify(input.pages),now).run();
   const stored=await db.prepare('SELECT id FROM project_receipts WHERE fingerprint=?').bind(input.fingerprint).first();
   return json({id:stored.id,duplicate:stored.id!==input.id},201);
  }
  if(path.startsWith('receipts/')&&request.method==='GET'){
   const r=await db.prepare('SELECT * FROM project_receipts WHERE id=?').bind(path.slice(9)).first();
   return r?json({id:r.id,filename:r.filename,pages:JSON.parse(r.pages)}):json({error:'Receipt not found.'},404);
  }
  if(!['finance','tracking'].includes(path))return json({error:'Not found.'},404);
  // Release diagnostics must not initialize or upgrade saved project progress.
  if(path==='tracking'&&request.method==='GET'&&url.searchParams.get('readOnly')==='1'){
   const stored=await db.prepare('SELECT * FROM project_documents WHERE id=?').bind(path).first();
   return json({data:stored?JSON.parse(stored.content):null,revision:stored?.revision??null});
  }
  const initial=path==='finance'?projectDefaultFinance():projectDefaultTracking();
  // Read first: initializing on every load forced a primary write before each GET and poll.
  let row=await db.prepare('SELECT * FROM project_documents WHERE id=?').bind(path).first();
  if(!row){await db.prepare('INSERT INTO project_documents (id,content,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING').bind(path,JSON.stringify(initial),now).run();row=await db.prepare('SELECT * FROM project_documents WHERE id=?').bind(path).first();}
  if(path==='tracking'&&request.method==='GET'){
   const current=JSON.parse(row.content),upgraded=projectUpgradeTracking(current);
   if(upgraded!==current){
    await db.prepare('UPDATE project_documents SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(upgraded),now,path,row.revision).run();
    row=await db.prepare('SELECT * FROM project_documents WHERE id=?').bind(path).first();
   }
  }
  if(request.method==='GET'){const data=JSON.parse(row.content);if(path==='tracking'&&!data.design)data.design=await projectApprovedDesign(db);return json({data,revision:row.revision});}
  if(request.method!=='PUT')return json({error:'Method not allowed.'},405);
  if(!Number.isSafeInteger(input?.revision)||input.revision<0)return json({error:'Invalid revision.'},400);
  // Older clients omit new design keys. Preserve those options, including an inherited approval; explicit false is authoritative.
  let content;try{if(path==='tracking'&&input.data){const previous=JSON.parse(row.content);for(const key of ['assembly','guideChecks','floorAssemblyVersion','design'])if(!Object.hasOwn(input.data,key))input.data[key]=previous[key];if(input.data.design&&typeof input.data.design==='object'&&!Array.isArray(input.data.design)){const priorDesign=previous.design||await projectApprovedDesign(db);for(const key of ['seamlessCorners','seamlessPerimeter'])if(!Object.hasOwn(input.data.design,key))input.data.design[key]=priorDesign?.[key]===true;if(!Object.hasOwn(input.data.design,'seamlessCornerSide'))input.data.design.seamlessCornerSide=priorDesign?.seamlessCornerSide??'both';}if(input.data.assembly)for(const key of ['ballastAttached','wallsJoined','anglesSet'])if(!Object.hasOwn(input.data.assembly,key))input.data.assembly[key]=previous.assembly?.[key]??null;input.data=projectStampProgress(previous,projectReconcileGuideChecks(previous,input.data),now);}if(path==='finance')input.data=projectPreserveFinance(JSON.parse(row.content),input.data);content=JSON.stringify(projectValidate(path,input.data,now));}catch(e){return json({error:e.message},400);}
  if(path==='finance'){
   const known=new Set(JSON.parse(row.content).expenses.map(e=>e.receiptId).filter(Boolean));
   for(const id of new Set(input.data.expenses.map(e=>e.receiptId).filter(id=>id&&!known.has(id))))if(!await db.prepare('SELECT id FROM project_receipts WHERE id=?').bind(id).first())return json({error:'Receipt is missing. Upload it again before saving.'},400);
  }
  if(row.revision!==input.revision){
   if(row.revision===input.revision+1&&row.content===content)return json({data:JSON.parse(content),revision:row.revision});
   return json({error:'This project changed in another window. Refresh the module, then reapply your change.'},409);
  }
  const saved=await db.prepare('UPDATE project_documents SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(content,now,path,input.revision).run();
  if(saved.meta.changes!==1)return json({error:'This project changed in another window. Refresh and try again.'},409);
  return json({data:JSON.parse(content),revision:input.revision+1});
 }catch(e){console.error('Project API failed',e);return json({error:'Project storage is temporarily unavailable. Please try again.'},503);}
}
