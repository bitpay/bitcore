# Setup Use Case

## Overview
This use case describes the setup process for initializing a Vault Wallet system with secure process management and wallet loading capabilities.

## Actors
- **System Administrator**: Initiates the setup process
- **VaultWalletProxy**: Manages communication with secure process
- **SecureProcess**: Handles sensitive operations in isolated environment
- **VaultWallet**: Manages individual wallet instances

## Preconditions
- Vault Wallet system is installed
- Required dependencies are available
- System has appropriate permissions for process spawning

## Main Flow

### 1. Initialization Phase
1. **System Administrator** starts the setup process
2. **VaultWalletProxy** is instantiated
3. **VaultWalletProxy.initialize()** is called:
   - Spawns secure child process (`SecureProcess.js`)
   - Secure process generates RSA key pairs (2048-bit modulus)
   - Secure process sets up message handling infrastructure
   - VaultWalletProxy requests and receives public key from secure process
   - VaultWalletProxy stores public key for future encryption operations

### 2. Wallet Loading Phase
4. **System Administrator** enters wallet names interactively
5. For each wallet name:
   - **VaultWalletProxy.loadWallet()** is called with wallet options
   - Message is sent to secure process with `loadWallet` action
   - **SecureProcess** receives message and calls `VaultWallet.loadWallet()`
   - **VaultWallet** loads wallet from storage using specified storage type
   - Secure process derives public address (index 0, non-change)
   - Public address is returned to VaultWalletProxy
   - VaultWalletProxy stores wallet name → address mapping

### 3. Passphrase Verification Phase
6. For each loaded wallet:
   - **System Administrator** is prompted for passphrase
   - **VaultWalletProxy** encrypts passphrase using secure process public key:
     - Uses RSA-OAEP padding with SHA-256 hash
     - Converts to base64 for transmission
     - Clears passphrase buffer from memory
   - Encrypted passphrase is sent to secure process
   - **SecureProcess** receives encrypted passphrase:
     - Decrypts using private key
     - Calls **VaultWallet.checkPassphrase()** to verify
     - Clears passphrase buffer from memory
     - Stores encrypted passphrase if verification succeeds
   - Success/failure status is returned to VaultWalletProxy
   - Process repeats up to 3 times per wallet if verification fails

## Postconditions
- Secure process is running and ready to handle requests
- All specified wallets are loaded and verified
- Wallet addresses are available for external reference
- System is in steady-state operation mode (no exit)

## Alternative Flows

### Wallet Loading Failure
- If wallet cannot be loaded: error is logged, process continues with next wallet
- If wallet already exists: error is thrown, process stops for that wallet

### Passphrase Verification Failure
- If passphrase verification fails: retry up to 3 times
- If all retries exhausted: wallet is marked for removal (TODO: implement removal)

### Secure Process Failure
- If secure process fails to start: initialization fails, process exits
- If secure process crashes: error is logged, system attempts recovery

## Notes
- This use case excludes the completion and exit phases
- System remains in steady-state after setup completion
- All sensitive operations are performed within the secure process
- Memory cleanup is performed for all passphrase operations
- The system is designed to handle multiple wallets concurrently
