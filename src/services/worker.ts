import { CallbackType } from '../types/Callback';
import { WorkerType } from '../types/Worker';
import logger from '../logger';
import config from '../config';
import { LoggifyClass } from "../decorators/Loggify";
const cluster = require('cluster');
const { EventEmitter } = require('events');

@LoggifyClass
export class WorkerService extends EventEmitter {
  workers = new Array<{ worker: WorkerType; active: boolean, started: Promise<any> }>();

  async start() {
    return new Promise(async resolve => {
      if (cluster.isMaster) {
        logger.verbose(`Master ${process.pid} is running`);
        cluster.on('exit', (worker: WorkerType) => {
          logger.error(`worker ${worker.process.pid} died`);
        });
        for (let worker = 0; worker < config.numWorkers; worker++) {
          let newWorker = cluster.fork();
          newWorker.on('message', (msg: any) => {
            this.emit(msg.id, msg);
          });
          let started = new Promise(resolve => {
            newWorker.on('listening', resolve);
          });
          this.workers.push({ worker: newWorker, active: false, started });
        }
        await Promise.all(this.workers.map(worker => worker.started));
        resolve();
      }
      if (cluster.isWorker) {
        logger.verbose(`Worker ${process.pid} started`);
        resolve();
      }
    });
  }

  stop() {}

  sendTask(task: any, argument: any, done: CallbackType) {
    var worker = this.workers.shift();
    if (worker) {
      this.workers.push(worker);
      var id = (Date.now() * Math.random()).toString();
      this.once(id, function(result: { error: any }) {
        done(result.error);
      });
      worker.worker.send({ task: task, argument: argument, id: id });
    }
  }

  workerCount() {
    return this.workers.length;
  }
}

export let Worker = new WorkerService();
