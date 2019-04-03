import { P2P } from './services/p2p';
import { Storage } from './services/storage';
import { Worker } from './services/worker';
import { Api } from './services/api';
import cluster = require('cluster');
import parseArgv from './utils/parseArgv';
import { Event } from './services/event';
require('heapdump');
let args = parseArgv([], ['DEBUG']);
const services: Array<any> = [];

process.on('unhandledRejection', error => {
  console.error('Unhandled Rejection at:', error.stack || error);
  stop();
});

const start = async () => {
  services.push(Storage, Event);
  if (cluster.isMaster) {
    services.push(P2P);
    services.push(Worker);
    if (args.DEBUG) {
      services.push(Api);
    }
  } else {
    if (!args.DEBUG) {
      services.push(Api);
    }
  }
  for (const service of services) {
    await service.start();
  }
};

const stop = async () => {
  console.log(`Shutting down ${process.pid}`);
  for (const service of services.reverse()) {
    await service.stop();
  }
  process.exit();
};

process.on('SIGTERM', stop);
process.on('SIGINT', stop);

start();
