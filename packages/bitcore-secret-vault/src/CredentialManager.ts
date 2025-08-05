'use strict';

import * as crypto from 'crypto';

class CredentialManager {
  private rsaPrivateKey: crypto.KeyObject | null;
  private rsaPublicKey: crypto.KeyObject | null;
  private crypto: { padding: number; oaepHash: 'sha256' };
  private isShutdown: boolean;
  private secureHeapAllocationBaseline: number;
  private credentials: Map<string, Buffer>
  private encryptedPassword;
  private activeBuffers;

  constructor() {
    this.rsaPrivateKey = null;
    this.rsaPublicKey = null;
    this.crypto = {
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    };
    this.isShutdown = false;
    this.secureHeapAllocationBaseline = 0;
    this.credentials = new Map();
    
    // ✅ SECURITY: Register graceful shutdown handlers
    this.registerShutdownHandlers();
  }

  /**
   * Registers signal handlers for graceful shutdown
   */
  private registerShutdownHandlers() {
    const shutdownHandler = (signal) => {
      this.shutdown();
      process.exit(0);
    };

    // Handle standard termination signals
    process.once('SIGINT', shutdownHandler);   // Ctrl+C
    process.once('SIGTERM', shutdownHandler);  // Termination request
    process.once('SIGHUP', shutdownHandler);   // Hang up
    
    // Handle uncaught exceptions and rejections
    process.once('uncaughtException', (error) => {
      console.error('SecureHeapSecretManager: Uncaught exception, forcing shutdown:', error);
      this.shutdown();
      process.exit(1);
    });
    
    process.once('unhandledRejection', (reason, promise) => {
      console.error('SecureHeapSecretManager: Unhandled rejection, forcing shutdown:', reason);
      this.shutdown();
      process.exit(1);
    });

    // Handle normal process exit
    process.once('beforeExit', () => {
      console.log('SecureHeapSecretManager: Process exiting, cleaning up...');
      this.shutdown();
    });
  }

  /**
   * Graceful shutdown - sanitizes all sensitive data
   */
  shutdown() {
    if (this.isShutdown) {
      return; // Already shut down
    }
    
    console.log('SecureHeapSecretManager: Starting graceful shutdown...');
    
    try {
      // ✅ SECURITY: Clear encrypted password
      if (this.encryptedPassword && Buffer.isBuffer(this.encryptedPassword)) {
        crypto.randomFillSync(this.encryptedPassword);
        this.encryptedPassword = null;
        console.log('SecureHeapSecretManager: Encrypted password sanitized');
      }
      
      // ✅ SECURITY: Clear any active buffers being tracked
      for (const buffer of this.activeBuffers) {
        if (Buffer.isBuffer(buffer)) {
          crypto.randomFillSync(buffer);
        }
      }
      this.activeBuffers.clear();
      console.log('SecureHeapSecretManager: Active buffers sanitized');
      
      // ✅ SECURITY: Clear RSA keys (they're in secure heap, but clear references)
      this.rsaPrivateKey = null;
      this.rsaPublicKey = null;
      console.log('SecureHeapSecretManager: RSA key references cleared');
      
      // ✅ SECURITY: Force garbage collection if available
      if (global.gc) {
        global.gc();
        console.log('SecureHeapSecretManager: Garbage collection triggered');
      }
      
      this.isShutdown = true;
      console.log('SecureHeapSecretManager: Graceful shutdown completed');
      
    } catch (error) {
      console.error('SecureHeapSecretManager: Error during shutdown:', error);
      // Continue shutdown even if there are errors
      this.isShutdown = true;
    }
  }

  getSecureHeapUsage() {
    return crypto.secureHeapUsed();
  }

