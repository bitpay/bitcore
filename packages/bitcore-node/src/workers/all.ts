import cluster from 'cluster';
import 'source-map-support/register';
import logger from '../logger';
import { loadModules } from '../modules';
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
  // A cluster.fork()ed worker re-execs this same file; its own top-level
  // imports above already ran before this function is ever invoked. The
  // worker's own startup -- Storage/Event/Api, loadModules(), the
  // service-start loop, and the shutdown handlers that reference those
  // instances -- now lives in api-worker-payload.ts (shared with
  // workers/api.ts's worker branch, since both are functionally identical),
  // so it can become runLava()'s entryPath (not yet wired -- see that
  // file's header comment for why the module boundary itself is the
  // point). Delegate to it, and return before this primary-only preamble
  // (which would otherwise also register its own, redundant
  // SIGTERM/SIGINT/unhandledRejection handlers and stop() for this worker
  // process).
  if (!cluster.isPrimary) {
    const { ApiWorkerPayload } = require('./api-worker-payload');
    return ApiWorkerPayload();
  }

  process.on('unhandledRejection', (error: any) => {
    console.error('Unhandled Rejection at:', error.stack || error);
    stop();
  });
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  services.push(Storage, Event);
  services.push(P2P);
  if (args.DEBUG) {
    services.push(Api);
  } else {
    services.push(Worker);
  }

  loadModules();

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
