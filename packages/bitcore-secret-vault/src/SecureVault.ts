import { ChildProcess, fork } from 'child_process';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { validChildMessageTypes, validRequests } from './constants';
import { ProcessState, SecureCredential, SecureVaultConfig, ValidRequestNames, VaultResponse } from './types';

/**
 * SecureVault - Main class for managing secure credential storage
 * Uses child processes with secure heap allocation to protect sensitive data
 */
export class SecureVault {
  private config: Required<SecureVaultConfig>;
  private isInitialized = false;
  private child: ChildProcess;
  private pending: Map<number, { resolve: (value: any) => void; reject: (reason?: any) => void }>;
  private msgId: number;

  constructor(config: SecureVaultConfig = {}) {
    // Set default configuration
    this.config = {
      maxCredentials: config.maxCredentials || 100,
      processTimeout: config.processTimeout || 30000,
      secureHeapSize: config.secureHeapSize || 1024 * 1024 // 1MB default
    };

    this.child = fork('./secure-worker.ts', [], {
      execArgv: [`--secure-heap=${this.config.secureHeapSize}`, '--expose-gc']
    });

    this.msgId = 1;
    this.pending = new Map();
    
    this.initialize();
  }

  /**
   * Store existing secure credential (prefer readInCredential for user input)
   */
  async storeCredential(credential: Omit<SecureCredential, 'id' | 'createdAt'>): Promise<VaultResponse<{ id: string }>> {
    try {
      // Think about what data is and what it's going to return
      const id =  await this.handleRequest<string>('storeCredential', credential);
      return { success: true, data: { id } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
  
  /**
   * Reads in user input as a buffer and encrypts it with no strings stored
   */
  async readInCredential(): Promise<VaultResponse<{ id: string }>> {
    try {
      const id = await this.handleRequest<string>('readInCredential');
      return { success: true, data: { id }  };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
  
  /**
   * Delete a secure credential
   */
  async deleteCredential(id: string): Promise<VaultResponse<{ deleted: boolean }>> {
    try {
      const result = await this.handleRequest<boolean>('deleteCredential', { id })
      return { success: true, data: { deleted: result } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
  
  /**
   * List all stored credential IDs
   */
  async listCredentials(): Promise<VaultResponse<{ ids: string[] }>> {
    
    try {
      const ids = await this.handleRequest<string[]>('listCredentials');
      return { success: true, data: { ids } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
  
  /**
   * Clear all credentials and restart process
   */
  async clearVault(): Promise<VaultResponse<{ didClear: boolean }>> {
    
    try {
      const didClear = await this.handleRequest<boolean>('clearVault');
      return { success: true, data: { didClear } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async useCredential(callback): Promise<void> {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    let passwordBuffer: Buffer | null = await this.handleRequest<Buffer>('getDecryptedCredential');

    // SECURITY: Override toString
    const originalToString = passwordBuffer.toString;
    passwordBuffer.toString = function(...args) {
      throw new Error('SECURITY ERROR: Converting pasword buffer to string is forbidden. This prevents accidental creation of immutable string copies.');
    }

    // SECURITY: Override toJSON
    const originalToJSON = passwordBuffer.toJSON;
    passwordBuffer.toJSON = function() {
      throw new Error('SECURITY ERROR: Converting password buffer to JSON is forbidden.');
    }

    // SECURITY: Override inspect to prevent console exposure
    const originalInspect = passwordBuffer[Symbol.for('nodejs.util.inspect.custom')];
    passwordBuffer[Symbol.for('nodejs.util.inspect.custom')] = function() {
      return '[SecureBuffer: *** REDACTED ***'
    };

    try {
      // is this right?
      const result = await callback(passwordBuffer);
      return result;
    } finally {
      // Callback with try/finally ensures proper sanitization
      if (Buffer.isBuffer(passwordBuffer)) {
        crypto.randomFillSync(passwordBuffer);

        passwordBuffer.toString = originalToString;
        passwordBuffer.toJSON = originalToJSON;
        passwordBuffer[Symbol.for('nodejs.util.inspect.custom')] = originalInspect;
      }

      passwordBuffer = null;
      if (global.gc) global.gc();
    }
  }

  /**
   * Shutdown the vault and clean up resources
   */
  async shutdown(): Promise<void> {
    if (this.child && !this.child.killed) {
      this.child.kill('SIGTERM');

      setTimeout(() => {
        if (this.child && !this.child.killed) {
          this.child.kill('SIGKILL');
        }
      }, 5000); // 5s timeout for graceful shutdown
    }
    
    this.isInitialized = false;

    for (const [_, pending] of this.pending) {
      pending.reject('SecureVault is shutitng down');
    };
    this.pending.clear();
  }

  /**
   * Initialize the secure vault and spawn child process
   */
  private initialize(): void {
    if (this.isInitialized) {
      throw new Error('SecureVault is already initialized');
    }

    try {
      this.child.on('message', (msg: { id: number; type: string; data: any; error?: { message: string; stack: any } }) => { // todo fix
        const pending = this.pending.get(msg.id);
        if (!pending) {
          console.error(`Pending msg not found: ${msg.id}`);
          return;
        }

        if (msg.type.endsWith(':result') && validChildMessageTypes.includes(msg.type)) {
          this.pending.delete(msg.id);

          // Handle Buffer deserialization - IPC automatically serializes Buffers
          let data = msg.data;
          if (data?.type === 'Buffer' && Array.isArray(data.data)) {
            data = Buffer.from(data.data);
          }
          pending.resolve(data);
        } else if (msg.type.endsWith(':error')) {
          this.pending.delete(msg.id);
          const err = new Error(msg.error?.message || 'Unknown error from child');
          err.stack = msg.error?.stack;
          pending.reject(err);
        } else {
          console.error('Unexpected message from child', msg.type);
        }
      });

      this.isInitialized = true;
    } catch (error) {
      throw error;
    }
  }

  private handleRequest<T>(type: ValidRequestNames, params = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.pending.set(id, { resolve, reject });
      (this.child).send({ type, id, ...params });
    })
  }
} 