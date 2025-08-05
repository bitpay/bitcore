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
    
    this.config = JSON.parse(configStr);
    this.credentialManager = new CredentialManager(this.config);
    
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
      // Validate credential
      const validationErrors = this.credentialManager.validateCredential(credentialData);
      if (validationErrors.length > 0) {
        return {
          success: false,
          error: `Validation failed: ${validationErrors.join(', ')}`
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

      // Serialize and store in secure memory
      const serializedData = this.credentialManager.serializeCredential(credentialData);
      this.credentials.set(credentialData.id, serializedData);

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
      const serializedData = this.credentials.get(id);
      if (!serializedData) {
        return {
          success: false,
          error: 'Credential not found'
        };
      }

      const credential = this.credentialManager.deserializeCredential(serializedData);
      
      // Check if credential has expired
      if (this.credentialManager.isExpired(credential)) {
        this.credentials.delete(id);
        return {
          success: false,
          error: 'Credential has expired'
        };
      }

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
        const serializedData = this.credentials.get(id)!;
        serializedData.fill(0);
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
      
      // Filter out expired credentials
      const validIds: string[] = [];
      for (const id of ids) {
        const serializedData = this.credentials.get(id)!;
        try {
          const credential = this.credentialManager.deserializeCredential(serializedData);
          if (!this.credentialManager.isExpired(credential)) {
            validIds.push(id);
          } else {
            // Clean up expired credential
            serializedData.fill(0);
            this.credentials.delete(id);
          }
        } catch {
          // If we can't deserialize, remove it
          serializedData.fill(0);
          this.credentials.delete(id);
        }
      }

      return {
        success: true,
        data: validIds,
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