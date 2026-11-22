'use strict';

const https = require('https');
const http = require('http');

const endpoint = process.env.OPENRAG_WITNESS_URL;
const nodeId = process.env.OPENRAG_NODE_ID || 'openrag-desktop-service';

function postHeartbeat() {
  if (!endpoint) {
    console.warn('[OpenRAG] OPENRAG_WITNESS_URL is not configured; service is idle.');
    return;
  }
  const url = new URL(endpoint);
  const transport = url.protocol === 'https:' ? https : http;
  const body = Buffer.from(JSON.stringify({
    nodeId,
    source: 'windows-service',
    type: 'desktop-service-heartbeat',
    at: new Date().toISOString(),
    detail: { runtime: process.version, pid: process.pid }
  }));
  const req = transport.request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': body.length
    },
    timeout: 10000
  }, res => {
    res.resume();
    console.log('[OpenRAG] witness status:', res.statusCode);
  });
  req.on('timeout', () => req.destroy(new Error('request timeout')));
  req.on('error', err => console.error('[OpenRAG] heartbeat failed:', err.message));
  req.end(body);
}

console.log('[OpenRAG] Desktop service started.');
postHeartbeat();
const timer = setInterval(postHeartbeat, 30000);

function shutdown() {
  clearInterval(timer);
  console.log('[OpenRAG] Desktop service stopping.');
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
