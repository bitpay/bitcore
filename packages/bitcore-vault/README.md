# Bitcore Secret Vault

A TypeScript library for securely storing sensitive credentials in a child process with secure heap allocation. Part of the Bitcore ecosystem.

## Overview

`bitcore-secret-vault` provides a secure way to store sensitive data such as private keys, passwords, and tokens by isolating them in a child process that utilizes Node.js secure heap allocation. This approach provides several security benefits:

- **Process Isolation**: Sensitive data is kept in a separate process
- **Secure Heap**: Uses Node.js `--secure-heap` feature for memory protection
- **Memory Management**: Automatic cleanup and garbage collection
- **Data Encryption**: Credentials are serialized securely
- **Expiration Support**: Automatic cleanup of expired credentials

## Architecture

```
┌─────────────────┐    IPC     ┌─────────────────────┐
│   Main Process  │ ◄──────► │   Child Process     │
│                 │           │                     │
│ SecureVault     │           │ SecureChildProcess  │
│ CredentialMgr   │           │ Secure Heap Memory  │
│                 │           │ Isolated Storage    │
└─────────────────┘           └─────────────────────┘
```

## Installation

```bash
# In the bitcore monorepo
npm install

# Install dependencies for this package
cd packages/bitcore-secret-vault
npm install
```

## Quick Start

```typescript
import { SecureVault } from 'bitcore-secret-vault';

const vault = new SecureVault({
  maxCredentials: 100,
  enableSecureHeap: true,
  secureHeapSize: 1024 * 1024 // 1MB
});

// Initialize the vault
await vault.initialize();

// Store a credential
await vault.storeCredential({
  id: 'my-private-key',
  type: 'private_key',
  data: 'L1234567890abcdef...',
  metadata: { wallet: 'main' }
});

// Retrieve the credential
const result = await vault.retrieveCredential('my-private-key');
if (result.success) {
  console.log('Retrieved:', result.data);
}

// Clean up
await vault.shutdown();
```

## API Reference

### SecureVault

The main class for managing secure credential storage.

#### Constructor Options

```typescript
interface SecureVaultConfig {
  maxCredentials?: number;      // Max credentials to store (default: 100)
  processTimeout?: number;      // Operation timeout in ms (default: 30000)
  enableSecureHeap?: boolean;   // Enable secure heap (default: true)
  secureHeapSize?: number;      // Secure heap size in bytes (default: 1MB)
}
```

#### Methods

- `initialize(): Promise<void>` - Initialize the vault and spawn child process
- `storeCredential(credential): Promise<VaultResponse<string>>` - Store a credential
- `retrieveCredential(id): Promise<VaultResponse<SecureCredential>>` - Retrieve a credential
- `deleteCredential(id): Promise<VaultResponse<boolean>>` - Delete a credential
- `listCredentials(): Promise<VaultResponse<string[]>>` - List credential IDs
- `clearVault(): Promise<VaultResponse<boolean>>` - Clear all credentials
- `getProcessState(): Promise<ProcessState | null>` - Get child process state
- `shutdown(): Promise<void>` - Shutdown and cleanup

#### Events

- `initialized` - Vault is ready for use
- `credentialStored` - A credential was stored
- `credentialRetrieved` - A credential was retrieved
- `credentialDeleted` - A credential was deleted
- `vaultCleared` - All credentials were cleared
- `error` - An error occurred
- `shutdown` - Vault was shut down

### SecureCredential

```typescript
interface SecureCredential {
  id: string;                    // Unique identifier
  type: string;                  // Type (e.g., 'private_key', 'password')
  data: Buffer | string;         // Sensitive data
  metadata?: Record<string, any>; // Optional metadata
  createdAt: Date;               // Creation timestamp
  expiresAt?: Date;              // Optional expiration
}
```

## Security Features

### Secure Heap Allocation

The child process is spawned with Node.js secure heap options:

```bash
node --secure-heap=1048576 --secure-heap-min=1024 child-process.js
```

This provides:
- Memory pages that are not swapped to disk
- Protection against memory dumps
- Automatic zeroing of deallocated memory

### Process Isolation

- Credentials are stored only in the child process
- IPC communication for all operations
- Child process can be terminated without affecting main process
- Memory is isolated from the main application

### Memory Management

- Automatic cleanup of expired credentials
- Secure memory overwriting before deletion
- Periodic garbage collection
- Memory usage monitoring

## Examples

### Basic Usage

```typescript
import { SecureVault } from 'bitcore-secret-vault';

async function example() {
  const vault = new SecureVault();
  await vault.initialize();

  // Store multiple types of credentials
  await vault.storeCredential({
    id: 'btc-wallet-key',
    type: 'private_key',
    data: 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn'
  });

  await vault.storeCredential({
    id: 'api-token',
    type: 'token',
    data: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    expiresAt: new Date(Date.now() + 3600000) // 1 hour
  });

  // List and retrieve
  const list = await vault.listCredentials();
  console.log('Stored credentials:', list.data);

  const key = await vault.retrieveCredential('btc-wallet-key');
  console.log('Retrieved key:', key.data);

  await vault.shutdown();
}
```

### With Event Handling

```typescript
const vault = new SecureVault();

vault.on('credentialStored', (id) => {
  console.log(`Stored: ${id}`);
});

vault.on('error', (err) => {
  console.error('Vault error:', err);
});

await vault.initialize();
// ... use vault
```

### Advanced Configuration

```typescript
const vault = new SecureVault({
  maxCredentials: 500,
  processTimeout: 60000,
  enableSecureHeap: true,
  secureHeapSize: 4 * 1024 * 1024, // 4MB secure heap
});
```

## Testing

```bash
npm run test
```

## Building

```bash
npm run build
```

## Security Considerations

1. **Process Termination**: The child process will automatically clean up memory on termination
2. **Memory Limits**: Configure appropriate heap sizes for your use case
3. **Credential Expiration**: Use expiration dates for temporary credentials
4. **Error Handling**: Always handle vault errors gracefully
5. **Cleanup**: Always call `shutdown()` when done

## Development

### Project Structure

```
src/
├── index.ts              # Main exports
├── types.ts              # TypeScript interfaces
├── SecureVault.ts        # Main vault class
├── SecureProcess.ts      # Child process management
├── CredentialManager.ts  # Credential validation/serialization
└── child-process.ts      # Child process implementation

test/
├── SecureVault.test.ts   # Unit tests

examples/
└── basic-usage.ts        # Usage examples
```

### Scripts

- `npm run build` - Build TypeScript
- `npm run watch` - Watch mode compilation
- `npm run test` - Run tests
- `npm run lint` - Run linter
- `npm run clean` - Clean build artifacts

## License

ISC

## Contributing

Follow the Bitcore contributing guidelines. Ensure all tests pass and code is properly linted before submitting PRs. 