# Bitcore Vault

A secure wallet management system that provides process isolation and secure memory handling for sensitive cryptographic operations. Part of the Bitcore ecosystem.

## Overview

`bitcore-vault` provides a secure way to manage cryptocurrency wallets by isolating sensitive operations in a child process with secure heap allocation. This approach provides several security benefits:

- **Process Isolation**: Sensitive wallet operations are kept in a separate process
- **Secure Memory Management**: Uses secure memory patterns and automatic cleanup
- **Encrypted Communication**: All sensitive data is encrypted during IPC communication
- **Vault Access Pattern**: Higher-order functions ensure proper unlock/lock cycles
- **Buffer Security**: Secure input handling that never stores sensitive data as strings

## Architecture

```
┌─────────────────┐    IPC    ┌─────────────────────┐
│   Main Process  │ ◄──────►  │   Child Process     │
│                 │           │                     │
│ VaultWalletProxy│           │ SecureProcess       │
│ (Public API)    │           │ VaultWallet         │
│                 │           │ RSA Keypair         │
│                 │           │ Secure Memory       │
└─────────────────┘           └─────────────────────┘
```

## Installation

```bash
# In the bitcore monorepo
npm install

# Install dependencies for this package
cd packages/bitcore-vault
npm install
```

## Quick Start

```typescript
import { VaultWalletProxy } from 'bitcore-vault';

const proxy = new VaultWalletProxy();

// Initialize the vault system
await proxy.initialize();

// Load a wallet
const address = await proxy.loadWallet({ 
  name: 'my-wallet',
  storageType: 'Level' 
});

// Add passphrase (will prompt user)
const result = await proxy.addPassphrase('my-wallet');
if (result.success) {
  console.log('Passphrase added successfully');
}

// Clean up
proxy.terminate();
```

## Core Components

### VaultWalletProxy

The main interface for interacting with the vault system. Handles:
- Child process management
- RSA key exchange
- Encrypted communication
- Wallet address mapping

```typescript
class VaultWalletProxy {
  public walletAddresses: Map<string, string>;
  
  async initialize(): Promise<void>
  async loadWallet(options: { name: string; storageType?: string }): Promise<string>
  async addPassphrase(walletName: string): Promise<{ success: boolean }>
  terminate(): void
}
```

### VaultWallet

Extends the base `Wallet` class from `bitcore-client` with secure access patterns:

```typescript
class VaultWallet extends Wallet {
  async checkPassphrase(passphrase: Buffer): Promise<{ success: boolean }>
  async signTx(params: any): Promise<any>
  // Other methods require vault access wrapper
}
```

### SecureProcess

Runs in the child process and handles:
- RSA keypair generation
- Wallet loading and management
- Passphrase validation and storage
- Secure memory operations

### BufferIO

Secure input handling utility that:
- Never stores sensitive data as strings
- Provides secure memory cleanup
- Handles raw terminal input safely
- Supports backspace and cancellation

## Security Features

### Process Isolation

- All sensitive operations run in a separate child process
- Main process only handles encrypted data
- Child process can be terminated without affecting main application
- Memory is completely isolated between processes

### Secure Memory Management

- Automatic cleanup of sensitive data using `crypto.randomFillSync()`
- Higher-order functions ensure proper unlock/lock cycles
- Buffer-based operations avoid string storage of secrets
- Secure heap allocation (when enabled)

### Encrypted Communication

- RSA keypair generated for each session
- All sensitive data encrypted before IPC transmission
- Public key stored in main process, private key in child process
- OAEP padding with SHA-256 for encryption

### Vault Access Pattern

The `withVaultAccess` higher-order function ensures:
1. Retrieve decrypted passphrase as Buffer
2. Call `super.unlock(passphrase)`
3. Overwrite passphrase buffer with random data
4. Execute the requested method
5. Call `super.lock()`

## API Reference

### VaultWalletProxy

#### Methods

- `initialize(): Promise<void>` - Initialize the proxy and spawn secure process
- `loadWallet(options): Promise<string>` - Load a wallet and return its address
- `addPassphrase(walletName): Promise<{ success: boolean }>` - Add passphrase for a wallet
- `terminate(): void` - Terminate the secure process

#### Properties

- `walletAddresses: Map<string, string>` - Mapping of wallet names to addresses

### VaultWallet

#### Methods

- `checkPassphrase(passphrase): Promise<{ success: boolean }>` - Verify a passphrase
- `signTx(params): Promise<any>` - Sign a transaction (requires vault access)
- `withVaultAccess<T>(passphrase, method, ...args): Promise<T>` - Execute method with vault access

### BufferIO (experimental)

