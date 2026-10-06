// One-command dev server: `npm start`.
// Builds the Worker, applies local D1 migrations, then runs `wrangler dev` next to a watcher
// that rebuilds whenever public/ or worker/ change. Edit, then refresh the browser tab.
import {spawn, spawnSync} from 'node:child_process';

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const run = (cmd, args) => spawnSync(cmd, args, {stdio: 'inherit', shell: process.platform === 'win32'});
const step = (label, result) => {if (result.status !== 0) {console.error(`\n${label} failed.`);process.exit(result.status ?? 1);}};

step('Build', run(process.execPath, ['scripts/build.mjs']));
step('Local database migration', run(npx, ['wrangler', 'd1', 'migrations', 'apply', 'rc-set-comments-local', '--local', '--config', 'wrangler.json']));

const children = [
  spawn(process.execPath, ['--watch-path=public', '--watch-path=worker', '--watch-preserve-output', 'scripts/build.mjs'], {stdio: 'inherit'}),
  spawn(npx, ['wrangler', 'dev', '--config', 'wrangler.json'], {stdio: 'inherit', shell: process.platform === 'win32'}),
];
const stop = () => children.forEach(c => c.kill());
children.forEach(c => c.on('exit', code => {stop();process.exit(code ?? 0);}));
process.on('SIGINT', stop);process.on('SIGTERM', stop);
