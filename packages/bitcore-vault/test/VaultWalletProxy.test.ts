/* eslint-disable @typescript-eslint/no-require-imports */
import { expect } from 'chai';
import * as sinon from 'sinon';
import { VaultWalletProxy } from '../src/VaultWalletProxy';

describe('VaultWalletProxy', function() {
  // Increase timeout for tests that involve process forking
  this.timeout(10000);

  describe('Initialization & Lifecycle', function() {
    let vwp: VaultWalletProxy;
    let mockChildProcess: any;
    let forkStub: sinon.SinonStub;
    let testPublicKey: string;

    before(function() {
      // Generate a test RSA public key once for all tests
      const crypto = require('crypto');
      const { publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });
      testPublicKey = publicKey.export({ type: 'spki', format: 'pem' });
    });

    beforeEach(function() {
      // Create mock child process
      mockChildProcess = createMockChildProcess();

      // Stub fork to return our mock
      forkStub = sinon.stub(require('child_process'), 'fork');
      forkStub.returns(mockChildProcess);

      // Reset proxy
      vwp = null as any;
    });

    afterEach(function() {
      // Clean up after each test
      if (vwp) {
        try {
          vwp.terminate();
        } catch (err) {
          // Ignore cleanup errors
        }
      }
      sinon.restore();
    });

    /**
     * Helper to simulate successful initialization responses from child process
     */
    async function simulateSuccessfulInit() {
      // Wait for process to be forked and event handlers to be attached
      await new Promise(resolve => setImmediate(resolve));

      // Get the message handler
      const messageHandler = mockChildProcess.on.getCalls().find(
        call => call.args[0] === 'message'
      )?.args[1];

      if (messageHandler) {
        // Simulate 'initialize' response
        const initCall = mockChildProcess.send.getCall(0);
        messageHandler({ messageId: initCall.args[0].messageId, result: undefined });

        await new Promise(resolve => setImmediate(resolve));

        // Simulate 'getPublicKey' response
        const keyCall = mockChildProcess.send.getCall(1);
        messageHandler({ messageId: keyCall.args[0].messageId, result: testPublicKey });
      }
    }

    it('should successfully initialize, fork SecureProcess, and obtain public key', async function() {
      vwp = new VaultWalletProxy();

      // Start initialization
      const initPromise = vwp.initialize();

      // Simulate successful initialization
      await simulateSuccessfulInit();

      await initPromise;

      // Verify initialization succeeded
      expect(forkStub.calledOnce).to.be.true;
      expect(mockChildProcess.on.calledWith('message')).to.be.true;
      expect(mockChildProcess.on.calledWith('error')).to.be.true;
      expect(mockChildProcess.on.calledWith('exit')).to.be.true;
      expect(mockChildProcess.send.callCount).to.equal(2); // initialize & getPublicKey
    });

    it('should be idempotent - calling initialize() multiple times should reuse existing initialization', async function() {
      vwp = new VaultWalletProxy();

      // First initialization
      const initPromise1 = vwp.initialize();

      // Immediately call initialize again
      const initPromise2 = vwp.initialize();
      const initPromise3 = vwp.initialize();

      // Simulate successful initialization
      await simulateSuccessfulInit();

      await Promise.all([initPromise1, initPromise2, initPromise3]);

      // Verify fork was only called once
      expect(forkStub.callCount).to.equal(1);
    });

    it('should handle initialization failure when SecureProcess fails to start', async function() {
      vwp = new VaultWalletProxy();

      const initPromise = vwp.initialize();

      await new Promise(resolve => setImmediate(resolve));

      // Simulate child process error
      const errorHandler = mockChildProcess.on.getCalls().find(
        call => call.args[0] === 'error'
      )?.args[1];

      if (errorHandler) {
        errorHandler(new Error('Failed to start secure process'));
      }

      try {
        await initPromise;
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.message).to.include('SecureProcess error');
      }
    });

    it('should reject all pending messages when child process crashes', async function() {
      vwp = new VaultWalletProxy({ exitOnChildFailure: false });

      // Initialize successfully first
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Start a wallet load operation that won't complete
      const loadPromise = vwp.loadWallet({ name: 'test-wallet' });

      // Simulate child process crash
      const exitHandler = mockChildProcess.on.getCalls().find(
        call => call.args[0] === 'exit'
      )?.args[1];

      if (exitHandler) {
        exitHandler(1, null);
      }

      try {
        await loadPromise;
        expect.fail('Should have rejected the pending message');
      } catch (err: any) {
        expect(err.message).to.include('SecureProcess exited');
      }
    });

    it('should terminate child process and clean up resources', async function() {
      vwp = new VaultWalletProxy();

      // Initialize
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Terminate
      vwp.terminate();

      // Verify kill was called
      expect(mockChildProcess.kill.calledOnce).to.be.true;
    });

    it('should exit parent process when exitOnChildFailure=true and child crashes', async function() {
      vwp = new VaultWalletProxy({ exitOnChildFailure: true });

      // Stub process.exit to prevent actual exit
      const exitStub = sinon.stub(process, 'exit');

      // Initialize
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Simulate child crash
      const exitHandler = mockChildProcess.on.getCalls().find(
        call => call.args[0] === 'exit'
      )?.args[1];

      if (exitHandler) {
        exitHandler(1, null);
      }

      // Give time for exit handler to execute
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify process.exit was called with code 1
      expect(exitStub.calledWith(1)).to.be.true;
    });

    it('should not exit parent process when exitOnChildFailure=false and child crashes', async function() {
      vwp = new VaultWalletProxy({ exitOnChildFailure: false });

      // Stub process.exit to detect if it's called
      const exitStub = sinon.stub(process, 'exit');

      // Initialize
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Simulate child crash
      const exitHandler = mockChildProcess.on.getCalls().find(
        call => call.args[0] === 'exit'
      )?.args[1];

      if (exitHandler) {
        exitHandler(1, null);
      }

      // Give time for exit handler to execute
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify process.exit was NOT called
      expect(exitStub.called).to.be.false;
    });
  });
});

/**
 * Helper function to create a mock child process with stubbed methods
 */
function createMockChildProcess(): any {
  const mock = {
    on: sinon.stub().returnsThis(),
    send: sinon.stub().returns(true),
    kill: sinon.stub().returns(true),
    killed: false,
    stdout: null,
    stderr: null,
    stdin: null,
  };

  return mock;
}
