import { expect } from 'chai';
import { EventEmitter } from 'events';
import * as sinon from 'sinon';
import cluster from 'cluster';
import config from '../../../src/config';
import logger from '../../../src/logger';
import { Worker } from '../../../src/services/worker';
import { unitAfterHelper, unitBeforeHelper } from '../../helpers/unit';

describe('Worker Service', function() {
  before(unitBeforeHelper);
  after(unitAfterHelper);

  describe('Worker Restart on Crash', function() {
    let sandbox: sinon.SinonSandbox;
    let clock: sinon.SinonFakeTimers;
    let mockWorkers: any[];
    let forkStub: sinon.SinonStub;
    let loggerStubs: any;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      clock = sandbox.useFakeTimers({ shouldAdvanceTime: true });
      mockWorkers = [];
      
      // Stub logger methods
      loggerStubs = {
        verbose: sandbox.stub(logger, 'verbose'),
        info: sandbox.stub(logger, 'info'),
        error: sandbox.stub(logger, 'error'),
        warn: sandbox.stub(logger, 'warn')
      };
      
      // Stub cluster module
      sandbox.stub(cluster, 'isPrimary').value(true);
      forkStub = sandbox.stub(cluster, 'fork').callsFake(() => {
        const mockWorker = createMockWorker();
        mockWorkers.push(mockWorker);
        // Emit listening on next tick (but before fake timers block it)
        Promise.resolve().then(() => mockWorker.emit('listening'));
        return mockWorker;
      });
      
      // Mock config.numWorkers
      sandbox.stub(config, 'numWorkers').value(3);
      
      // Clear the Worker service's internal state
      (Worker as any).workers = [];
      (Worker as any).shuttingDown = false;
    });

    afterEach(() => {
      sandbox.restore();
    });

    // Helper function to create mock workers
    function createMockWorker() {
      const worker = new EventEmitter() as any;
      worker.process = { pid: Math.floor(Math.random() * 10000) + 10000 };
      worker.isConnected = () => true;
      worker.disconnect = sandbox.stub();
      return worker;
    }

    it('should restart worker after 5 seconds on abnormal exit (non-zero code)', async () => {
      await Worker.start();
      
      const initialWorkerCount = forkStub.callCount;
      expect(initialWorkerCount).to.equal(3);
      
      const crashedWorker = mockWorkers[0];
      const crashedPid = crashedWorker.process.pid;
      
      // Simulate worker crash
      crashedWorker.emit('exit', 1, null);
      
      // Verify immediate state
      expect(loggerStubs.error.calledWith(sinon.match(`Worker ${crashedPid} crashed`))).to.be.true;
      expect(loggerStubs.info.calledWith(sinon.match('Scheduling worker 0 restart in 5 seconds'))).to.be.true;
      expect(forkStub.callCount).to.equal(initialWorkerCount); // Not restarted yet
      
      // Advance time but not quite 5 seconds
      clock.tick(4999);
      expect(forkStub.callCount).to.equal(initialWorkerCount); // Still not restarted
      
      // Advance to exactly 5 seconds
      clock.tick(1);
      expect(forkStub.callCount).to.equal(initialWorkerCount + 1); // Now restarted
      expect(loggerStubs.warn.calledWith(sinon.match('Restarting worker 0 (restart #1)'))).to.be.true;
      
      // Verify the new worker has workerId 0
      const restartedWorker = mockWorkers[mockWorkers.length - 1];
      restartedWorker.emit('listening');
      expect(loggerStubs.info.calledWith(sinon.match(`Worker 0 successfully restarted (pid: ${restartedWorker.process.pid})`))).to.be.true;
    });

    it('should restart on signal-terminated exit', async () => {
      await Worker.start();
      
      const initialWorkerCount = forkStub.callCount;
      const crashedWorker = mockWorkers[0];
      
      // Simulate worker killed by signal
      crashedWorker.emit('exit', null, 'SIGKILL');
      
      expect(loggerStubs.error.calledWith(sinon.match('crashed'))).to.be.true;
      expect(loggerStubs.info.calledWith(sinon.match('Scheduling worker 0 restart in 5 seconds'))).to.be.true;
      
      // Advance 5 seconds
      clock.tick(5000);
      expect(forkStub.callCount).to.equal(initialWorkerCount + 1);
    });

    it('should NOT restart on graceful exit (code 0)', async () => {
      await Worker.start();
      
      const initialWorkerCount = forkStub.callCount;
      const exitedWorker = mockWorkers[0];
      
      // Simulate graceful exit
      exitedWorker.emit('exit', 0, null);
      
      expect(loggerStubs.info.calledWith(sinon.match('stopped gracefully'))).to.be.true;
      
      // Advance time well past 5 seconds
      clock.tick(10000);
      
      // Should NOT have restarted
      expect(forkStub.callCount).to.equal(initialWorkerCount);
      expect(loggerStubs.info.calledWith(sinon.match('Scheduling'))).to.be.false;
    });

    it('should NOT restart during shutdown', async () => {
      await Worker.start();
      
      const initialWorkerCount = forkStub.callCount;
      
      // Initiate shutdown
      await Worker.stop();
      expect((Worker as any).shuttingDown).to.be.true;
      
      // Simulate worker crash after shutdown initiated
      const crashedWorker = mockWorkers[0];
      crashedWorker.emit('exit', 1, null);
      
      // Advance time
      clock.tick(5000);
      
      // Should NOT have restarted
      expect(forkStub.callCount).to.equal(initialWorkerCount);
      expect(loggerStubs.info.calledWith(sinon.match('Not restarting worker'))).to.be.false;
    });

    it('should increment restart count correctly', async () => {
      await Worker.start();
      
      // First crash
      mockWorkers[0].emit('exit', 1, null);
      clock.tick(5000);
      expect(loggerStubs.warn.calledWith(sinon.match('restart #1'))).to.be.true;
      
      // Get the restarted worker and crash it again
      const restartedWorker1 = mockWorkers[mockWorkers.length - 1];
      restartedWorker1.emit('listening');
      restartedWorker1.emit('exit', 1, null);
      clock.tick(5000);
      expect(loggerStubs.warn.calledWith(sinon.match('restart #2'))).to.be.true;
      
      // Crash again
      const restartedWorker2 = mockWorkers[mockWorkers.length - 1];
      restartedWorker2.emit('listening');
      restartedWorker2.emit('exit', 1, null);
      clock.tick(5000);
      expect(loggerStubs.warn.calledWith(sinon.match('restart #3'))).to.be.true;
    });

    it('should preserve worker ID across restarts', async () => {
      await Worker.start();
      
      // Crash worker 1 (middle worker)
      const crashedWorker = mockWorkers[1];
      crashedWorker.emit('exit', 1, null);
      
      // Advance timer
      clock.tick(5000);
      
      // Verify restart message mentions worker 1, not worker 3
      expect(loggerStubs.warn.calledWith(sinon.match('Restarting worker 1'))).to.be.true;
      
      // Trigger listening event
      const restartedWorker = mockWorkers[mockWorkers.length - 1];
      restartedWorker.emit('listening');
      expect(loggerStubs.info.calledWith(sinon.match('Worker 1 successfully restarted'))).to.be.true;
    });

    it('should restart multiple workers independently', async () => {
      await Worker.start();
      
      const initialWorkerCount = forkStub.callCount;
      
      // Crash worker 0 at t=0
      mockWorkers[0].emit('exit', 1, null);
      
      // Crash worker 2 at t=2000ms
      clock.tick(2000);
      mockWorkers[2].emit('exit', 1, null);
      
      // Advance to t=5000ms - worker 0 should restart
      clock.tick(3000);
      expect(forkStub.callCount).to.equal(initialWorkerCount + 1);
      expect(loggerStubs.warn.calledWith(sinon.match('Restarting worker 0'))).to.be.true;
      
      // Worker 2 shouldn't have restarted yet
      expect(loggerStubs.warn.calledWith(sinon.match('Restarting worker 2'))).to.be.false;
      
      // Advance to t=7000ms - worker 2 should restart
      clock.tick(2000);
      expect(forkStub.callCount).to.equal(initialWorkerCount + 2);
      expect(loggerStubs.warn.calledWith(sinon.match('Restarting worker 2'))).to.be.true;
    });

    it('should re-attach event handlers on restart', async () => {
      await Worker.start();
      
      // Crash a worker
      mockWorkers[0].emit('exit', 1, null);
      clock.tick(5000);
      
      // Get the restarted worker
      const restartedWorker = mockWorkers[mockWorkers.length - 1];
      
      // Verify it has event listeners
      expect(restartedWorker.listenerCount('exit')).to.be.greaterThan(0);
      expect(restartedWorker.listenerCount('message')).to.be.greaterThan(0);
      expect(restartedWorker.listenerCount('listening')).to.be.greaterThan(0);
      
      // Test that exit handler still works
      restartedWorker.emit('listening');
      restartedWorker.emit('exit', 1, null);
      clock.tick(5000);
      
      // Should have restarted again
      expect(loggerStubs.warn.calledWith(sinon.match('restart #2'))).to.be.true;
    });

    it('should log restart information correctly', async () => {
      await Worker.start();
      
      const crashedWorker = mockWorkers[0];
      const crashedPid = crashedWorker.process.pid;
      
      // Crash the worker
      crashedWorker.emit('exit', 1, null);
      
      // Verify crash log
      expect(loggerStubs.error.calledWith(sinon.match(`Worker ${crashedPid} crashed (code: 1, signal: null)`))).to.be.true;
      
      // Verify scheduling log
      expect(loggerStubs.info.calledWith('Scheduling worker 0 restart in 5 seconds...')).to.be.true;
      
      // Advance timer
      clock.tick(5000);
      
      // Verify restart log
      expect(loggerStubs.warn.calledWith('Restarting worker 0 (restart #1)')).to.be.true;
      
      // Emit listening event
      const restartedWorker = mockWorkers[mockWorkers.length - 1];
      const newPid = restartedWorker.process.pid;
      restartedWorker.emit('listening');
      
      // Verify success log
      expect(loggerStubs.info.calledWith(`Worker 0 successfully restarted (pid: ${newPid})`)).to.be.true;
    });

    it('should disconnect all workers on stop()', async () => {
      await Worker.start();
      
      const worker0 = mockWorkers[0];
      const worker1 = mockWorkers[1];
      const worker2 = mockWorkers[2];
      
      // Call stop
      await Worker.stop();
      
      // Verify shuttingDown flag
      expect((Worker as any).shuttingDown).to.be.true;
      
      // Verify disconnect called on all workers
      expect(worker0.disconnect.called).to.be.true;
      expect(worker1.disconnect.called).to.be.true;
      expect(worker2.disconnect.called).to.be.true;
      
      // Verify no restarts happen after stop
      worker0.emit('exit', 1, null);
      clock.tick(5000);
      expect(forkStub.callCount).to.equal(3); // Still just the initial 3
    });

    it('should remove worker from array on exit', async () => {
      await Worker.start();
      
      // Initial count
      expect(Worker.workerCount()).to.equal(3);
      
      // Crash a worker
      mockWorkers[1].emit('exit', 1, null);
      
      // Should immediately be removed
      expect(Worker.workerCount()).to.equal(2);
      
      // Advance timer to restart
      clock.tick(5000);
      
      // After listening event, count should be back to 3
      const restartedWorker = mockWorkers[mockWorkers.length - 1];
      restartedWorker.emit('listening');
      
      expect(Worker.workerCount()).to.equal(3);
    });

    it('should restart on OOM (exit code 137)', async () => {
      await Worker.start();
      
      const initialWorkerCount = forkStub.callCount;
      
      // Simulate OOM
      mockWorkers[0].emit('exit', 137, null);
      
      expect(loggerStubs.error.calledWith(sinon.match('crashed'))).to.be.true;
      
      // Advance 5 seconds
      clock.tick(5000);
      
      expect(forkStub.callCount).to.equal(initialWorkerCount + 1);
      expect(loggerStubs.warn.calledWith(sinon.match('Restarting worker 0'))).to.be.true;
    });

    it('should restart on uncaught exception (exit code 1)', async () => {
      await Worker.start();
      
      const initialWorkerCount = forkStub.callCount;
      
      // Simulate uncaught exception
      mockWorkers[0].emit('exit', 1, null);
      
      expect(loggerStubs.error.calledWith(sinon.match('crashed'))).to.be.true;
      
      // Advance 5 seconds
      clock.tick(5000);
      
      expect(forkStub.callCount).to.equal(initialWorkerCount + 1);
      expect(loggerStubs.warn.calledWith(sinon.match('Restarting worker 0'))).to.be.true;
    });
  });
});
