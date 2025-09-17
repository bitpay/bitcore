#!/usr/bin/env node

/**
 * Child Process for Secure Credential Storage
 * This process runs in isolation with secure heap allocation
 */

import { CredentialManager } from './CredentialManager';
import { SecureCredential, SecureVaultConfig, VaultMessage, VaultResponse } from './types';

class SecureChildProcess {
  private credentials: Map<string, Buffer> = new Map();
  private credentialManager: CredentialManager;
  private config: Required<SecureVaultConfig>;

  constructor() {
    // Parse configuration from environment
    const configStr = process.env.VAULT_CONFIG;
    if (!configStr) {
      throw new Error('VAULT_CONFIG environment variable is required');
    }
    
    // Validate JSON structure and content
    let parsedConfig;
    try {
      parsedConfig = JSON.parse(configStr);
    } catch (error) {
      throw new Error('VAULT_CONFIG must be valid JSON');
    }
    
    // Validate configuration schema
    if (typeof parsedConfig !== 'object' || parsedConfig === null) {
      throw new Error('VAULT_CONFIG must be a valid configuration object');
    }
    
    // Validate specific fields with safe defaults
    const validatedConfig = {
      maxCredentials: typeof parsedConfig.maxCredentials === 'number' && parsedConfig.maxCredentials > 0 
        ? Math.min(parsedConfig.maxCredentials, 1000) // Cap at reasonable limit
        : 100,
      processTimeout: typeof parsedConfig.processTimeout === 'number' && parsedConfig.processTimeout > 0
        ? Math.min(parsedConfig.processTimeout, 300000) // Cap at 5 minutes
        : 30000,
      secureHeapSize: typeof parsedConfig.secureHeapSize === 'number' && parsedConfig.secureHeapSize > 0
        ? Math.min(parsedConfig.secureHeapSize, 100 * 1024 * 1024) // Cap at 100MB
        : 1024 * 1024,
      debug: typeof parsedConfig.debug === 'boolean' ? parsedConfig.debug : false
    };
    
    this.config = validatedConfig as Required<SecureVaultConfig>;
    this.credentialManager = new CredentialManager();
    
    this.setupProcessHandlers();
    this.setupIPCHandlers();
    
    // Signal that the process is ready
    this.sendMessage({ type: 'ready' });
  }

  private setupProcessHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception in child process:', error);
      this.clearAllCredentials();
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection in child process:', reason);
      this.clearAllCredentials();
      process.exit(1);
    });

    // Handle process termination signals
    process.on('SIGTERM', () => {
      this.clearAllCredentials();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      this.clearAllCredentials();
      process.exit(0);
    });
  }

  private setupIPCHandlers(): void {
    process.on('message', (message: VaultMessage) => {
      this.handleMessage(message);
    });
  }

  private async handleMessage(message: VaultMessage): Promise<void> {
    let response: VaultResponse;

    try {
      switch (message.action) {
        case 'store':
          response = await this.storeCredential(message.payload);
          break;
        case 'retrieve':
          response = await this.retrieveCredential(message.payload.id);
          break;
        case 'delete':
          response = await this.deleteCredential(message.payload.id);
          break;
        case 'list':
          response = await this.listCredentials();
          break;
        case 'clear':
          response = await this.clearAllCredentials();
          break;
        default:
          response = {
            success: false,
            error: `Unknown action: ${message.action}`
          };
      }
    } catch (error) {
      response = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }

    this.sendMessage({ ...response, id: message.id });
  }

  private async storeCredential(credentialData: SecureCredential): Promise<VaultResponse<string>> {
    try {
      // Basic validation
      if (!credentialData || typeof credentialData !== 'object') {
        return {
          success: false,
          error: 'Invalid credential data'
        };
      }

      if (!credentialData.id || typeof credentialData.id !== 'string') {
        return {
          success: false,
          error: 'Credential ID is required and must be a string'
        };
      }

      // Check if we've reached the maximum number of credentials
      if (this.credentials.size >= this.config.maxCredentials) {
        return {
          success: false,
          error: 'Maximum number of credentials reached'
        };
      }

      // Check if credential already exists
      if (this.credentials.has(credentialData.id)) {
        return {
          success: false,
          error: 'Credential with this ID already exists'
        };
      }

      // Convert data to Buffer if it's a string
      let dataBuffer: Buffer;
      if (typeof credentialData.data === 'string') {
        dataBuffer = Buffer.from(credentialData.data, 'utf8');
      } else if (Buffer.isBuffer(credentialData.data)) {
        dataBuffer = credentialData.data;
      } else {
        return {
          success: false,
          error: 'Credential data must be a string or Buffer'
        };
      }

      // Store the buffer directly
      this.credentials.set(credentialData.id, dataBuffer);

      return {
        success: true,
        data: credentialData.id,
        processId: process.pid
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async retrieveCredential(id: string): Promise<VaultResponse<SecureCredential>> {
    try {
      const dataBuffer = this.credentials.get(id);
      if (!dataBuffer) {
        return {
          success: false,
          error: 'Credential not found'
        };
      }

      // Create a simple credential object
      const credential: SecureCredential = {
        id,
        data: dataBuffer,
        metadata: {},
        createdAt: new Date(), // We don't track creation time in this simplified version
      };

      return {
        success: true,
        data: credential,
        processId: process.pid
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async deleteCredential(id: string): Promise<VaultResponse<boolean>> {
    try {
      const existed = this.credentials.has(id);
      if (existed) {
        // Overwrite the data before deletion for security
        const dataBuffer = this.credentials.get(id)!;
        dataBuffer.fill(0);
        this.credentials.delete(id);
      }

      return {
        success: true,
        data: existed,
        processId: process.pid
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async listCredentials(): Promise<VaultResponse<string[]>> {
    try {
      const ids = Array.from(this.credentials.keys());
      
      return {
        success: true,
        data: ids,
        processId: process.pid
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async clearAllCredentials(): Promise<VaultResponse<boolean>> {
    try {
      // Securely overwrite all credential data
      for (const [id, data] of this.credentials) {
        data.fill(0);
      }
      
      this.credentials.clear();
      
      // Force garbage collection if available
      if (typeof global !== 'undefined' && typeof global.gc === 'function') {
        global.gc();
      }

      return {
        success: true,
        data: true,
        processId: process.pid
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private sendMessage(message: any): void {
    if (process.send) {
      process.send(message);
    }
  }
}

// Start the secure child process
new SecureChildProcess(); 