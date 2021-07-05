import cluster = require('cluster');
import 'source-map-support/register';
import { Modules } from '../modules';
import { Api } from '../services/api';
import { Event } from '../services/event';
import { Storage } from '../services/storage';
import { Worker } from '../services/worker';
import parseArgv from '../utils/parseArgv';
import '../utils/polyfills';

let args = parseArgv([], ['DEBUG', 'CLUSTER']);
const services: Array<any> = [];

export const ClusteredApiWorker = async () => {
  process.on('unhandledRejection', error => {
    console.error('Unhandled Rejection at:', error.stack || error);
    stop();
  });
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  services.push(Storage, Event);
  if (cluster.isMaster) {
    if (args.DEBUG || !args.CLUSTER) {
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
  ClusteredApiWorker();
}
