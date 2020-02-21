import cluster from 'cluster';
import { EventEmitter } from 'events';
import config from '../config';
import { LoggifyClass } from '../decorators/Loggify';
import logger from '../logger';
import { CallbackType } from '../types/Callback';
import { WorkerType } from '../types/Worker';
import parseArgv from '../utils/parseArgv';

let args = parseArgv([], ['DEBUG']);

@LoggifyClass
export class WorkerService extends EventEmitter {
  workers = new Array<{
    worker: cluster.Worker;
    active: boolean;
    started: Promise<any>;
  }>();

  async start() {
    if (cluster.isMaster) {
      logger.verbose(`Master ${process.pid} is running`);
      cluster.on('exit', (worker: WorkerType) => {
        logger.warn(`worker ${worker.process.pid} stopped`);
        process.kill(process.pid);
      });
      if (!args.DEBUG) {
        for (let worker = 0; worker < config.numWorkers; worker++) {
          let newWorker = cluster.fork();
          logger.verbose(`Starting worker number ${worker}`);
          newWorker.on('message', (msg: any) => {
            this.emit(msg.id, msg);
          });
          let started = new Promise(resolve => {
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
    var worker = this.workers.shift();
    if (worker) {
      this.workers.push(worker);
      var id = (Date.now() * Math.random()).toString();
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

export let Worker = new WorkerService();
