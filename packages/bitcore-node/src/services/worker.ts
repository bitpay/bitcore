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
    workerId: number;
    restartCount: number;
  }>();
  
  private shuttingDown = false;

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
          newWorker.on('exit', (code, signal) => {
            const exitReason = code !== 0 || signal ? 'crashed' : 'stopped gracefully';
            logger[code == 0 ? 'info' : 'error'](
              `Worker ${newWorker.process.pid} ${exitReason} (code: ${code}, signal: ${signal})`
            );
            
            const workerIndex = this.workers.findIndex(w => w.worker === newWorker);
            if (workerIndex > -1) {
              const workerData = this.workers[workerIndex];
              this.workers.splice(workerIndex, 1);
              
              if ((code !== 0 || signal) && !this.shuttingDown) {
                logger.info(`Scheduling worker ${workerData.workerId} restart in 5 seconds...`);
                setTimeout(() => {
                  this.restartWorker(workerData.workerId, workerData.restartCount + 1);
                }, 5 * 1000);
              }
            }
          });
          const started = new Promise<void>(resolve => {
            newWorker.on('listening', () => {
              resolve();
            });
          });
          this.workers.push({ 
            worker: newWorker, 
            active: false, 
            started,
            workerId: worker,
            restartCount: 0
          });
        }
      }
      const startedPromises = this.workers.map(worker => worker.started);
      return Promise.all(startedPromises);
    } else {
      logger.verbose(`Worker ${process.pid} started`);
      return;
    }
  }

  async stop() {
    this.shuttingDown = true;
    
    // Disconnect all workers gracefully
    for (const workerData of this.workers) {
      if (workerData.worker.isConnected()) {
        workerData.worker.disconnect();
      }
    }
  }
  
  private restartWorker(workerId: number, restartCount: number) {
    if (this.shuttingDown) {
      logger.info(`Not restarting worker ${workerId} - service is shutting down`);
      return;
    }
    
    logger.info(`Restarting worker ${workerId} (restart #${restartCount})`);
    const newWorker = cluster.fork();
    
    newWorker.on('message', (msg: any) => {
      this.emit(msg.id, msg);
    });
    
    newWorker.on('exit', (code, signal) => {
      const exitReason = code !== 0 || signal ? 'crashed' : 'stopped gracefully';
      logger[code == 0 ? 'info' : 'error'](
        `Worker ${newWorker.process.pid} ${exitReason} (code: ${code}, signal: ${signal})`
      );
      
      const workerIndex = this.workers.findIndex(w => w.worker === newWorker);
      if (workerIndex > -1) {
        const workerData = this.workers[workerIndex];
        this.workers.splice(workerIndex, 1);
        
        if ((code !== 0 || signal) && !this.shuttingDown) {
          logger.info(`Scheduling worker ${workerData.workerId} restart in 5 seconds...`);
          setTimeout(() => {
            this.restartWorker(workerData.workerId, workerData.restartCount + 1);
          }, 5 * 1000);
        }
      }
    });
    
    const started = new Promise<void>(resolve => {
      newWorker.on('listening', () => {
        logger.info(`Worker ${workerId} successfully restarted (pid: ${newWorker.process.pid})`);
        resolve();
      });
    });
    
    this.workers.push({ 
      worker: newWorker, 
      active: false, 
      started,
      workerId,
      restartCount
    });
  }

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
