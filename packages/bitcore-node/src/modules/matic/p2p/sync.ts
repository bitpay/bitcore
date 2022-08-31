import { Worker as Thread } from 'worker_threads';
import { MultiThreadSync } from '../../ethereum/p2p/sync';

export class MaticMultiThreadSync extends MultiThreadSync {

  getWorkerThread(workerData): Thread{
    return new Thread(__dirname + '/syncWorker.js', {
      workerData
    });
  }
  
}
