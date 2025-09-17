sequenceDiagram
    participant Script
    participant VaultWalletProxy
    participant SecureProcess
    participant VaultWallet as N VaultWallets

    %% --- Initialization ---
    Script->>VaultWalletProxy: const vaultWalletProxy = new VaultWalletProxy()
    Script->>VaultWalletProxy: await vaultWalletProxy.initialize()
    VaultWalletProxy->>SecureProcess: child_process.fork()
    SecureProcess-->>VaultWalletProxy: (SecureProcess runtime initialized, RSA keypair created)
    VaultWalletProxy->>SecureProcess: getPublicKey
    SecureProcess-->>VaultWalletProxy: publicKey
    VaultWalletProxy-->>Script: initialize() complete

    %% --- Wallet loading loop ---
    loop While user provides wallet details
        Script->>Script: Prompt user for wallet details or Quit
        alt User provides wallet details
            Script->>VaultWalletProxy: loadWallet(details)
            VaultWalletProxy->>SecureProcess: loadWallet(details)
            SecureProcess->>SecureProcess: Create VaultWallet & store in Map
            SecureProcess-->>VaultWalletProxy: wallet publicAddress
            VaultWalletProxy->>VaultWalletProxy: Store walletName → publicAddress
            VaultWalletProxy-->>Script: loadWallet() complete
        else User quits
            Script->>Script: break loop
        end
    end

    %% --- Passphrase loop ---
    loop For each wallet in VaultWalletProxy.walletAddresses
        Script->>VaultWalletProxy: addPassphrase(walletName)
        VaultWalletProxy->>Script: Prompt user for passphrase
        Script-->>VaultWalletProxy: passphrase
        VaultWalletProxy->>VaultWalletProxy: Encrypt passphrase with publicKey
        VaultWalletProxy->>SecureProcess: addPassphrase(walletName, encryptedPassphrase)
        SecureProcess->>SecureProcess: Store encrypted passphrase in Map
        SecureProcess-->>VaultWalletProxy: Acknowledge
        VaultWalletProxy-->>Script: addPassphrase() complete
    end

    %% --- Task Execution ---
    Script->>Script: Perform actual tasks with loaded wallets
