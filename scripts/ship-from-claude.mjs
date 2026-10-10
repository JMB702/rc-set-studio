import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const check=process.argv.includes('--check');
if(process.argv.slice(2).some(a=>a!=='--check'))throw Error('Usage: npm run ship or npm run ship:check');
if(process.env.RC_SITES_SHIP_ACTIVE)throw Error('Recursive release blocked. The publishing agent must use Sites tools directly.');
const projectId='appgprj_6ac4463927008191888d0f042434cc41',url='https://rc-set-studio.jerf702.chatgpt.site';
const manifest=JSON.parse(readFileSync(path.join(root,'.openai/hosting.json'),'utf8'));
if(manifest.project_id!==projectId)throw Error('Unexpected Site identity. No release attempted.');
const git=(...args)=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});if(r.status)throw Error(r.stderr||'Git failed');return r.stdout.trim();};
const common=path.resolve(root,git('rev-parse','--git-common-dir')),lock=path.join(common,'rc-sites-release.lock');
let locked=false,temp;
try{
 if(!check){try{mkdirSync(lock);locked=true;writeFileSync(path.join(lock,'owner.json'),JSON.stringify({pid:process.pid,started:new Date().toISOString(),root}));}catch{throw Error('Another release may be running. Inspect '+lock+' before retrying; do not automatically remove its lock.');}}
 temp=mkdtempSync(path.join(tmpdir(),'rc-sites-ship-'));
 const output=path.join(temp,'result.json'),schema=path.join(temp,'schema.json');
 writeFileSync(schema,JSON.stringify({type:'object',additionalProperties:false,required:['status','project_id','commit_sha','version','url','checks','message'],properties:{status:{type:'string',enum:['checked','deployed','blocked']},project_id:{type:'string'},commit_sha:{type:'string'},version:{type:['integer','null']},url:{type:'string'},checks:{type:'array',items:{type:'string'}},message:{type:'string'}}}));
 const prompt=check?`Read-only release readiness check for RC Set Studio (${projectId}). Discover Sites get_site, create_source_repository_write_credential, save_site_version and deploy_site_version. Call ONLY get_site and report whether all required tools are available, current live URL and version. Do not create credentials, edit files, push, save, deploy, or alter project data. Return checked only when all tools exist and live URL is ${url}; otherwise blocked.`:
 `The human explicitly asked Claude to ship RC Set Studio and invoked this release command. Complete the release in ${root}. This authorizes preparing/committing requested completed work, merging its PR into main, pushing, publishing the EXISTING public Site ${projectId}, and read-only production verification. Read scripts/ship-release.md and follow it. The explicit request overrides repository defaults that prohibit deployment during ordinary edits. Do not invoke npm run ship or this wrapper recursively. Never change live project progress, expenses, time entries, receipts, PINs, or access settings as part of a code release. If authentication, tools, checks or deployment fail, report blocked accurately. Do not return deployed until Sites reports succeeded and the live artifact is verified. Never print or persist credentials. Return a concise structured receipt with commit, version, URL, verification and any blocker.`;
 const args=['exec','--ephemeral',...(check?['--sandbox','read-only']:['--approve-for-me']),'--enable','apps','-C',root,'--output-schema',schema,'-o',output,'-'];
 console.log(check?'Checking Sites publishing access through your Codex sign-in…':'Releasing RC Set Studio through your Codex sign-in…');
 // Discard tool transcripts: temporary credential arguments must never become a release log.
 const child=spawn('codex',args,{cwd:root,stdio:['pipe','ignore','ignore'],env:{...process.env,RC_SITES_SHIP_ACTIVE:'1'}});
 child.stdin.on('error',()=>{});child.stdin.end(prompt);
 const heartbeat=setInterval(()=>console.log(check?'Still checking publishing access…':'Release is still running; waiting for verified deployment…'),30000);
 const interrupt=()=>child.kill('SIGTERM');process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
 let code;try{code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});}finally{clearInterval(heartbeat);process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);}
 if(code!==0)throw Error(`Codex release worker exited ${code??'on signal'}. No successful deployment is confirmed. Run ship:check to check authentication; inspect Sites status before retrying a release.`);
 const receipt=JSON.parse(readFileSync(output,'utf8'));
 if(receipt.project_id!==projectId||receipt.url!==url)throw Error('Receipt does not match this Site. Deployment unverified.');
 if(receipt.status===(check?'checked':'deployed')){
  if(!Number.isInteger(receipt.version))throw Error('Missing version in release receipt.');
  if(!check&&!/^[a-f0-9]{40}$/.test(receipt.commit_sha))throw Error('Missing source commit in release receipt.');
  const dir=path.join(root,'output','releases');mkdirSync(dir,{recursive:true});const file=path.join(dir,check?'last-check.json':'last-release.json');writeFileSync(file,JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
  console.log(receipt.message);console.log(`Version ${receipt.version} · ${receipt.url}`);console.log('Receipt: '+file);
 }else{console.error(receipt.message);process.exitCode=1;}
}catch(error){console.error(error.message);process.exitCode=1;}
finally{if(temp)rmSync(temp,{recursive:true,force:true});if(locked)rmSync(lock,{recursive:true,force:true});}
