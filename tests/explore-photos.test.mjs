import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {photoTimeline,span} from '../public/explore-photos.js';

const data=JSON.parse(fs.readFileSync(new URL('../public/data/build-photos.json',import.meta.url),'utf8'));
const dir=new URL('../public/photos/build/',import.meta.url);

test('Every build photo names a known stage and has every listed size on disk',()=>{
 const stages=new Set(data.stages.map(s=>s.id)),ids=new Set();
 for(const p of data.photos){
  assert.ok(stages.has(p.stage),p.id+' has unknown stage '+p.stage);
  assert.ok(!ids.has(p.id),'duplicate id '+p.id);ids.add(p.id);
  assert.ok(p.title&&p.caption,p.id+' needs a title and caption (the caption is the alt text)');
  assert.match(p.taken,/^\d{4}-\d\d-\d\dT\d\d:\d\d$/);
  assert.ok(Object.keys(p.src).length>=3,p.id+' needs at least three sizes');
  for(const [w,file] of Object.entries(p.src)){assert.match(file,new RegExp(`-${w}\\.[0-9a-f]{8}\\.webp$`));assert.ok(fs.existsSync(new URL(file,dir)),file+' is missing');}
 }
 const listed=new Set(data.photos.flatMap(p=>Object.values(p.src)));
 for(const file of fs.readdirSync(dir))assert.ok(listed.has(file),file+' is not in build-photos.json');
});

// Published photos must carry no camera, GPS or XMP metadata: WebP keeps those in EXIF/XMP chunks.
test('Published build photos carry no EXIF or XMP metadata',()=>{
 for(const file of fs.readdirSync(dir)){
  const b=fs.readFileSync(new URL(file,dir));
  assert.equal(b.toString('latin1',0,4),'RIFF');assert.equal(b.toString('latin1',8,12),'WEBP');
  for(let o=12;o+8<=b.length;){const id=b.toString('latin1',o,o+4),size=b.readUInt32LE(o+4);assert.ok(!['EXIF','XMP '].includes(id),file+' has a '+id+' chunk');o+=8+size+(size&1);}
 }
});

test('The timeline groups photos by stage in build order',()=>{
 const stages=photoTimeline(data),flat=stages.flatMap(s=>s.photos);
 assert.equal(flat.length,data.photos.length);
 for(let i=1;i<flat.length;i++)assert.ok(flat[i-1].taken<=flat[i].taken,'stages must not overlap in time: '+flat[i].id);
 assert.ok(stages.every(s=>s.first<=s.last));
});

test('Date spans read naturally',()=>{
 assert.equal(span('2026-10-08T16:27','2026-10-15T20:43'),'October 8–15, 2026');
 assert.equal(span('2026-09-28T09:00','2026-10-03T10:00'),'September 28 – October 3, 2026');
});
