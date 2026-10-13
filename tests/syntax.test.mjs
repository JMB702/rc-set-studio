import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Browser-only modules are not imported by other tests; a duplicate declaration would otherwise only show up as a blank page.
test('Every browser module parses',()=>{
 const dir=new URL('../public/',import.meta.url);
 for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.js'))){
  const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL(file,dir))],{encoding:'utf8'});
  assert.equal(result.status,0,file+': '+result.stderr.split('\n').find(l=>/Error/.test(l)));
 }
});
