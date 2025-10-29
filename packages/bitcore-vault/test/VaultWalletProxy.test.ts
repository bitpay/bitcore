/* eslint-disable @typescript-eslint/no-require-imports */
import { expect } from 'chai';
import * as sinon from 'sinon';
import { VaultWalletProxy } from '../src/VaultWalletProxy';

/**
 * VaultWalletProxy Test Suite
 *
 * This test suite uses a shared setup with hoisted helpers to minimize code duplication.
 * All describe blocks share the same beforeEach/afterEach hooks and helper functions.
 *
 * Shared State:
 * - vwp: VaultWalletProxy instance (reset before each test)
 * - mockChildProcess: Stubbed child process
 * - forkStub: Sinon stub for child_process.fork
 * - testPublicKey: RSA public key for encryption tests
 *
 * Helper Functions:
 * - simulateSuccessfulInit(): Simulates init + getPublicKey responses
 * - getMessageHandler/getExitHandler/getErrorHandler(): Extract event handlers from mock
 * - simulateResponse(action, result): Simulate successful IPC response
 * - simulateErrorResponse(action, message): Simulate error IPC response
 *
 * Use these helpers in new test sections to maintain consistency.
 */
describe('VaultWalletProxy', function() {
  // Increase timeout for tests that involve process forking
  this.timeout(10000);

  // Shared test state across all describe blocks
  let vwp: VaultWalletProxy;
  let mockChildProcess: any;
  let forkStub: sinon.SinonStub;
  let testPublicKey: string;

  /**
   * Generate a test RSA public key once for all tests
   */
  before(function() {
    const crypto = require('crypto');
    const { publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    testPublicKey = publicKey.export({ type: 'spki', format: 'pem' });
  });

  /**
   * Set up mock child process and stubs before each test
   */
  beforeEach(function() {
    // Create mock child process
    mockChildProcess = createMockChildProcess();

    // Stub fork to return our mock
    forkStub = sinon.stub(require('child_process'), 'fork');
    forkStub.returns(mockChildProcess);

    // Reset proxy
    vwp = null as any;
  });

  /**
   * Clean up after each test
   */
  afterEach(function() {
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
   * Helper to get the message handler from the mock child process
   */
  function getMessageHandler() {
    return mockChildProcess.on.getCalls().find(
      (call: any) => call.args[0] === 'message'
    )?.args[1];
  }

  /**
   * Helper to get the exit handler from the mock child process
   */
  function getExitHandler() {
    return mockChildProcess.on.getCalls().find(
      (call: any) => call.args[0] === 'exit'
    )?.args[1];
  }

  /**
   * Helper to get the error handler from the mock child process
   */
  function getErrorHandler() {
    return mockChildProcess.on.getCalls().find(
      (call: any) => call.args[0] === 'error'
    )?.args[1];
  }

  /**
   * Helper to simulate successful initialization responses from child process
   */
  async function simulateSuccessfulInit() {
    // Wait for process to be forked and event handlers to be attached
    await new Promise(resolve => setImmediate(resolve));

    const messageHandler = getMessageHandler();
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

  /**
   * Helper to simulate a successful response for a specific action
   */
  function simulateResponse(action: string, result: any) {
    const messageHandler = getMessageHandler();
    const call = mockChildProcess.send.getCalls().find(
      (c: any) => c.args[0].action === action
    );

    if (messageHandler && call) {
      messageHandler({
        messageId: call.args[0].messageId,
        result
      });
    }
  }

  /**
   * Helper to simulate an error response for a specific action
   */
  function simulateErrorResponse(action: string, errorMessage: string, stack?: string) {
    const messageHandler = getMessageHandler();
    const call = mockChildProcess.send.getCalls().find(
      (c: any) => c.args[0].action === action
    );

    if (messageHandler && call) {
      messageHandler({
        messageId: call.args[0].messageId,
        error: { message: errorMessage, stack }
      });
    }
  }

  describe('Initialization & Lifecycle', function() {

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
      const errorHandler = getErrorHandler();
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
      const exitHandler = getExitHandler();
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
      const exitHandler = getExitHandler();
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
      const exitHandler = getExitHandler();
      if (exitHandler) {
        exitHandler(1, null);
      }

      // Give time for exit handler to execute
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify process.exit was NOT called
      expect(exitStub.called).to.be.false;
    });
  });

  describe('IPC Communication Pattern', function() {

    it('should ignore responses with unknown messageIds', async function() {
      vwp = new VaultWalletProxy();

      // Initialize
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Send a response with a completely unknown messageId that doesn't match any pending request
      const messageHandler = getMessageHandler();
      if (messageHandler) {
        messageHandler({
          messageId: 'deadbeefdeadbeefdeadbeefdeadbeef',
          result: 'should-be-ignored'
        });
      }

      // Should not throw or crash - handleResponse should silently ignore unknown messageIds
      // This verifies the guard clause: if (pendingMessage) { ... }
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify the proxy is still functional after receiving unknown messageId
      const loadPromise = vwp.loadWallet({ name: 'test-wallet' });
      await new Promise(resolve => setImmediate(resolve));

      const simulatedAddress = 'bc1qtest123';
      simulateResponse('loadWallet', simulatedAddress);
      const address = await loadPromise;
      console.log('address', address);
      expect(address).to.equal(simulatedAddress);
    });

    it('should timeout requests after configured duration', async function() {
      vwp = new VaultWalletProxy();

      // Initialize
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Send a wallet load request with a short timeout (500ms)
      const loadPromise = vwp.loadWallet({ name: 'test-wallet', timeoutMs: 500 });

      // Don't send a response - let it timeout

      try {
        await loadPromise;
        expect.fail('Should have timed out');
      } catch (err: any) {
        expect(err.message).to.include('Request timeout after 500ms');
        expect(err.message).to.include('loadWallet');
      }
    });

    it('should handle multiple concurrent requests correctly', async function() {
      vwp = new VaultWalletProxy();

      // Initialize
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Define test wallets
      const walletNames = ['wallet1', 'wallet2', 'wallet3'];

      // Send multiple concurrent wallet load requests
      const walletPromises = walletNames.map(name => vwp.loadWallet({ name }));

      await new Promise(resolve => setImmediate(resolve));

      // Get all loadWallet calls
      const loadCalls = mockChildProcess.send.getCalls().filter(
        call => call.args[0].action === 'loadWallet'
      );

      expect(loadCalls).to.have.lengthOf(3);

      // Verify each has a unique messageId
      const messageIds = loadCalls.map((call: any) => call.args[0].messageId);
      const uniqueIds = new Set(messageIds);
      expect(uniqueIds.size).to.equal(3);

      // Simulate responses for each request in different order to test concurrency
      const messageHandler = getMessageHandler();
      if (messageHandler) {
        // Out of order
        for (const walletName of ['wallet2', 'wallet1', 'wallet3']) {
          const walletCall = loadCalls.find((call: any) => call.args[0].payload.name === walletName);
          messageHandler({
            messageId: walletCall!.args[0].messageId,
            result: `bc1q${walletName}`
          });
        }
      }

      // All promises should resolve correctly with their respective addresses
      const addresses = await Promise.all(walletPromises);

      // Verify results
      for (let i = 0; i < walletNames.length; i++) {
        const name = walletNames[i];
        expect(addresses[i]).to.equal(`bc1q${name}`); // Response from loadWallets is correct
        expect(vwp.walletAddresses.get(name)).to.equal(`bc1q${name}`); // Map value is correctly assigned
      }
    });

    it('should fail gracefully when sending requests after child process exits', async function() {
      vwp = new VaultWalletProxy({ exitOnChildFailure: false });

      // Initialize successfully first
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Simulate child process exit
      const exitHandler = getExitHandler();
      if (exitHandler) {
        exitHandler(1, null);
      }

      // Wait for exit handler to process
      await new Promise(resolve => setImmediate(resolve));

      // Try to send a request after child death
      try {
        await vwp.loadWallet({ name: 'test-wallet' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.message).to.include('Secure process not initialized');
      }
    });

    it('should trigger cleanup and termination when fatal error is received from child', async function() {
      vwp = new VaultWalletProxy({ exitOnChildFailure: false });

      // Initialize successfully first
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Send a request
      const loadPromise = vwp.loadWallet({ name: 'test-wallet' });

      await new Promise(resolve => setImmediate(resolve));

      // Get the messageId for the load request
      const loadCall = mockChildProcess.send.getCalls().find(
        (call: any) => call.args[0].action === 'loadWallet'
      );
      const messageId = loadCall!.args[0].messageId;

      // Simulate fatal error response from child
      const messageHandler = getMessageHandler();
      if (messageHandler) {
        messageHandler({
          messageId,
          error: { message: 'Security violation detected', stack: 'Error: Security violation detected\n  at ...' },
          fatalError: true
        });
      }

      // The original request should be rejected
      try {
        await loadPromise;
        expect.fail('Should have rejected the request');
      } catch (err: any) {
        expect(err.message).to.include('Security violation detected');
        expect(err.stack).to.exist;
      }

      // Wait a bit for async fatal error handling to start
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));

      // Verify cleanup was requested
      const cleanupCall = mockChildProcess.send.getCalls().find(
        (call: any) => call.args[0].action === 'cleanup'
      );
      expect(cleanupCall).to.exist;

      // Simulate cleanup timeout (fatal error handler waits 2000ms for cleanup)
      // The kill should happen after the cleanup timeout
      await new Promise(resolve => setTimeout(resolve, 2100));

      // Verify kill was called after cleanup timeout
      expect(mockChildProcess.kill.called).to.be.true;
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
