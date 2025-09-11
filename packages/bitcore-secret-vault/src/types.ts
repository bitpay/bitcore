import { validRequests } from './constants';

/**
 * Configuration options for the SecureVault
 */
export interface SecureVaultConfig {
  /** Maximum number of credentials to store */
  maxCredentials?: number;
  /** Timeout for child process operations in milliseconds */
  processTimeout?: number;
  /** Size of secure heap in bytes */
  secureHeapSize?: number;
  /** Enable debug mode with detailed error information */
  debug?: boolean;
}

/**
 * Structure for storing sensitive credentials
 */
export interface SecureCredential {
  /** Unique identifier for the credential */
  id: string;
  /** The sensitive data */
  data: Buffer | string;
  /** Optional metadata */
  metadata?: Record<string, any>;
  /** Timestamp when credential was created */
  createdAt: Date;
  /** Timestamp when credential expires (optional) */
  expiresAt?: Date;
}

/**
 * Response from secure vault operations
 */
export interface VaultResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  processId?: number;
}

/**
 * Message structure for IPC communication with child process
 */
export interface VaultMessage {
  id: string;
  action: 'store' | 'retrieve' | 'delete' | 'list' | 'clear';
  payload?: any;
}

/**
 * Child process state information
 */
export interface ProcessState {
  pid: number;
  isAlive: boolean;
  credentialCount: number;
  memoryUsage: NodeJS.MemoryUsage;
  startTime: Date;
}

export type ValidRequestNames = typeof validRequests[number];