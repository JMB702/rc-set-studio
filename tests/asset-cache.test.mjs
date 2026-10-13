import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../worker/index.js',import.meta.url),'utf8');
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from('const assets={"/test.js":["text/javascript","b2s=",\'"version-1"\']};\n'+source).toString('base64'));
test('Static asset revalidation avoids retransferring unchanged assets and serves changed versions',async()=>{
 const get=headers=>worker.fetch(new Request('https://example.com/test.js',{headers}),{});
 const initial=await get({});assert.equal(await initial.text(),'ok');assert.equal(initial.headers.get('etag'),'"version-1"');
 const cached=await get({'If-None-Match':'"version-1"'});assert.equal(cached.status,304);assert.equal(await cached.text(),'');
 const changed=await get({'If-None-Match':'"old-version"'});assert.equal(changed.status,200);assert.equal(await changed.text(),'ok');
});
test('Both public progress displays use access-independent weights',()=>{
 const project=fs.readFileSync(new URL('../public/project.js',import.meta.url),'utf8');
 assert.equal((project.match(/w=progressWeights\(buildDesign\([^)]*\)\)/g)||[]).length,2);
 assert.doesNotMatch(project,/progressWeights\(api.state,\{tracking:[^}]*shifts:/);
});
