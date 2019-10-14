import { Storage } from '../services/storage';
import { Event } from '../services/event';
import { Pruning } from '../services/pruning';
import '../utils/polyfills';
import 'source-map-support/register'
require('heapdump');
const services: Array<any> = [];

export const PruningWorker = async () => {
  process.on('unhandledRejection', error => {
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

const stop = async () => {
  console.log(`Shutting down ${process.pid}`);
  for (const service of services.reverse()) {
    await service.stop();
  }
  process.exit();
};

if (require.main === module) {
  PruningWorker();
}
