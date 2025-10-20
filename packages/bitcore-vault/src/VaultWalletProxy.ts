import { ChildProcess, fork } from 'child_process';
import * as crypto from 'crypto';
import * as path from 'path';
import * as readline from 'readline';

interface SecureProcessResponse {
  messageId: string;
  result?: any;
  error?: { message: string; stack?: string };
}

interface PendingMessage {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeoutId: NodeJS.Timeout;
}

interface SendMessageOptions {
  timeoutMs?: number; // Per-request timeout in milliseconds
}

/**
 * VaultWalletProxy - Secure wallet proxy using IPC-based async RPC pattern.
 * 
 * This class communicates with SecureProcess (a separate Node.js child process) to perform
 * cryptographic operations in an isolated environment. Communication uses an async request/response
 * pattern over IPC, where each request generates a unique messageId to correlate responses.
 * 
 * Architecture:
 * - Main process (this class) sends requests via child_process.send()
 * - SecureProcess handles requests and sends responses back with matching messageId
 * - Promises are used to create an async RPC interface over IPC
 * - Each request has a timeout; all pending requests are rejected if child crashes
 * - The event loop is never blocked - all operations are fully async
 * 
 * Security:
 * - Passphrases are encrypted before crossing the IPC boundary
 * - SecureProcess runs with secure heap enabled for sensitive data
 * - Memory is wiped after use (crypto.randomFillSync)
 */
export class VaultWalletProxy {
  public walletAddresses: Map<string, string>;
  private secureProcess: ChildProcess | null = null;
  private publicKey: crypto.KeyObject | null = null;
  private pendingMessages: Map<string, PendingMessage>;
  private initializationPromise: Promise<void> | null = null;
  private readonly DEFAULT_TIMEOUT_MS = 30000; // 30 seconds default

  constructor() {
    this.walletAddresses = new Map<string, string>(); // { name: address }
    this.pendingMessages = new Map();
  }

  public async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        const secureProcessPath = path.join(__dirname, 'SecureProcess.js');

        /**
         * NOTE TO SELF (3 Oct)
         * One of these options makes it unable to see console logs in the forked process:
         * stdio, env, detached - probably stdio
         */
        this.secureProcess = fork(secureProcessPath, [], {
          // stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
          execArgv: ['--secure-heap=32768'],
          // env: { ...process.env, NODE_OPTIONS: '' },
          // detached: false
        });

        // Handle responses from child process
        this.secureProcess.on('message', this.handleResponse.bind(this));
        
        // Handle child process errors
        this.secureProcess.on('error', (err) => {
          console.error('SecureProcess fork error:', err);
          this.rejectAllPendingMessages(new Error(`SecureProcess error: ${err.message}`));
        });

        // Handle child process exit/crash - reject all pending messages
        this.secureProcess.on('exit', (code, signal) => {
          // @TODO - this should tear everything down

          const exitReason = signal 
            ? `killed by signal ${signal}` 
            : `exited with code ${code}`;

          const msg = `SecureProcess ${exitReason}. Manual reinitialization required.`;
          console.warn(msg);

          this.rejectAllPendingMessages(
            new Error(msg)
          );
          this.secureProcess = null;
          // @TODO better teardown
          process.exit(1);
        });

