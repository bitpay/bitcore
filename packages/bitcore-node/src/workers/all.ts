import cluster = require('cluster');
import 'source-map-support/register';
import { Modules } from '../modules';
import { Api } from '../services/api';
import { Event } from '../services/event';
import { P2P } from '../services/p2p';
import { Storage } from '../services/storage';
import { Worker } from '../services/worker';
import parseArgv from '../utils/parseArgv';
import '../utils/polyfills';
require('heapdump');
let args = parseArgv([], ['DEBUG']);
const services: Array<any> = [];

export const FullClusteredWorker = async () => {
  process.on('unhandledRejection', error => {
    console.error('Unhandled Rejection at:', error.stack || error);
    stop();
  });
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  services.push(Storage, Event);
  if (cluster.isMaster) {
    services.push(P2P);
    if (args.DEBUG) {
      services.push(Api);
    } else {
      services.push(Worker);
    }
  } else {
    services.push(Api);
  }

  Modules.loadConfigured();

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

if (require.main === module) {
  FullClusteredWorker();
}
