// WHY THIS FILE EXISTS: cluster.fork() re-execs the
// worker as plain `node <script>`, bypassing the `lavamoat` CLI entirely --
// no lockdown(), no policy-aware require, for anything that process does on
// its own. The fix is to have the worker call `runLava()` on itself
// (programmatic self-hardening), pointing it at this file as its
// `entryPath`. That only protects the module graph `runLava()` itself loads
// via `kernel.internalRequire()`; anything already `require()`-d by plain
// Node *before* that call -- e.g. a static top-level import in the same file
// that calls `runLava()` -- is already sitting in memory, unhardened, having
// never passed through a policy. So `Api`/`Storage`/`Event` cannot be
// imported by anything other than the module that IS `runLava()`'s
// `entryPath`, or they'd load before `runLava()` ever runs and the
// protection would be cosmetic -- lockdown() reporting "on" while the code
// that actually matters got a complete pass. That's the whole reason this
// worker-role logic lives in its own file instead of inline in
// workers/api.ts/all.ts's `else` branch.
//
// Not wired yet: the worker branch in workers/api.ts/all.ts currently
// requires and calls this file's export directly (plain `require()`, no
// `runLava()`) -- a deliberate, separate checkpoint. Until that lands, this
// split provides no additional protection by itself; it only sets up the
// file boundary `runLava()` needs to target.
import cluster from 'cluster';
import 'source-map-support/register';
import logger from '../logger';
import { loadModules } from '../modules';
import { Api } from '../services/api';
import { Event } from '../services/event';
import { Storage } from '../services/storage';

// Permanent, always-on SES-hardening diagnostic -- not test scaffolding. Every
// worker boot logs its own lockdown state through the ordinary logger so this
// is real production observability for whether cluster-forked workers are
// actually protected, not something that goes away if the test that reads it
// is removed. See sesSignal()'s definition for what each field means.
function sesSignal() {
  return {
    hasHarden: typeof (globalThis as any).harden === 'function',
    hasLockdown: typeof (globalThis as any).lockdown === 'function',
    hasCompartment: typeof (globalThis as any).Compartment === 'function',
    objectProtoFrozen: Object.isFrozen(Object.prototype),
    canAddPropToObjectProto: Object.isExtensible(Object.prototype)
  };
}

const services: Array<any> = [];

// Owns exactly what workers/api.ts's and workers/all.ts's worker (non-primary)
// branches used to own inline, before the extraction: the Storage/Event/Api
// startup, loadModules(), and the shutdown machinery below. Both dispatchers'
// worker branches are functionally identical -- Storage, Event, Api ->
// loadModules() -> start each service -- so this one file serves both.
export const ApiWorkerPayload = async () => {
  logger.info(`LAVAMOAT_WORKER_SES_SIGNAL ${JSON.stringify(sesSignal())}`);

  process.on('unhandledRejection', (error: any) => {
    console.error('Unhandled Rejection at:', error.stack || error);
    stop();
  });
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  services.push(Storage, Event, Api);

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