        // @TODO may need more stuff
        console.log('Sending setupKeypair msg');
        await this.sendMessage<void>('initialize', {});
        const publicKeyPem = await this.sendMessage<string>('getPublicKey', {});
        this.publicKey = crypto.createPublicKey({
          key: publicKeyPem,
          format: 'pem',
        });
      } catch (error) {
        this.initializationPromise = null;
        throw error;
      }
    })();

    return this.initializationPromise;
  }

  private handleResponse(msg: SecureProcessResponse) {
    const { messageId, result, error } = msg;
    const pendingMessage = this.pendingMessages.get(messageId);
    if (pendingMessage) {
      // Clear the timeout since we received a response
      clearTimeout(pendingMessage.timeoutId);
      
      if (error) {
        const err = new Error(error.message);
        err.stack = error.stack;
        pendingMessage.reject(err);
      } else {
        pendingMessage.resolve(result);
      }
      this.pendingMessages.delete(messageId);
    }
  }

  /**
   * Reject all pending messages with the given error.
   * Called when child process crashes or exits unexpectedly.
   */
  private rejectAllPendingMessages(error: Error) {
    for (const [, pendingMessage] of this.pendingMessages.entries()) {
      clearTimeout(pendingMessage.timeoutId);
      pendingMessage.reject(error);
    }
    this.pendingMessages.clear();
  }

  /**
   * Send a message to the secure process and wait for a response.
   * Implements async RPC over IPC with timeout support.
   * 
   * @param action - The action to perform in the secure process
   * @param payload - Data to send with the action
   * @param options - Optional configuration (timeout, etc.)
   * @returns Promise that resolves with the response from SecureProcess
   * 
   * @TODO: Implement backpressure handling (e.g., max concurrent requests, queue with size limit)
   */
  private sendMessage<T>(action: string, payload: any, options: SendMessageOptions = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.secureProcess) {
        return reject(new Error('Secure process not initialized.'));
      }

      const messageId = crypto.randomBytes(16).toString('hex');
      const timeoutMs = options.timeoutMs ?? this.DEFAULT_TIMEOUT_MS;

      // Set up timeout to reject if SecureProcess doesn't respond in time
      const timeoutId = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(new Error(`Request timeout after ${timeoutMs}ms for action: ${action}`));
      }, timeoutMs);

      // Store pending message with timeout reference for cleanup
      this.pendingMessages.set(messageId, { resolve, reject, timeoutId });

      // Send message via IPC
      this.secureProcess.send({ action, payload, messageId });
    });
  }

  public async loadWallet({ 
    name, 
    storageType = 'Level',
    timeoutMs 
  }: { 
    name: string; 
    storageType?: string;
    timeoutMs?: number;
  }): Promise<string> {
    if (!name) {
      throw new Error('Wallet name must be provided in walletOptions.');
    }
    const publicAddress = await this.sendMessage<string>('loadWallet', { name, storageType }, { timeoutMs });
    this.walletAddresses.set(name, publicAddress);
    return publicAddress;
  }

  public async addPassphrase(walletName: string, timeoutMs?: number): Promise<{ success: boolean }> {
    if (!this.publicKey) {
      throw new Error('Public key not available. Initialize the proxy first.');
    }

    // Check secure heap before each passphrase operation
    const isSecureHeapEnabled = await this.sendMessage<{ enabled: boolean; error?: string }>('checkSecureHeap', {}, { timeoutMs });
    if (!isSecureHeapEnabled) {
      // @TODO this should kill the whole process
      throw new Error('Secure heap is not enabled. Cannot perform secure operations.');
    }
    

    const passphrase = await this.promptForPassphrase();
    const passphraseBuffer = Buffer.from(passphrase);
    const encryptedPassphrase = crypto.publicEncrypt(
      {
        key: this.publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      passphraseBuffer
    );
    crypto.randomFillSync(passphraseBuffer);

    const payload = {
      name: walletName,
      encryptedPassphrase: encryptedPassphrase.toString('base64'),
    };
    return this.sendMessage<{ success: boolean }>('addPassphrase', payload, { timeoutMs });
  }

  private promptForPassphrase(): Promise<string> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question('Enter passphrase: ', (passphrase) => {
        rl.close();
        resolve(passphrase);
      });
    });
  }

  /**
   * Terminate the secure process.
   * All pending messages will be automatically rejected when the process exits.
   */
  public terminate() {
    if (this.secureProcess) {
      this.secureProcess.kill();
      this.secureProcess = null;
    }
  }
}
