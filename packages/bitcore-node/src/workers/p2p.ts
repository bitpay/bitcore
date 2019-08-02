import { P2P } from '../services/p2p';
import { Storage } from '../services/storage';
import { Event } from '../services/event';
import '../utils/polyfills';
require('heapdump');
const services: Array<any> = [];

export const P2pWorker = async () => {
  process.on('unhandledRejection', error => {
    console.error('Unhandled Rejection at:', error.stack || error);
    stop();
  });
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  services.push(Storage, Event, P2P);
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
  P2pWorker();
}
