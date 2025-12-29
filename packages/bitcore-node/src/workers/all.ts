import cluster from 'cluster';
import 'source-map-support/register';
import fs from 'fs';
import logger from '../logger';
import { Modules } from '../modules';
import { Api } from '../services/api';
import { Event } from '../services/event';
import { P2P } from '../services/p2p';
import { Storage } from '../services/storage';
import { Worker } from '../services/worker';
import parseArgv from '../utils/parseArgv';
import '../utils/polyfills';

const args = parseArgv([], [{ arg: 'DEBUG', type: 'bool' }]);
const services: Array<any> = [];

export const FullClusteredWorker = async () => {
  process.on('unhandledRejection', (error: any) => {
    console.error('Unhandled Rejection at:', error.stack || error);
    stop();
  });
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  services.push(Storage, Event);
  if (cluster.isPrimary) {
    fs.mkdirSync('pids', { recursive: true });
    fs.writeFileSync('pids/all.pid', String(process.pid));
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

let stopping = false;
const stop = async () => {
  if (stopping) {
    logger.error('Force stopping all workers');
    process.exit(1);
  }
  stopping = true;

  if (cluster.isPrimary) {
    fs.unlinkSync('pids/all.pid');
  }

  setTimeout(() => {
    logger.error('All workers did not shut down gracefully after 30 seconds, exiting');
    process.exit(1);
  }, 30 * 1000).unref();


  logger.info(`Shutting down ${cluster.isPrimary ? 'primary' : 'worker'} process ${process.pid}`);
  for (const service of services.reverse()) {
    await service.stop();
  }

  if (!cluster.isPrimary) {
    process.removeAllListeners();
  }
};

if (require.main === module) {
  FullClusteredWorker();
}
