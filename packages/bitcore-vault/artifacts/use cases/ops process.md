1. The ops process initializes a VaultWalletProxy instance
2. The ops process calls VaultWalletProxy.initialize()
3. VaultWalletProxy forks a secure process (the vault process)
4. The secure process creates a SecureProcess instance (SecureProcess)
5. SecureProcess creates a SecurityManager instance (no op)
6. SecureProcess generates rsa keypair
7. SecureProcess initializes publicKey, privateKey, and wallets map
8. SecureProcess sets up message handlers
-- Secure process is initialized --
9. VaultWalletProxy adds 'message' listener function this.handleResponse.bind(this)
10. VaultWalletProxy adds 'error' listener (simple console logger right now)
11. VaultWalletProxy sends 'getPublicKey' message (public key used for public key encryption across the IPC barrier)
12. VaultWalletProxy takes public key and stores it as an instance property
13. VaultWalletProxy returns to ops process run() caller
14. Ops process calls its walletCreationLoop
LOOP:
- Get wallet name
- VaultWalletProxy.loadWallet
    - Send message to secure process "loadWallet" with name
    - Secure process calls VaultWallet.loadWallet (passthrough to Wallet.loadWallet)
    - Secure process sets walletName:wallet in wallets instance property
    - Secure process calls wallet.deriveAddress(0, false)
    - Secure process returns address
    - VaultWalletProxy sets name: address in walletAddresses
15. Ops process calls addPassphrases. For each wallet of VaultWalletProxy.walletAddresses.keys()
LOOP
- Calls VaultWalletProxy.addPassphrase(walletName)
- VaultWalletProxy prompts for passphrase (NOTE! STRING - FIX THIS)
- VaultWalletProxy creates buffer from passphrase
- VaultWalletProxy public encrypts passphrase
- VaultWalletProxy sends "addPhrase" message with wallet name and encryptedPassphrase
- Secure process decrypts passphrase
- Secure process calls VaultWallet instance's checkPassphrase
- VaultWallet calls super.unlock() with passphrase, returns { success: true } if unlocks, false otherwise. Then randomFillSyncs the passphrase & locks the wallet and returns
- If success, Secure process adds passphrase (encrypted) to wallet entry and re-sets the wallet entry

This represents the steady state of the app - although it probably needs some sort of 