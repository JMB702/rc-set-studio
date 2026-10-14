// Read-only JSON CLI. Authentication is optional and supplied via stdin, never argv/files/logs.
import {agentEngineRevision} from './agent-engine.mjs';
import {readFile} from 'node:fs/promises';
import {readAgentProject} from '../public/agent-project.js';
const args=process.argv.slice(2),value=key=>args.includes(key)?args[args.indexOf(key)+1]:null;
if(args.includes('--help')){console.log('node scripts/agent-project.mjs --url https://SITE [--source shared-build|saved|supplied] [--configuration-id ID] [--configuration FILE] [--private]\n--private reads an existing session Cookie from stdin. Never enter a PIN. No writes or credential persistence.');process.exit(0);}
try{
 const baseUrl=value('--url');if(!baseUrl)throw Error('--url is required');const url=new URL(baseUrl);
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error('Use HTTPS (or localhost).');
 if(url.username||url.password)throw Error('Credentials in URLs are not supported.');
 const includeFinance=args.includes('--private'),cookie=includeFinance?(await readFile(0,'utf8')).trim():null;
 if(includeFinance&&!/^rc_project_session=[a-f0-9-]+$/.test(cookie))throw Error('Expected an existing project session Cookie on stdin.');
 const configuration=value('--configuration')?JSON.parse(await readFile(value('--configuration'),'utf8')):null;
 const result=await readAgentProject({baseUrl,source:value('--source')??'shared-build',configuration,configurationId:value('--configuration-id'),includeFinance,expectedEngineRevision:await agentEngineRevision(),fetcher:(target)=>fetch(target,{redirect:'error',headers:cookie&&target.pathname.startsWith('/api/project/')?{Cookie:cookie}:{}})});
 console.log(JSON.stringify(result,null,2));
}catch(error){console.error(error.message);process.exitCode=1;}
