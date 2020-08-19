#!/usr/bin/env node
import * as fs from 'fs';
import 'source-map-support/register';
import logger from './lib/logger';

import { ExpressApp } from './lib/expressapp';

const config = require('./config');
const port = process.env.BWS_PORT || config.port || 3232;
const cluster = require('cluster');
const serverModule = config.https ? require('https') : require('http');

const serverOpts: {
  key?: Buffer;
  cert?: Buffer;
  ciphers?: string[];
  honorCipherOrder?: boolean;
  ca?: Buffer[];
} = {};

if (config.https) {
  serverOpts.key = fs.readFileSync(config.privateKeyFile || './ssl/privatekey.pem');
  serverOpts.cert = fs.readFileSync(config.certificateFile || './ssl/certificate.pem');
  if (config.ciphers) {
    serverOpts.ciphers = config.ciphers;
    serverOpts.honorCipherOrder = true;
  }

  // This sets the intermediate CA certs only if they have all been designated in the config.js
  if (config.CAinter1 && config.CAinter2 && config.CAroot) {
    serverOpts.ca = [
      fs.readFileSync(config.CAinter1),
      fs.readFileSync(config.CAinter2),
      fs.readFileSync(config.CAroot)
    ];
  }
}

if (config.cluster && !config.lockOpts.lockerServer)
  throw new Error('When running in cluster mode, locker server need to be configured');

if (config.cluster && !config.messageBrokerOpts.messageBrokerServer)
  throw new Error('When running in cluster mode, message broker server need to be configured');

const expressApp = new ExpressApp();

function startInstance() {
  const server = config.https
    ? serverModule.createServer(serverOpts, expressApp.app)
    : serverModule.Server(expressApp.app);

  expressApp.start(config, err => {
    if (err) {
      logger.error('Could not start BWS instance', err);
      return;
    }

    server.listen(port);

    const instanceInfo = cluster.worker ? ' [Instance:' + cluster.worker.id + ']' : '';
    logger.info('BWS running ' + instanceInfo);
    return;
  });
}

if (config.cluster && cluster.isMaster) {
  // Count the machine's CPUs
  const instances = config.clusterInstances || require('os').cpus().length;

  logger.info('Starting ' + instances + ' instances');

  // Create a worker for each CPU
  for (let i = 0; i < instances; i += 1) {
    cluster.fork();
  }

  // Listen for dying workers
  cluster.on('exit', worker => {
    // Replace the dead worker,
    logger.error('Worker ' + worker.id + ' died :(');
    cluster.fork();
  });
  // Code to run if we're in a worker process
} else {
  logger.info('Listening on port: ' + port);
  startInstance();
}
