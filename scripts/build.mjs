import { readdir, readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
const assets = {};
const pricingConfigHelpers=(await readFile('public/pricing-config.js','utf8')).replaceAll('export function ','function ');
const cameraHelpers=(await readFile('public/camera-state.js','utf8')).replaceAll('export function ','function ');
const projectHelpers=(await readFile('public/project-model.js','utf8')).replaceAll('export function ','function ');
const projectWorker=await readFile('worker/project.js','utf8');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.txt':'text/plain; charset=utf-8','.webp':'image/webp'};
async function walk(dir) {for (const entry of await readdir(dir,{withFileTypes:true})) {const file=path.join(dir,entry.name);if(entry.isDirectory()) await walk(file);else assets['/'+path.relative('public',file).split(path.sep).join('/')]=[types[path.extname(file)]||'application/octet-stream',(await readFile(file)).toString('base64')];}}
await walk('public');
await rm('dist',{recursive:true,force:true});await mkdir('dist/server',{recursive:true});
await writeFile('dist/server/index.js',`const assets=${JSON.stringify(assets)};\n`+pricingConfigHelpers+'\n'+cameraHelpers+'\n'+projectHelpers+'\n'+projectWorker+'\n'+await readFile('worker/index.js','utf8'));
console.log(`Built Worker with ${Object.keys(assets).length} assets.`);
