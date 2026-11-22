'use strict';

const path = require('path');
const { Service } = require('node-windows');

const svc = new Service({
  name: 'OpenRAG Desktop Node',
  description: 'User-installed OpenRAG background node service. Runs independently of the browser.',
  script: path.join(__dirname, 'service.js'),
  wait: 2,
  grow: 0.5,
  maxRetries: 3
});

svc.on('install', () => {
  console.log('OpenRAG Desktop Node service installed.');
  svc.start();
});
svc.on('alreadyinstalled', () => console.log('Service is already installed.'));
svc.on('start', () => console.log('OpenRAG Desktop Node service started.'));
svc.on('error', err => console.error('Service error:', err));
svc.install();