  /**
   * Generates RSA keypair and stores private key in secure heap
   * @returns {Promise<void>}
   */
  async generateSecureKeypair(): Promise<void> {
    
    // Ensure secure heap allocation settles before getting secure heap allocation baseline
    await new Promise(resolve => setTimeout(resolve, 500));

    const { used: allocationBefore } = crypto.secureHeapUsed();

    // Validate allocation measurement is a valid number
    if (typeof allocationBefore !== 'number' || allocationBefore < 0) {
      throw new Error(`Invalid secure heap allocation measurement: ${allocationBefore}`);
    }

    // Generate RSA key pair - private key bignums are stored in secure heap (see https://docs.openssl.org/3.0/man3/OPENSSL_secure_malloc/#description)
    const keypair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048
    });
    if (!keypair || !keypair.privateKey || !keypair.publicKey) {
      console.error('CRITICAL: RSA key generation failed');
      process.exit(1);
    }
    this.rsaPrivateKey = keypair.privateKey;
    this.rsaPublicKey = keypair.publicKey;

    // Ensure secure heap allocation settles before getting secure heap allocation after key creation
    await new Promise(resolve => setTimeout(resolve, 500));
    const { used: allocationAfter } = crypto.secureHeapUsed();

    // Validate allocation measurement is a valid number
    if (typeof allocationAfter !== 'number' || allocationAfter < 0) {
      throw new Error(`Invalid secure heap allocation measurement: ${allocationAfter}`);
    }

    // Ensure we actually allocated secure heap memory for the keypair
    if (allocationAfter <= allocationBefore) {
      throw new Error(`RSA keypair may not be stored in secure heap. Before: ${allocationBefore}, After: ${allocationAfter}`);
    }

    this.secureHeapAllocationBaseline = allocationAfter - allocationBefore;
  }

  /**
   * Used to determine if RSA keys still in secure heap
   * @throws {Error} If current allocation is less than baseline
   */
  verifyExpectedAllocation() {    
    const { used: currentAllocation } = crypto.secureHeapUsed();

    // Validate allocation measurement is a valid number
    if (typeof currentAllocation !== 'number' || currentAllocation < 0) {
      throw new Error(`Invalid secure heap allocation measurement: ${currentAllocation}`);
    }

    // Validate baseline was properly set
    if (typeof this.secureHeapAllocationBaseline !== 'number' || this.secureHeapAllocationBaseline <= 0) {
      throw new Error(`Invalid secure heap baseline: ${this.secureHeapAllocationBaseline}`);
    }

    const isVerified = currentAllocation >= this.secureHeapAllocationBaseline;
    // @TODO maybe throwing here isn't the move
    if (!isVerified) {
      throw new Error(`Secure heap utilization expectation not met. Expected ${this.secureHeapAllocationBaseline} - Actual ${currentAllocation}`);
    }
    return isVerified;
  }

  /**
   * Reads password from stdin into a buffer and encrypts it
   */
  async readInCredential(promptString = 'Enter password') {
    const { BufferIO } = require('./bufferio.js');
    const bufferIO = new BufferIO();

    let credentialsBuffer;
    try {
      // Get password directly into buffer - no string creation
      credentialsBuffer = await bufferIO.readIn(promptString);

      // Immediately encrypt the buffer - is automatically overwritten by setEncryptedPassword
      return this.setEncryptedPassword(credentialsBuffer);
    } finally {
      // Remove from tracking since setEncryptedPassword sanitized it
      if (credentialsBuffer) {
        crypto.randomFillSync(credentialsBuffer);
      }
      if (global.gc) {
        global.gc();
      }
    }
  }

  async addCredential(credential: Buffer) {
    return this.setEncryptedPassword(credential);
  }

  /**
   * Sets the encrypted password from a buffer. The buffer will be immediately
   * overwritten with random data after encryption to prevent memory leakage.
   *
   * SECURITY REQUIREMENTS:
   * - passwordBuffer MUST be a Buffer (not a string)
   * - passwordBuffer will be MUTATED (overwritten) by this method
   * - passwordBuffer MUST NOT be used after calling this method
   */
  private setEncryptedPassword(passwordBuffer: Buffer) {
    // Type narrowing
    if (!this.rsaPublicKey) {
      throw new Error('RSA public key not initialized');
    }

    // Enforce buffer-only input
    if (!Buffer.isBuffer(passwordBuffer)) {
      throw new Error('SECURITY ERROR: setEncryptedPassword requires a Buffer, not a string or other type');
    }

    try {
      // Encrypt the password
      const encryptedPassword = crypto.publicEncrypt({
        key: this.rsaPublicKey,
        ...this.crypto
      }, passwordBuffer);

      /** Store the result */
      // Generate identifier
      const id = crypto.randomUUID();
      this.credentials.set(id, encryptedPassword);

      return id;
    } finally {
      // IMMEDIATELY overwrite the input buffer to prevent memory leakage
      crypto.randomFillSync(passwordBuffer);
    }
  }

  /**
   * Decrypts password
   *
   * SECURITY REQUIREMENTS:
   * - Output MUST be randomFilled (crypto.randomFillSync) as soon as possible after use
   * 
   * @returns {Buffer} Decrypted password as a Buffer
   */
  getDecryptedPassword() {
    if (this.isShutdown) return;

    if (!this.rsaPrivateKey) {
      throw new Error('Rsa private key not available');
    }
    
    const decryptedPassword = crypto.privateDecrypt({
      key: this.rsaPrivateKey,
      ...this.crypto
    }, this.encryptedPassword);
    
    // ✅ SECURITY: Track the decrypted buffer for potential shutdown cleanup
    // Note: This buffer will be sanitized by the caller, but we track it
    // in case shutdown happens before the caller sanitizes it
    this.activeBuffers.add(decryptedPassword);
    
    // ✅ SECURITY NOTE: This buffer will be sent via IPC which creates copies.
    // The original buffer in this process should be sanitized, but we need
    // to return it first. The worker process will sanitize after IPC send.
    // The main process MUST sanitize its received copy.
    
    return decryptedPassword;
  }

  /**
   * Removes a buffer from active tracking (call this after manual sanitization)
   * @param {Buffer} buffer - Buffer that has been sanitized
   */
  removeFromTracking(buffer) {
    this.activeBuffers.delete(buffer);
  }
}

module.exports = { CredentialManager };

/**
 * Clean-up process (for buffers)
 * crypto.randomFillSync(buffer) - Buffer.fill(0) execution may be skipped in certain optimization scenarios
 */
