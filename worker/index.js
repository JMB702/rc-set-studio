const json = (data,status=200,headers={}) => Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
function database(env) {if(!env.DB) throw Error('Comments database unavailable');return env.DB;}
function normalize(input) {
  if (!input || typeof input!=='object') throw Error('Invalid comment.');
  const name=typeof input.name==='string'?input.name.trim():'';
  const body=typeof input.body==='string'?input.body.trim():'';
  if(!name||name.length>80) throw Error('Enter a name (up to 80 characters).');
  if(!body||body.length>2000) throw Error('Enter a comment (up to 2,000 characters).');
  if(typeof input.id!=='string'||!/^[0-9a-f-]{36}$/i.test(input.id)) throw Error('Invalid comment ID.');
  const elementId=input.elementId??null,elementLabel=input.elementLabel??null;
  if((elementId===null)!==(elementLabel===null)||elementId!==null&&(typeof elementId!=='string'||elementId.length>240||!elementId||typeof elementLabel!=='string'||!elementLabel.trim()||elementLabel.length>240)) throw Error('Invalid element attachment.');
  const c=input.context;
  if(!c||![96,120].includes(c.height)||!Number.isFinite(c.angle)||c.angle<0||c.angle>90||!['none','wood','charcoal','platform'].includes(c.floor)||!['finished','build'].includes(c.mode)||!Number.isInteger(c.step)||c.step<0||c.step>40) throw Error('Invalid set configuration.');
  if(c.floorColor!==undefined&&(typeof c.floorColor!=='string'||!/^#[0-9a-f]{6}$/i.test(c.floorColor)))throw Error('Invalid floor color.');
  if(c.wallColor!==undefined&&(typeof c.wallColor!=='string'||!/^#[0-9a-f]{6}$/i.test(c.wallColor)))throw Error('Invalid wall color.');
  if(c.figures!==undefined&&!['podcast','rap'].includes(c.figures)||c.figureScale!==undefined&&(!Number.isFinite(c.figureScale)||c.figureScale<.8||c.figureScale>1.25))throw Error('Invalid scale figures.');
  for(const k of ['platformBack','platformSide'])if(c[k]!==undefined&&(!Number.isInteger(c[k])||c[k]<0||c[k]>48))throw Error('Invalid platform gap.');
  if(c.platformAngle!==undefined&&(!Number.isFinite(c.platformAngle)||c.platformAngle<0||c.platformAngle>90))throw Error('Invalid platform angle.');
  if(c.platformShape!==undefined&&!['none','angled','square'].includes(c.platformShape))throw Error('Invalid platform shape.');
  if(c.platformColor!==undefined&&(typeof c.platformColor!=='string'||!/^#[0-9a-f]{6}$/i.test(c.platformColor)))throw Error('Invalid platform color.');
  const platformShape=c.platformShape??(c.floor==='platform'?'angled':'none'),floor=c.floor==='platform'?'none':c.floor;
  return {id:input.id,name,body,elementId,elementLabel,context:JSON.stringify({height:c.height,angle:c.angle,floor,platformShape,...(platformShape!=='none'?{platformBack:c.platformBack??12,platformSide:c.platformSide??12,platformAngle:Math.max(c.angle,c.platformAngle??c.angle),platformColor:c.platformColor||'#34383b'}:{}),mode:c.mode,step:c.step,wallColor:c.wallColor||'#34383b',floorColor:c.floorColor||'#3c4041',figures:c.figures||'podcast',figureScale:c.figureScale||1}),createdAt:Date.now()};
}
function commentRow(r){return {id:r.id,name:r.name,body:r.body,elementId:r.element_id,elementLabel:r.element_label,context:JSON.parse(r.context),createdAt:r.created_at};}
export default {async fetch(request,env) {
  const url=new URL(request.url);
  if(url.pathname==='/api/camera-positions') {
    try {
      const db=database(env),row=r=>({id:r.id,name:r.name,shot:JSON.parse(r.shot),revision:r.revision,createdAt:r.created_at,updatedAt:r.updated_at,deletedAt:r.deleted_at??null});
      if(request.method==='GET') {
        const result=await db.prepare('SELECT * FROM camera_positions ORDER BY created_at DESC,id DESC').all();
        return json({positions:result.results.filter(r=>r.deleted_at===null).map(row),deletedPositions:result.results.filter(r=>r.deleted_at!==null).map(row)});
      }
      if(['POST','PATCH','DELETE'].includes(request.method)) {
        if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'Please save from this site.'},403);
        if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'Expected JSON.'},415);
        const raw=await request.text();if(raw.length>4000)return json({error:'Camera position is too large.'},413);
        let input,name,shot,removing,restoring;
        try {
          input=JSON.parse(raw);removing=request.method==='DELETE';restoring=request.method==='PATCH'&&input?.restore===true;
          if(typeof input?.id!=='string'||!/^[0-9a-f-]{36}$/i.test(input.id))throw Error('Invalid camera ID.');
          if(request.method!=='POST'&&(!Number.isSafeInteger(input.revision)||input.revision<0))throw Error('Invalid camera revision.');
          if(!removing&&!restoring){
            name=typeof input.name==='string'?input.name.trim():'';
            if(!name||name.length>80)throw Error('Enter a camera name (up to 80 characters).');
            shot=JSON.stringify(normalizeCameraShot(input.shot));
          }
        }catch(e){return json({error:e.message},400);}
        const current=await db.prepare('SELECT * FROM camera_positions WHERE id=?').bind(input.id).first();
        if(removing||restoring){
          if(!current)return json({error:'Camera position not found.'},404);
          const alreadyDone=removing?current.deleted_at!==null:current.deleted_at===null;
          if(alreadyDone&&current.revision===input.revision+1)return json({position:row(current)});
          if(current.revision!==input.revision||alreadyDone)return json({error:'This camera changed elsewhere. Refresh the list before trying again.'},409);
          const result=await db.prepare('UPDATE camera_positions SET deleted_at=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?').bind(removing?Date.now():null,Date.now(),input.id,input.revision).run();
          if(result.meta.changes!==1)return json({error:'This camera changed elsewhere. Refresh the list before trying again.'},409);
          return json({position:row(await db.prepare('SELECT * FROM camera_positions WHERE id=?').bind(input.id).first())});
        }
        if(current?.deleted_at!=null)return json({error:'This camera has been deleted. Restore it before editing.'},409);
        if(request.method==='POST') {
          if(current&&(current.name!==name||current.shot!==shot))return json({error:'This camera ID is already in use.'},409);
          await db.prepare('INSERT INTO camera_positions (id,name,shot,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(input.id,name,shot,Date.now(),Date.now()).run();
        }else {
          if(!current)return json({error:'Camera position not found.'},404);
          if(current.revision!==input.revision) {
            if(current.revision===input.revision+1&&current.name===name&&current.shot===shot)return json({position:row(current)});
            return json({error:'This camera was edited elsewhere. Refresh the list and select it before saving again.'},409);
          }
          const result=await db.prepare('UPDATE camera_positions SET name=?,shot=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?').bind(name,shot,Date.now(),input.id,input.revision).run();
          if(result.meta.changes!==1)return json({error:'This camera was edited elsewhere. Refresh the list before saving again.'},409);
        }
        const saved=await db.prepare('SELECT * FROM camera_positions WHERE id=?').bind(input.id).first();
        return json({position:row(saved)},request.method==='POST'?201:200);
      }
      return json({error:'Method not allowed.'},405,{'Allow':'GET, POST, PATCH, DELETE'});
    }catch(e){console.error('Camera position request failed',e);return json({error:'Camera positions are temporarily unavailable. Please try again.'},503);}
  }
  if(url.pathname==='/api/pricing-configurations'||url.pathname.startsWith('/api/pricing-configurations/')) {
    try {
      const db=database(env),collection=url.pathname==='/api/pricing-configurations',id=collection?null:url.pathname.slice('/api/pricing-configurations/'.length);
      if(id&&!/^[0-9a-f-]{36}$/i.test(id))return json({error:'Invalid configuration ID.'},400);
      if(request.method==='GET'){
        if(collection){const result=await db.prepare('SELECT id,name,created_at FROM pricing_configurations ORDER BY created_at DESC,id DESC LIMIT 100').all();return json({configurations:result.results.map(c=>({id:c.id,name:c.name,createdAt:c.created_at}))});}
        const c=await db.prepare('SELECT * FROM pricing_configurations WHERE id = ?').bind(id).first();if(!c)return json({error:'Configuration not found.'},404);
        return json({configuration:{id:c.id,name:c.name,createdAt:c.created_at,configuration:JSON.parse(c.configuration)}});
      }
      if(request.method==='POST'&&collection){
        if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'Please save from this site.'},403);
        if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'Expected JSON.'},415);
        const raw=await request.text();if(raw.length>300000)return json({error:'Configuration is too large.'},413);
        let input,configuration,name;try{input=JSON.parse(raw);name=typeof input.name==='string'?input.name.trim():'';if(!name||name.length>100)throw Error('Enter a configuration name (up to 100 characters).');if(typeof input.id!=='string'||!/^[0-9a-f-]{36}$/i.test(input.id))throw Error('Invalid configuration ID.');configuration=normalizeConfiguration(input.configuration);}catch(e){return json({error:e.message},400);}
        await db.prepare('INSERT INTO pricing_configurations (id,name,configuration,created_at) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(input.id,name,JSON.stringify(configuration),Date.now()).run();
        const c=await db.prepare('SELECT id,name,created_at FROM pricing_configurations WHERE id = ?').bind(input.id).first();return json({configuration:{id:c.id,name:c.name,createdAt:c.created_at}},201);
      }
      return json({error:'Method not allowed.'},405,{'Allow':collection?'GET, POST':'GET'});
    }catch(e){console.error('Pricing configuration request failed',e);return json({error:'Saved configurations are temporarily unavailable. Please try again.'},503);}
  }
  // Approval edits preserve creation order. A revision check prevents overwriting another edit.
  if(url.pathname==='/api/approvals') {
    try {
      const db=database(env);
      const row=r=>({id:r.id,name:r.name,design:JSON.parse(r.design),createdAt:r.created_at,updatedAt:r.updated_at??null,revision:r.revision??0,estimate:r.estimate?JSON.parse(r.estimate):null});
      if(request.method==='GET'){
        const rows=await db.prepare('SELECT * FROM design_approvals ORDER BY created_at DESC, id DESC LIMIT 50').all();
        return json({approvals:rows.results.map(row)});
      }
      if(['POST','PATCH'].includes(request.method)){
        if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'Please approve from this site.'},403);
        if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'Expected JSON.'},415);
        const raw=await request.text();if(raw.length>8000)return json({error:'Approval is too large.'},413);
        let input,name,design,estimate;try{input=JSON.parse(raw);name=typeof input.name==='string'?input.name.trim():'';if(!name||name.length>80)throw Error('Enter your name (up to 80 characters).');if(typeof input.id!=='string'||!/^[0-9a-f-]{36}$/i.test(input.id))throw Error('Invalid approval ID.');design=normalizeDesign(input.design);estimate=normalizeApprovalEstimate(input.estimate);
          if(request.method==='PATCH'&&(!Number.isSafeInteger(input.revision)||input.revision<0))throw Error('Invalid approval revision.');
        }catch(e){return json({error:e.message},400);}
        const designText=JSON.stringify(design),estimateText=estimate?JSON.stringify(estimate):null;
        if(request.method==='POST'){
          await db.prepare('INSERT INTO design_approvals (id,name,design,created_at,estimate) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(input.id,name,designText,Date.now(),estimateText).run();
        }else{
          const current=await db.prepare('SELECT * FROM design_approvals WHERE id = ?').bind(input.id).first();
          if(!current)return json({error:'Approval not found.'},404);
          // Repeated identical updates after a lost response are safe. Different stale edits are rejected.
          if((current.revision??0)!==input.revision){
            if((current.revision??0)===input.revision+1&&current.name===name&&current.design===designText&&(current.estimate??null)===estimateText)return json({approval:row(current)});
            return json({error:'This approval was edited elsewhere. Reload it before saving your changes.'},409);
          }
          const result=await db.prepare('UPDATE design_approvals SET name=?,design=?,estimate=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?').bind(name,designText,estimateText,Date.now(),input.id,input.revision).run();
          if(result.meta.changes!==1)return json({error:'This approval was edited elsewhere. Reload it before saving your changes.'},409);
        }
        const r=await db.prepare('SELECT * FROM design_approvals WHERE id = ?').bind(input.id).first();
        return json({approval:row(r)},request.method==='POST'?201:200,{'Set-Cookie':`rc_comment_name=${encodeURIComponent(name)}; Path=/; Max-Age=31536000; SameSite=Lax${url.protocol==='https:'?'; Secure':''}`});
      }
      return json({error:'Method not allowed.'},405,{'Allow':'GET, POST, PATCH'});
    }catch(e){console.error('Approval request failed',e);return json({error:'Approvals are temporarily unavailable. Please try again.'},503);}
  }
  if(url.pathname==='/api/comments') {
    try {
      const db=database(env);
      if(request.method==='GET') {
        const before=url.searchParams.get('before');
        if(before!==null&&!/^\d+\|[0-9a-f-]{36}$/i.test(before))return json({error:'Invalid page.'},400);
        const [beforeTime,beforeId]=before?before.split('|'):[String(Number.MAX_SAFE_INTEGER),''];
        const rows=await db.prepare('SELECT * FROM comments WHERE created_at < ? OR (created_at = ? AND id < ?) ORDER BY created_at DESC, id DESC LIMIT 51').bind(Number(beforeTime),Number(beforeTime),beforeId).all();
        const items=rows.results.slice(0,50).map(commentRow);
        return json({comments:items,nextBefore:rows.results.length>50?items.at(-1).createdAt+'|'+items.at(-1).id:null});
      }
      if(request.method==='POST') {
        if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'Please post from this site.'},403);
        if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'Expected JSON.'},415);
        const raw=await request.text();if(raw.length>12000)return json({error:'Comment is too long.'},413);
        let c;try{c=normalize(JSON.parse(raw));}catch(e){return json({error:e.message},400);}
        // Reusing the draft ID makes retries safe if a response is lost.
        await db.prepare('INSERT INTO comments (id,name,body,element_id,element_label,context,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(c.id,c.name,c.body,c.elementId,c.elementLabel,c.context,c.createdAt).run();
        const saved=await db.prepare('SELECT * FROM comments WHERE id = ?').bind(c.id).first();
        return json({comment:commentRow(saved)},201,{'Set-Cookie':`rc_comment_name=${encodeURIComponent(c.name)}; Path=/; Max-Age=31536000; SameSite=Lax${url.protocol==='https:'?'; Secure':''}`});
      }
      return json({error:'Method not allowed.'},405,{'Allow':'GET, POST'});
    }catch(e){console.error('Comments request failed',e);return json({error:'Comments are temporarily unavailable. Please try again.'},503);}
  }
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const asset=assets[url.pathname==='/'?'/index.html':url.pathname];
  if(!asset)return new Response('Not found',{status:404});
  const bytes=Uint8Array.from(atob(asset[1]),c=>c.charCodeAt(0));
  return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset[0],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
}};
