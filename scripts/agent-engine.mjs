import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
export async function agentEngineRevision(){
 const hash=createHash('sha256');
 for(const file of ['agent-project.js','pricing-calc.js','pricing-config.js','shopping-calc.js','platform.js','cyclorama.js','labor.js','projection.js','project-model.js'])hash.update(file).update(await readFile(new URL('../public/'+file,import.meta.url)));
 return hash.digest('hex');
}
