// One-command dev server: `npm start`.
// Builds the Worker, applies local D1 migrations, then runs `wrangler dev` next to a watcher
// that rebuilds whenever public/ or worker/ change. Edit, then refresh the browser tab.
// Set PORT to run a second copy (another worktree) next to one already on 8787.
// `npm run start:phone` sets HOST=0.0.0.0 so a phone on the same Wi-Fi can open the printed address.
import {spawn, spawnSync} from 'node:child_process';
import {networkInterfaces} from 'node:os';

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const run = (cmd, args) => spawnSync(cmd, args, {stdio: 'inherit', shell: process.platform === 'win32'});
const step = (label, result) => {if (result.status !== 0) {console.error(`\n${label} failed.`);process.exit(result.status ?? 1);}};

step('Build', run(process.execPath, ['scripts/build.mjs']));
step('Local database migration', run(npx, ['wrangler', 'd1', 'migrations', 'apply', 'rc-set-comments-local', '--local', '--config', 'wrangler.json']));

const children = [
  spawn(process.execPath, ['--watch-path=public', '--watch-path=worker', '--watch-preserve-output', 'scripts/build.mjs'], {stdio: 'inherit'}),
  spawn(npx, ['wrangler', 'dev', '--config', 'wrangler.json', ...(process.env.PORT ? ['--port', process.env.PORT] : []), ...(process.env.HOST ? ['--ip', process.env.HOST] : [])], {stdio: 'inherit', shell: process.platform === 'win32'}),
];
if (process.env.HOST === '0.0.0.0') {
  const lan = Object.values(networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
  console.log(`\nOpen on your phone (same Wi-Fi): ${lan.map(ip => `http://${ip}:${process.env.PORT || 8787}`).join('  ') || 'no network address found'}\n`);
}
const stop = () => children.forEach(c => c.kill());
children.forEach(c => c.on('exit', code => {stop();process.exit(code ?? 0);}));
process.on('SIGINT', stop);process.on('SIGTERM', stop);
