import 'source-map-support/register';
import logger from '../logger';
import { Event } from '../services/event';
import { Pruning } from '../services/pruning';
import { Storage } from '../services/storage';
import '../utils/polyfills';
require('heapdump');
const services: Array<any> = [];

export const PruningWorker = async () => {
  process.on('unhandledRejection', (error: any) => {
    console.error('Unhandled Rejection at:', error.stack || error);
    stop();
  });
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  services.push(Storage, Event, Pruning);
  for (const service of services) {
    await service.start();
  }
};

let stopping = false;
const stop = async () => {
  if (stopping) {
    logger.error('Force stopping Pruning Worker');
    process.exit(1);
  }
  stopping = true;

  logger.info(`Shutting down ${process.pid}`);
  for (const service of services.reverse()) {
    await service.stop();
  }
  setTimeout(() => {
    logger.error('Pruning Worker did not shut down gracefully after 30 seconds, exiting');
    process.exit(1);
  }, 30 * 1000).unref();
};

if (require.main === module) {
  PruningWorker();
}
