'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const runtimeDir = path.resolve(__dirname, '../../node-runtime');
const workerScript = path.join(runtimeDir, 'src', 'worker.js');
let child = null;
let stopping = false;
let restartTimer = null;

function startWorker() {
  if (stopping || child) return;
  child = spawn(process.execPath, [workerScript], {
    cwd: runtimeDir,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true
  });
  console.log('[OpenRAG] Node Runtime worker launched:', child.pid);
  child.once('error', error => console.error('[OpenRAG] worker process error:', error.message));
  child.once('exit', (code, signal) => {
    console.warn('[OpenRAG] worker exited:', { code, signal });
    child = null;
    if (!stopping) restartTimer = setTimeout(startWorker, 5000);
  });
}

function shutdown() {
  if (stopping) return;
  stopping = true;
  if (restartTimer) clearTimeout(restartTimer);
  if (child) {
    const current = child;
    child = null;
    current.kill();
  }
  console.log('[OpenRAG] Desktop Node service stopped.');
  setTimeout(() => process.exit(0), 500);
}

console.log('[OpenRAG] Desktop Node service starting the shared task runtime.');
startWorker();
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
