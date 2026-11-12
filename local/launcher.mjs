import { spawn } from 'node:child_process';
import fs from 'node:fs';

const log = fs.openSync('/tmp/kb_web_serve2.log', 'a');
const c = spawn(process.execPath, [__dirname + '/serve.mjs'], {
  cwd: process.cwd(),
  detached: true,
  stdio: ['ignore', log, log],
});
c.unref();
console.log('spawned serve.mjs pid', c.pid);
setTimeout(() => process.exit(0), 500);
