import cluster, { Worker as ClusterWorker } from 'cluster';
import { EventEmitter } from 'events';
import config from '../config';
import { LoggifyClass } from '../decorators/Loggify';
import logger from '../logger';
import { CallbackType } from '../types/Callback';
import parseArgv from '../utils/parseArgv';

const args = parseArgv([], [{ arg: 'DEBUG', type: 'bool' }]);

@LoggifyClass
export class WorkerService extends EventEmitter {
  workers = new Array<{
    worker: ClusterWorker;
    active: boolean;
    started: Promise<any>;
  }>();

  async start() {
    if (cluster.isPrimary) {
      logger.verbose(`Master ${process.pid} is running`);
      if (!args.DEBUG) {
        for (let worker = 0; worker < config.numWorkers; worker++) {
          const newWorker = cluster.fork();
          logger.verbose(`Starting worker number ${worker}`);
          newWorker.on('message', (msg: any) => {
            this.emit(msg.id, msg);
          });
          newWorker.on('exit', (code, _signal) => {
            logger[code == 0 ? 'info' : 'warn'](`Worker ${newWorker.process.pid} stopped with code ${code}`);
          });
          const started = new Promise<void>(resolve => {
            newWorker.on('listening', () => {
              resolve();
            });
          });
          this.workers.push({ worker: newWorker, active: false, started });
        }
      }
      const startedPromises = this.workers.map(worker => worker.started);
      return Promise.all(startedPromises);
    } else {
      logger.verbose(`Worker ${process.pid} started`);
      return;
    }
  }

  async stop() {}

  sendTask(task: any, argument: any, done: CallbackType) {
    const worker = this.workers.shift();
    if (worker) {
      this.workers.push(worker);
      const id = (Date.now() * Math.random()).toString();
      this.once(id, function(result: { error: any }) {
        done(result.error);
      });
      worker.worker.send({ task, argument, id });
    }
  }

  workerCount() {
    return this.workers.length;
  }
}

export const Worker = new WorkerService();