#### Methods

- `readIn(prompt): Promise<Buffer>` - Securely read user input into a buffer

## Examples

### Basic Wallet Management

```typescript
import { VaultWalletProxy } from 'bitcore-vault';

async function manageWallets() {
  const proxy = new VaultWalletProxy();
  
  try {
    // Initialize the vault system
    await proxy.initialize();
    
    // Load multiple wallets
    const wallet1 = await proxy.loadWallet({ name: 'main-wallet' });
    const wallet2 = await proxy.loadWallet({ name: 'trading-wallet' });
    
    console.log('Loaded wallets:', proxy.walletAddresses);
    
    // Add passphrases
    await proxy.addPassphrase('main-wallet');
    await proxy.addPassphrase('trading-wallet');
    
    // Wallets are now ready for secure operations
    
  } finally {
    proxy.terminate();
  }
}
```

### Running the Example Script

```bash
npm run run:example
```

This will start an interactive session where you can:
1. Load multiple wallets by name
2. Add passphrases for each wallet
3. See the loaded wallet addresses

### Custom Integration

```typescript
import { VaultWalletProxy } from 'bitcore-vault';

class MyWalletManager {
  private proxy: VaultWalletProxy;
  
  constructor() {
    this.proxy = new VaultWalletProxy();
  }
  
  async setup() {
    await this.proxy.initialize();
  }
  
  async loadWallet(name: string) {
    return await this.proxy.loadWallet({ name });
  }
  
  async addPassphrase(name: string) {
    return await this.proxy.addPassphrase(name);
  }
  
  cleanup() {
    this.proxy.terminate();
  }
}
```

## Development

### Project Structure

```
src/
├── VaultWalletProxy.ts    # Main proxy interface
├── VaultWallet.ts         # Secure wallet implementation
├── SecureProcess.ts       # Child process handler
├── SecurityManager.ts     # Security utilities
├── bufferio.ts           # Secure input handling
└── examples/
    └── run.ts            # Example usage script

requirements/
├── VaultWallet.txt       # VaultWallet requirements
├── VaultWalletProxy.txt  # Proxy requirements
├── SecureProcess.txt     # Process requirements
└── ExampleScript.txt     # Example requirements

artifacts/
├── Next Steps.txt        # Development notes
└── class-diagram.png     # Architecture diagram
```

### Scripts

- `npm run build` - Compile TypeScript
- `npm run watch` - Watch mode compilation
- `npm run test` - Run tests
- `npm run lint` - Run linter
- `npm run clean` - Clean build artifacts
- `npm run run:example` - Run example script

### Building

```bash
npm run build
```

### Testing

```bash
npm run test
```

## Security Considerations

1. **Process Lifecycle**: Always call `terminate()` to properly clean up the child process
2. **Passphrase Handling**: Passphrases are automatically cleaned from memory after use
3. **Error Handling**: Handle initialization and communication errors gracefully
4. **Memory Limits**: The secure process has limited memory - avoid storing large amounts of data
5. **Key Management**: RSA keys are generated per session and not persisted

## Current Status

This package is in active development. Key areas being worked on:

- Integration of security protocols into the secure process
- Implementation of additional wallet operations
- Enhanced error handling and recovery
- Performance optimizations

## Upcoming Features

### Short-term

1. **Security Tasks List**
   - A comprehensive list of security tasks that must be run periodically
   - Mandatory execution before each secure operation (decrypting passphrases & unlocking wallets)
   - Tasks will include memory validation, process integrity checks, and security state verification
   - Automated security audit trail for compliance and monitoring

2. **Comprehensive Test Suite**
   - Unit tests for all core components (`VaultWalletProxy`, `VaultWallet`, `SecureProcess`)
   - Integration tests for the IPC communication flow
   - Security-focused tests for memory cleanup and encryption
   - Performance tests for secure operations
   - Mock testing for isolated component validation

3. **Enhanced VaultWallet Method Exposure**
   - Complete implementation of all `Wallet` methods through the `withVaultAccess` HOF
   - Methods like `derivePrivateKey`, `generateAddressPair`, `nextAddressPair`, and `importKeys`
   - Seamless integration with existing `bitcore-client` functionality
   - Consistent security patterns across all wallet operations

### Medium-long term

4. **TSS (Threshold Signature Scheme) Listener**
   - Automatic transaction signature capabilities
   - Integration with threshold signature protocols for enhanced security
   - Distributed key management support
   - Real-time transaction monitoring and signing
   - Multi-party signature coordination

## Requirements

- Node.js >= 18.0.0
- TypeScript 5.7.3+
- bitcore-client dependency

