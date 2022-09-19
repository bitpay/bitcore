import * as worker from 'worker_threads';
import { SyncWorker } from '../../ethereum/p2p/syncWorker';

class MaticSyncWorker extends SyncWorker {}

worker.parentPort!.once('message', async function(msg) {
  if (msg.message !== 'start') {
    throw new Error('Unknown startup message');
  }
  await new MaticSyncWorker().start();
  return worker.parentPort!.postMessage({ message: 'ready' });
});
