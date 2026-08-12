import cluster from 'cluster';
import 'source-map-support/register';
import logger from '../logger';
import { loadModules } from '../modules';
import { Api } from '../services/api';
import { Event } from '../services/event';
import { Storage } from '../services/storage';
import { Worker } from '../services/worker';
import parseArgv from '../utils/parseArgv';
import '../utils/polyfills';

const args = parseArgv([], [{ arg: 'DEBUG', type: 'bool' }, { arg: 'CLUSTER', type: 'bool' }]);
const services: Array<any> = [];

function sesSignal() {
  return {
    hasHarden: typeof (globalThis as any).harden === 'function',
    hasLockdown: typeof (globalThis as any).lockdown === 'function',
    hasCompartment: typeof (globalThis as any).Compartment === 'function',
    objectProtoFrozen: Object.isFrozen(Object.prototype),
    canAddPropToObjectProto: Object.isExtensible(Object.prototype)
  };
}

export const ClusteredApiWorker = async () => {
  process.on('unhandledRejection', (error: any) => {
    console.error('Unhandled Rejection at:', error.stack || error);
    stop();
  });
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  services.push(Storage, Event);
  if (cluster.isPrimary) {
    if (args.DEBUG || !args.CLUSTER) {
      services.push(Api);
    } else {
      services.push(Worker);
    }
  } else {
    logger.info(`LAVAMOAT_WORKER_SES_SIGNAL ${JSON.stringify(sesSignal())}`);
    services.push(Api);
  }

  loadModules();

  for (const service of services) {
    await service.start();
  }
};

let stopping = false;
const stop = async () => {
  if (stopping) {
    logger.warn('Force stopping API Worker');
    process.exit(1);
  }
  stopping = true;

  setTimeout(() => {
    logger.warn('API Worker did not shut down gracefully after 30 seconds, exiting');
    process.exit(1);
  }, 30 * 1000).unref();


  logger.error(`Shutting down API ${process.pid}`);
  for (const service of services.reverse()) {
    await service.stop();
  }

  if (!cluster.isPrimary) {
    process.removeAllListeners();
  }
};

if (require.main === module) {
  ClusteredApiWorker();
}
