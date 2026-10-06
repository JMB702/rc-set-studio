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
  if(!c||![96,120].includes(c.height)||!Number.isFinite(c.angle)||c.angle<0||c.angle>90||!['wood','charcoal'].includes(c.floor)||!['finished','build'].includes(c.mode)||!Number.isInteger(c.step)||c.step<0||c.step>40) throw Error('Invalid set configuration.');
  return {id:input.id,name,body,elementId,elementLabel,context:JSON.stringify({height:c.height,angle:c.angle,floor:c.floor,mode:c.mode,step:c.step}),createdAt:Date.now()};
}
function commentRow(r){return {id:r.id,name:r.name,body:r.body,elementId:r.element_id,elementLabel:r.element_label,context:JSON.parse(r.context),createdAt:r.created_at};}
export default {async fetch(request,env) {
  const url=new URL(request.url);
  if(url.pathname==='/api/comments') {
    try {
      const db=database(env);
      if(request.method==='GET') {
        const before=url.searchParams.get('before');
        if(before!==null&&(!/^\d+$/.test(before)||!Number.isSafeInteger(Number(before))))return json({error:'Invalid page.'},400);
        const rows=await db.prepare('SELECT * FROM comments WHERE created_at < ? ORDER BY created_at DESC, id DESC LIMIT 51').bind(before?Number(before):Number.MAX_SAFE_INTEGER).all();
        const items=rows.results.slice(0,50).map(commentRow);
        return json({comments:items,nextBefore:rows.results.length>50?items.at(-1).createdAt:null});
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
