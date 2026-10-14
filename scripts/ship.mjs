// `npm run ship [PR number]`: merge a pull request into main, wait for Vercel's production build of that
// exact merge commit, then check the live site. With no number it ships the open PR for the current branch.
// Vercel builds main automatically through its GitHub integration; this script never deploys by itself.
import {spawnSync} from 'node:child_process';
const repo = 'JMB702/rc-set-studio', live = 'https://rc-set-studio.vercel.app';
const sh = (cmd, args) => {const r = spawnSync(cmd, args, {encoding: 'utf8'});if (r.status) throw Error(`${cmd} ${args.join(' ')}\n${r.stderr || r.stdout}`);return r.stdout.trim();};
const gh = (...args) => sh('gh', args), sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  const arg = process.argv[2];
  if (arg && !/^\d+$/.test(arg)) throw Error('Usage: npm run ship [PR number]');
  const pr = JSON.parse(gh('pr', 'view', ...(arg ? [arg] : []), '--repo', repo, '--json', 'number,state,title,mergeCommit'));
  if (pr.state === 'OPEN') {
    console.log(`Merging #${pr.number}: ${pr.title}`);
    gh('pr', 'merge', String(pr.number), '--repo', repo, '--merge');
  } else if (pr.state !== 'MERGED') throw Error(`#${pr.number} is ${pr.state.toLowerCase()}; nothing to ship.`);
  let sha;
  for (let i = 0; i < 20 && !sha; i++) {sha = JSON.parse(gh('pr', 'view', String(pr.number), '--repo', repo, '--json', 'mergeCommit')).mergeCommit?.oid;if (!sha) await sleep(3000);}
  if (!sha) throw Error('GitHub has not reported the merge commit yet. Run npm run ship ' + pr.number + ' again.');
  console.log(`Waiting for Vercel to build ${sha.slice(0, 7)} for production…`);
  let state;
  for (const start = Date.now(); Date.now() - start < 15 * 60000; await sleep(10000)) {
    const statuses = JSON.parse(gh('api', `repos/${repo}/commits/${sha}/statuses`, '--paginate', '--slurp')).flat().filter(s => s.context.startsWith('Vercel'));
    state = statuses[0]?.state;
    if (state === 'success' || state === 'failure' || state === 'error') {console.log(`Vercel: ${statuses[0].description} ${statuses[0].target_url ?? ''}`);break;}
  }
  if (state !== 'success') throw Error(state ? `Production build ${state}. Nothing new is live.` : 'Vercel never reported a build for the merge commit. Check the GitHub connection in the Vercel project settings.');
  const check = async (path, expected) => {const r = await fetch(live + path, {cache: 'no-store'});if (r.status !== expected) throw Error(`${path} returned ${r.status}, expected ${expected}`);};
  await check('/', 200);await check('/api/project/tracking', 200);await check('/api/project/finance', 401);
  console.log(`Shipped #${pr.number} (${sha.slice(0, 7)}) · ${live}`);
} catch (error) {console.error(error.message);process.exitCode = 1;}
