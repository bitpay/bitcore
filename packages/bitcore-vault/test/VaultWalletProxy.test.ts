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

      // Verify message correlation worked correctly - each promise got the right result
      for (let i = 0; i < walletNames.length; i++) {
        const name = walletNames[i];
        expect(addresses[i]).to.equal(`bc1q${name}`);
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

  describe('Wallet Operations', function() {

    it('should successfully load a wallet and store address in walletAddresses map', async function() {
      vwp = new VaultWalletProxy();

      // Initialize
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Load wallet
      const walletName = 'my-test-wallet';
      const expectedAddress = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';

      const loadPromise = vwp.loadWallet({ name: walletName });

      await new Promise(resolve => setImmediate(resolve));

      // Simulate successful response with address
      simulateResponse('loadWallet', expectedAddress);

      const returnedAddress = await loadPromise;

      // Verify the address is returned
      expect(returnedAddress).to.equal(expectedAddress);

      // Verify the address is stored in the walletAddresses map
      expect(vwp.walletAddresses.has(walletName)).to.be.true;
      expect(vwp.walletAddresses.get(walletName)).to.equal(expectedAddress);

      // Verify correct IPC message was sent
      const loadCall = mockChildProcess.send.getCalls().find(
        (call: any) => call.args[0].action === 'loadWallet'
      );
      expect(loadCall).to.exist;
      expect(loadCall!.args[0].payload.name).to.equal(walletName);
      expect(loadCall!.args[0].payload.storageType).to.equal('Level');
    });

    it('should handle wallet load failure when wallet does not exist', async function() {
      vwp = new VaultWalletProxy();

      // Initialize
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Attempt to load non-existent wallet
      const walletName = 'non-existent-wallet';
      const loadPromise = vwp.loadWallet({ name: walletName });

      await new Promise(resolve => setImmediate(resolve));

      // Simulate error response from SecureProcess
      simulateErrorResponse('loadWallet', 'Wallet not found: non-existent-wallet');

      try {
        await loadPromise;
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.message).to.include('Wallet not found');
        expect(err.message).to.include('non-existent-wallet');
      }

      // Verify wallet was NOT added to walletAddresses map
      expect(vwp.walletAddresses.has(walletName)).to.be.false;
    });

    it('should load multiple wallets simultaneously with different addresses', async function() {
      vwp = new VaultWalletProxy();

      // Initialize
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Define multiple wallets with their addresses
      const wallets = [
        { name: 'wallet-alice', address: 'bc1qalice111111111111111111111111111' },
        { name: 'wallet-bob', address: 'bc1qbob222222222222222222222222222' },
        { name: 'wallet-charlie', address: 'bc1qcharlie333333333333333333333333' },
      ];

      // Load all wallets concurrently
      const loadPromises = wallets.map(w => vwp.loadWallet({ name: w.name }));

      await new Promise(resolve => setImmediate(resolve));

      // Simulate responses for each wallet
      const messageHandler = getMessageHandler();
      const loadCalls = mockChildProcess.send.getCalls().filter(
        (call: any) => call.args[0].action === 'loadWallet'
      );

      for (const wallet of wallets) {
        const call = loadCalls.find(
          (c: any) => c.args[0].payload.name === wallet.name
        );
        if (messageHandler && call) {
          messageHandler({
            messageId: call.args[0].messageId,
            result: wallet.address
          });
        }
      }

      // Wait for all loads to complete
      const addresses = await Promise.all(loadPromises);

      // Verify all addresses are correct
      for (let i = 0; i < wallets.length; i++) {
        expect(addresses[i]).to.equal(wallets[i].address);
      }

      // Verify all wallets are in the walletAddresses map
      for (const wallet of wallets) {
        expect(vwp.walletAddresses.has(wallet.name)).to.be.true;
        expect(vwp.walletAddresses.get(wallet.name)).to.equal(wallet.address);
      }

      // Verify map size
      expect(vwp.walletAddresses.size).to.equal(wallets.length);
    });

    it('should remove wallet from both proxy map and send "removeWallet" msg to child process', async function() {
      vwp = new VaultWalletProxy();

      // Initialize
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // First, load a wallet
      const walletName = 'wallet-to-remove';
      const walletAddress = 'bc1qremove123456789';

      const loadPromise = vwp.loadWallet({ name: walletName });
      await new Promise(resolve => setImmediate(resolve));
      simulateResponse('loadWallet', walletAddress);
      await loadPromise;

      // Verify wallet was loaded
      expect(vwp.walletAddresses.has(walletName)).to.be.true;

      // Now remove the wallet
      const removePromise = vwp.removeWallet(walletName);

      await new Promise(resolve => setImmediate(resolve));

      // Simulate successful removal response
      simulateResponse('removeWallet', { success: true });

      const result = await removePromise;

      // Verify result
      expect(result.success).to.be.true;

      // Verify wallet was removed from proxy's walletAddresses map
      expect(vwp.walletAddresses.has(walletName)).to.be.false;

      // Verify removeWallet message was sent to SecureProcess
      const removeCall = mockChildProcess.send.getCalls().find(
        (call: any) => call.args[0].action === 'removeWallet'
      );
      expect(removeCall).to.exist;
      expect(removeCall!.args[0].payload.name).to.equal(walletName);
    });

    it('should handle error when removing non-existent wallet', async function() {
      vwp = new VaultWalletProxy();

      // Initialize
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Try to remove wallet that doesn't exist
      const walletName = 'non-existent-wallet';
      const removePromise = vwp.removeWallet(walletName);

      await new Promise(resolve => setImmediate(resolve));

      // Simulate error response from SecureProcess
      simulateErrorResponse('removeWallet', 'Wallet not found: non-existent-wallet');

      try {
        await removePromise;
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.message).to.include('Wallet not found');
        expect(err.message).to.include('non-existent-wallet');
      }

      // Verify the wallet is not in the map (it shouldn't be, as it was never loaded)
      expect(vwp.walletAddresses.has(walletName)).to.be.false;

      // Verify removeWallet message was still sent to SecureProcess
      const removeCall = mockChildProcess.send.getCalls().find(
        (call: any) => call.args[0].action === 'removeWallet'
      );
      expect(removeCall).to.exist;
    });

    it('should reject loadWallet when wallet name is not provided', async function() {
      vwp = new VaultWalletProxy();

      // Initialize
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Try to load wallet without name
      try {
        await vwp.loadWallet({ name: '' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.message).to.include('Wallet name must be provided');
      }

      // Verify no IPC message was sent
      const loadCall = mockChildProcess.send.getCalls().find(
        (call: any) => call.args[0].action === 'loadWallet'
      );
      expect(loadCall).to.not.exist;
    });

    it('should pass custom storageType parameter to SecureProcess', async function() {
      vwp = new VaultWalletProxy();

      // Initialize
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Load wallet with custom storage type
      const walletName = 'custom-storage-wallet';
      const customStorageType = 'CustomStorage';
      const expectedAddress = 'bc1qcustom123456789';

      const loadPromise = vwp.loadWallet({
        name: walletName,
        storageType: customStorageType
      });

      await new Promise(resolve => setImmediate(resolve));

      // Verify correct storage type was sent in IPC message
      const loadCall = mockChildProcess.send.getCalls().find(
        (call: any) => call.args[0].action === 'loadWallet'
      );
      expect(loadCall).to.exist;
      expect(loadCall!.args[0].payload.storageType).to.equal(customStorageType);

      // Simulate response
      simulateResponse('loadWallet', expectedAddress);

      const address = await loadPromise;
      expect(address).to.equal(expectedAddress);
    });

    it('should respect custom timeout for loadWallet operation', async function() {
      vwp = new VaultWalletProxy();

      // Initialize
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Load wallet with very short custom timeout
      const customTimeout = 200;
      const loadPromise = vwp.loadWallet({
        name: 'timeout-test-wallet',
        timeoutMs: customTimeout
      });

      // Don't send a response - let it timeout

      try {
        await loadPromise;
        expect.fail('Should have timed out');
      } catch (err: any) {
        expect(err.message).to.include(`Request timeout after ${customTimeout}ms`);
        expect(err.message).to.include('loadWallet');
      }
    });
  });

  describe('Passphrase Handling', function() {

    it('should encrypt passphrase with RSA public key before sending over IPC', async function() {
      vwp = new VaultWalletProxy();

      // Initialize to get public key
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Create a promise that will resolve when we can inspect the IPC message
      const addPassphrasePromise = vwp.addPassphrase('test-wallet');

      // Give it a moment to prompt and for us to inject stdin data
      await new Promise(resolve => setImmediate(resolve));

      // Simulate user entering "testpass123" + Enter
      const stdin = process.stdin as any;
      const dataHandler = stdin.listeners('data')[0];

      const plaintextPW = 'testpass123';
      // Type passphrase character by character
      for (const char of plaintextPW) {
        dataHandler(Buffer.from([char.charCodeAt(0)]));
      }
      // Press Enter
      dataHandler(Buffer.from([0x0d]));

      await new Promise(resolve => setImmediate(resolve));

      // Find the addPassphrase IPC message
      const addPassphraseCall = mockChildProcess.send.getCalls().find(
        (call: any) => call.args[0].action === 'addPassphrase'
      );

      expect(addPassphraseCall).to.exist;
      const payload = addPassphraseCall!.args[0].payload;

      // Verify the passphrase is base64-encoded (encrypted format)
      expect(payload.encryptedPassphrase).to.be.a('string');
      expect(payload.encryptedPassphrase).to.match(/^[A-Za-z0-9+/]+=*$/);

      // Verify it's not plaintext
      expect(payload.encryptedPassphrase).to.not.include(plaintextPW);

      // Verify we can decode the base64 and it's an encrypted buffer
      const encryptedBuffer = Buffer.from(payload.encryptedPassphrase, 'base64');
      expect(encryptedBuffer.length).to.be.greaterThan(100); // RSA-2048 ciphertext is 256 bytes

      // Simulate successful response
      simulateResponse('addPassphrase', { success: true });
      const result = await addPassphrasePromise;
      expect(result.success).to.be.true;
    });

    it('should accept correct passphrase when SecureProcess validates it successfully', async function() {
      vwp = new VaultWalletProxy();

      // Initialize
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Start adding passphrase
      const addPassphrasePromise = vwp.addPassphrase('test-wallet');

      await new Promise(resolve => setImmediate(resolve));

      // Simulate passphrase entry
      const stdin = process.stdin as any;
      const dataHandler = stdin.listeners('data')[0];
      for (const char of 'correctpass') {
        dataHandler(Buffer.from([char.charCodeAt(0)]));
      }
      dataHandler(Buffer.from([0x0d])); // Enter

      await new Promise(resolve => setImmediate(resolve));

      // Simulate SecureProcess accepting the passphrase
      simulateResponse('addPassphrase', { success: true });

      const result = await addPassphrasePromise;
      expect(result.success).to.be.true;
    });

    it('should reject incorrect passphrase when SecureProcess validation fails', async function() {
      vwp = new VaultWalletProxy();

      // Initialize
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Start adding passphrase
      const addPassphrasePromise = vwp.addPassphrase('test-wallet');

      await new Promise(resolve => setImmediate(resolve));

      // Simulate passphrase entry
      const stdin = process.stdin as any;
      const dataHandler = stdin.listeners('data')[0];
      for (const char of 'wrongpass') {
        dataHandler(Buffer.from([char.charCodeAt(0)]));
      }
      dataHandler(Buffer.from([0x0d])); // Enter

      await new Promise(resolve => setImmediate(resolve));

      // Simulate SecureProcess rejecting the passphrase
      simulateErrorResponse('addPassphrase', 'Incorrect passphrase');

      try {
        await addPassphrasePromise;
        expect.fail('Should have rejected with incorrect passphrase');
      } catch (err: any) {
        expect(err.message).to.include('Incorrect passphrase');
      }
    });

    it('should handle Ctrl+C cancellation during passphrase prompt', async function() {
      vwp = new VaultWalletProxy();

      // Initialize
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Start adding passphrase
      const addPassphrasePromise = vwp.addPassphrase('test-wallet');

      await new Promise(resolve => setImmediate(resolve));

      // Simulate user pressing Ctrl+C (0x03)
      const stdin = process.stdin as any;
      const dataHandler = stdin.listeners('data')[0];
      dataHandler(Buffer.from([0x03]));

      try {
        await addPassphrasePromise;
        expect.fail('Should have cancelled on Ctrl+C');
      } catch (err: any) {
        expect(err.message).to.include('Cancelled');
      }

      // Verify no IPC message was sent for addPassphrase
      const addPassphraseCall = mockChildProcess.send.getCalls().find(
        (call: any) => call.args[0].action === 'addPassphrase'
      );
      expect(addPassphraseCall).to.not.exist;
    });

    it('should handle Ctrl+D cancellation during passphrase prompt', async function() {
      vwp = new VaultWalletProxy();

      // Initialize
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Start adding passphrase
      const addPassphrasePromise = vwp.addPassphrase('test-wallet');

      await new Promise(resolve => setImmediate(resolve));

      // Simulate user pressing Ctrl+D (0x04)
      const stdin = process.stdin as any;
      const dataHandler = stdin.listeners('data')[0];
      dataHandler(Buffer.from([0x04]));

      try {
        await addPassphrasePromise;
        expect.fail('Should have cancelled on Ctrl+D');
      } catch (err: any) {
        expect(err.message).to.include('Cancelled');
      }

      // Verify no IPC message was sent for addPassphrase
      const addPassphraseCall = mockChildProcess.send.getCalls().find(
        (call: any) => call.args[0].action === 'addPassphrase'
      );
      expect(addPassphraseCall).to.not.exist;
    });

    it('should cleanup stdin handlers after passphrase entry completes', async function() {
      vwp = new VaultWalletProxy();

      // Initialize
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      const stdin = process.stdin as any;

      // Get initial listener count
      const initialDataListeners = stdin.listenerCount('data');
      const initialErrorListeners = stdin.listenerCount('error');

      // Start adding passphrase
      const addPassphrasePromise = vwp.addPassphrase('test-wallet');

      await new Promise(resolve => setImmediate(resolve));

      // Verify listeners were added during prompt
      expect(stdin.listenerCount('data')).to.be.greaterThan(initialDataListeners);
      expect(stdin.listenerCount('error')).to.be.greaterThan(initialErrorListeners);

      // Complete the passphrase entry
      const dataHandler = stdin.listeners('data')[0];
      for (const char of 'pass123') {
        dataHandler(Buffer.from([char.charCodeAt(0)]));
      }
      dataHandler(Buffer.from([0x0d])); // Enter

      await new Promise(resolve => setImmediate(resolve));

      // Simulate success
      simulateResponse('addPassphrase', { success: true });
      await addPassphrasePromise;

      // Verify listeners were cleaned up after completion
      expect(stdin.listenerCount('data')).to.equal(initialDataListeners);
      expect(stdin.listenerCount('error')).to.equal(initialErrorListeners);
    });

    it('should cleanup stdin handlers after passphrase cancellation', async function() {
      vwp = new VaultWalletProxy();

      // Initialize
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      const stdin = process.stdin as any;

      // Get initial listener count
      const initialDataListeners = stdin.listenerCount('data');
      const initialErrorListeners = stdin.listenerCount('error');

      // Start adding passphrase
      const addPassphrasePromise = vwp.addPassphrase('test-wallet');

      await new Promise(resolve => setImmediate(resolve));

      // Verify listeners were added
      expect(stdin.listenerCount('data')).to.be.greaterThan(initialDataListeners);

      // Cancel with Ctrl+C
      const dataHandler = stdin.listeners('data')[0];
      dataHandler(Buffer.from([0x03]));

      try {
        await addPassphrasePromise;
      } catch {
        // Expected cancellation
      }

      // Verify listeners were cleaned up after cancellation
      expect(stdin.listenerCount('data')).to.equal(initialDataListeners);
      expect(stdin.listenerCount('error')).to.equal(initialErrorListeners);
    });

    it('should handle backspace during passphrase entry', async function() {
      vwp = new VaultWalletProxy();

      // Initialize
      const initPromise = vwp.initialize();
      await simulateSuccessfulInit();
      await initPromise;

      // Start adding passphrase
      const addPassphrasePromise = vwp.addPassphrase('test-wallet');

      await new Promise(resolve => setImmediate(resolve));

      const stdin = process.stdin as any;
      const dataHandler = stdin.listeners('data')[0];

      // Type "pass", then backspace twice, then "12345"
      // Result should be "pa12345"
      for (const char of 'pass') {
        dataHandler(Buffer.from([char.charCodeAt(0)]));
      }
      dataHandler(Buffer.from([0x7f])); // Backspace
      dataHandler(Buffer.from([0x7f])); // Backspace
      for (const char of '12345') {
        dataHandler(Buffer.from([char.charCodeAt(0)]));
      }
      dataHandler(Buffer.from([0x0d])); // Enter

      await new Promise(resolve => setImmediate(resolve));

      // The encrypted passphrase should be sent
      const addPassphraseCall = mockChildProcess.send.getCalls().find(
        (call: any) => call.args[0].action === 'addPassphrase'
      );
      expect(addPassphraseCall).to.exist;

      // We can't verify the exact plaintext, but we can verify encryption happened
      const payload = addPassphraseCall!.args[0].payload;
      expect(payload.encryptedPassphrase).to.be.a('string');
      expect(Buffer.from(payload.encryptedPassphrase, 'base64').length).to.be.greaterThan(100);

      // Complete the operation
      simulateResponse('addPassphrase', { success: true });
      const result = await addPassphrasePromise;
      expect(result.success).to.be.true;
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
