import { CallbackType } from '../types/Callback';
import { WorkerType } from '../types/Worker';
import logger from '../logger';
import config from '../config';
import { LoggifyClass } from "../decorators/Loggify";
const cluster = require('cluster');
const { EventEmitter } = require('events');
const async = require('async');

@LoggifyClass
export class WorkerService extends EventEmitter {
  workers = new Array<{ worker: WorkerType; active: boolean }>();

  start(ready: CallbackType) {
    var self = this;
    if (cluster.isMaster) {
      logger.verbose(`Master ${process.pid} is running`);
      cluster.on('exit', function(worker: WorkerType) {
        logger.error(`worker ${worker.process.pid} died`);
      });
      async.times(
        config.numWorkers,
        function(n: any, cb: CallbackType) {
          var newWorker = cluster.fork();
          newWorker.on('message', function(msg: any) {
            self.emit(msg.id, msg);
          });
          self.workers.push({ worker: newWorker, active: false });
          setTimeout(cb, 3000);
        },
        function() {
          ready();
        }
      );
    }
    if (cluster.isWorker) {
      logger.verbose(`Worker ${process.pid} started`);
      setImmediate(ready);
    }
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
