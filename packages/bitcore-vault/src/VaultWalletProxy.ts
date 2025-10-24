import { ChildProcess, fork } from 'child_process';
import * as crypto from 'crypto';
import * as path from 'path';

interface SecureProcessResponse {
  messageId: string;
  result?: any;
  error?: { message: string; stack?: string };
  fatalError?: boolean; // Indicates child must be terminated
}

interface PendingMessage {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeoutId: NodeJS.Timeout;
}

interface SendMessageOptions {
  timeoutMs?: number; // Per-request timeout in milliseconds
}

export interface VaultWalletProxyOptions {
  exitOnChildFailure?: boolean; // Whether parent should exit(1) when child fails fatally (default: true)
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
  private readonly exitOnChildFailure: boolean;
  private isTerminating: boolean = false; // Prevent recursive termination

  constructor(options: VaultWalletProxyOptions = {}) {
    this.walletAddresses = new Map<string, string>(); // { name: address }
    this.pendingMessages = new Map();
    this.exitOnChildFailure = options.exitOnChildFailure !== undefined ? options.exitOnChildFailure : true;
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
          execArgv: ['--secure-heap=32768'], // don't change unless you know what you're doing - ONLY --secure-heap=n allowed
          env: {}, // zeroed environment
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
          const exitReason = signal 
            ? `killed by signal ${signal}` 
            : `exited with code ${code}`;

          const msg = `SecureProcess ${exitReason}. Manual reinitialization required.`;
          console.warn(msg);

          const error = new Error(msg);
          this.rejectAllPendingMessages(error);
          this.secureProcess = null;
          this.initializationPromise = null;

          // Apply failure policy for unexpected exits
          if (!this.isTerminating) {
            // Only apply policy if we're not already handling termination
            if (this.exitOnChildFailure) {
              console.error('Secure process exited unexpectedly. Parent exiting as configured.');
              process.exit(1);
            } else {
              console.error('Secure process exited unexpectedly. Parent continues as configured.');
            }
          }
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
    const { messageId, result, error, fatalError } = msg;
    
    // Handle fatal errors - child must be terminated
    if (fatalError) {
      const errorMessage = error?.message || 'Fatal error in secure process';
      console.error(`Fatal error from SecureProcess: ${errorMessage}`);
      
      // Asynchronously handle cleanup and termination
      this.handleFatalError(new Error(errorMessage)).catch(err => {
        console.error('Error during fatal error handling:', err);
      });
      
      // Still resolve/reject the pending message if it exists
      const pendingMessage = this.pendingMessages.get(messageId);
      if (pendingMessage) {
        clearTimeout(pendingMessage.timeoutId);
        const err = new Error(error?.message || 'Fatal error in secure process');
        err.stack = error?.stack;
        pendingMessage.reject(err);
        this.pendingMessages.delete(messageId);
      }
      return;
    }
    
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
   * Handle fatal error from child process.
   * Attempts cleanup, terminates child, and optionally exits parent.
   */
  private async handleFatalError(error: Error): Promise<void> {
    if (this.isTerminating) {
      return; // Prevent recursive termination
    }
    this.isTerminating = true;

    console.error('Handling fatal error from secure process...');

    // Reject all pending messages first
    this.rejectAllPendingMessages(error);

    // Attempt to request cleanup from child (with short timeout)
    if (this.secureProcess && !this.secureProcess.killed) {
      try {
        await this.sendMessage('cleanup', {}, { timeoutMs: 2000 });
      } catch (err) {
        // Cleanup may fail or timeout - that's okay, we'll kill the process anyway
        console.warn('Child cleanup request failed or timed out:', err);
      }
    }

    // Terminate the child process
    this.terminate();

    // Apply failure policy
    if (this.exitOnChildFailure) {
      console.error('Child process failed fatally. Parent exiting as configured.');
      process.exit(1);
    } else {
      console.error('Child process failed fatally. Parent continues as configured.');
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
    const isSecureHeapEnabled = await this.sendMessage<boolean>('checkSecureHeap', {}, { timeoutMs });
    if (!isSecureHeapEnabled) {
      // @TODO this should kill the whole process
      throw new Error('Secure heap is not enabled. Cannot perform secure operations.');
    }
    
    const encryptedPassphrase = await this.promptForPassphrase();

    const payload = {
      name: walletName,
      encryptedPassphrase: encryptedPassphrase.toString('base64'),
    };
    return this.sendMessage<{ success: boolean }>('addPassphrase', payload, { timeoutMs });
  }

  /**
   * Start the security monitoring intervals in the secure process.
   * Should be called after all wallets and passphrases are loaded to avoid
   * interfering with user input prompts.
   */
  public async startSecurityMonitoring(timeoutMs?: number): Promise<{ success: boolean }> {
    return this.sendMessage<{ success: boolean }>('startSecurityCheckIntervals', {}, { timeoutMs });
  }

  private async promptForPassphrase(opts: { prompt?: string; maxBytes?: number } = {}): Promise<Buffer> {
    if (!this.publicKey) throw new Error('Vault not initialized (missing public key)');

    const promptText = opts.prompt ?? 'Passphrase: ';
    const maxBytes = Math.min(Math.max(opts.maxBytes ?? 256, 8), 4096);
    const stdin = process.stdin as NodeJS.ReadStream & { setRawMode?: (mode: boolean) => void };
    const plain = Buffer.allocUnsafe(maxBytes);
    let len = 0;

    if (process.stdout.isTTY) process.stdout.write(promptText);
    stdin.setRawMode?.(true);
    stdin.resume();

    return await new Promise<Buffer>((resolve, reject) => {
      const cleanup = () => {
        try { crypto.randomFillSync(plain.subarray(0, len)); len = 0; } catch {}
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.off('data', onData);
        stdin.off('error', onError);
        if (process.stdout.isTTY) process.stdout.write('\n');
      };

      const abort = (err: Error) => { cleanup(); reject(err); };

      const onError = (e: Error) => abort(e);

      const onData = (chunk: Buffer) => {
        for (const c of chunk) {
          // Ctrl+C or Ctrl+D -> cancel
          if (c === 0x03 || c === 0x04) return abort(new Error('Cancelled'));
          // Enter/Return
          if (c === 0x0d || c === 0x0a) {
            try {
              const ciphertext = crypto.publicEncrypt(
                { key: this.publicKey!, oaepHash: 'sha256', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
                plain.subarray(0, len)
              );
              cleanup();
              resolve(ciphertext);
            } catch (e) { abort(e as Error); }
            return;
          }
          // Backspace/Delete
          if ((c === 0x7f || c === 0x08) && len > 0) { len--; plain[len] = 0; continue; }
          // Printable ASCII
          if (c >= 0x20 && c !== 0x7f && len < maxBytes) plain[len++] = c;
        }
      };

      stdin.on('data', onData);
      stdin.once('error', onError);
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
