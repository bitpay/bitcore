import * as readline from 'readline';
import { VaultWalletProxy } from '../VaultWalletProxy';

class WalletLoader {
  private vaultWalletProxy: VaultWalletProxy;
  private rl: readline.Interface;
  private passphraseTriesPerWallet = 3;

  constructor() {
    this.vaultWalletProxy = new VaultWalletProxy();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private askQuestion(query: string): Promise<string> {
    return new Promise((resolve) => this.rl.question(query, resolve));
  }

  async run(): Promise<void> {
    console.log('[EXAMPLE] Initializing Vault Wallet Proxy...');
    await this.vaultWalletProxy.initialize();
    console.log('[EXAMPLE] Initialization complete.');

    await this.walletCreationLoop();

    this.rl.close();

    await this.addPassphrases();

    // Start security monitoring intervals now that user input is complete
    console.log('[EXAMPLE] \nStarting security monitoring...');
    await this.vaultWalletProxy.startSecurityMonitoring();
    console.log('[EXAMPLE] Security monitoring started.');

    console.log('\n[EXAMPLE] Wallets and passphrases loaded. Here\'s where work tasks would be kicked off...');
    // Subsequent tasks can be added here.
    // For now, we just log the wallet addresses.
    while (true) {
      console.log('[EXAMPLE] Loaded wallet addresses:', this.vaultWalletProxy.walletAddresses);
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
  }

  private async walletCreationLoop(): Promise<void> {
    while (true) {
      const walletName = await this.askQuestion(
        '\nEnter wallet name (or type "quit" to finish): '
      );
      if (walletName.toLowerCase() === 'quit') {
        break;
      }

      const walletOptions = { name: walletName };

      try {
        console.log(`Loading wallet "${walletName}"...`);
        const address = await this.vaultWalletProxy.loadWallet(walletOptions);
        console.log(`Wallet "${walletName}" loaded with public address: ${address}`);
      } catch (error) {
        console.error(`Failed to load wallet "${walletName}":`, error);
      }
    }
  }

  private async addPassphrases(): Promise<void> {
    console.log('[EXAMPLE] \n--- Adding Passphrases ---');
    // Create a snapshot of wallet names since we might remove wallets during iteration
    const walletNames = Array.from(this.vaultWalletProxy.walletAddresses.keys());
    for (const walletName of walletNames) {
      try {
        console.log(`\nAdding passphrase for wallet: ${walletName}`);
        let success = false;
        let remainingTries = this.passphraseTriesPerWallet;
        while (!success && remainingTries > 0) {
          const { success: returnedSuccess } = await this.vaultWalletProxy.addPassphrase(walletName);
          success = returnedSuccess;
          if (!success) {
            remainingTries--;
            if (remainingTries > 0) {
              console.log(`  Passphrase not successfully added - you have ${remainingTries} tries remaining`);
            } else {
              console.log(`  No remaining tries - removing ${walletName}`);
              await this.vaultWalletProxy.removeWallet(walletName);
              console.log(`  Wallet "${walletName}" has been removed.`);
            }
          }
        }
        if (success) {
          console.log(`Passphrase added for ${walletName}.`);
        } else {
          console.log(`Passphrase not added for ${walletName} - wallet removed.`);
        }
      } catch (error) {
        console.error(`Failed to add passphrase for ${walletName}:`, error);
      }
    }
  }
}

const loader = new WalletLoader();
loader
  .run()
  .then(() => {
    console.log('[EXAMPLE] Script ran - exiting');
    process.exit(0);
  })
  .catch((error) => {
    console.error('An unexpected error occurred:', error);
    process.exit(1);
  });

