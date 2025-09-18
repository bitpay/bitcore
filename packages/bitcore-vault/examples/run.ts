import * as readline from 'readline';
import { VaultWalletProxy } from '../src/VaultWalletProxy';
import { WalletObj } from '../../bitcore-client/src/wallet';

class WalletLoader {
  private vaultWalletProxy: VaultWalletProxy;
  private rl: readline.Interface;

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
    console.log('Initializing Vault Wallet Proxy...');
    await this.vaultWalletProxy.initialize();
    console.log('Initialization complete.');

    await this.walletCreationLoop();

    this.rl.close();

    await this.addPassphrases();

    console.log('\nWallets and passphrases loaded. Performing subsequent tasks...');
    // Subsequent tasks can be added here.
    // For now, we just log the wallet addresses.
    console.log('Loaded wallet addresses:', this.vaultWalletProxy.walletAddresses);


    this.vaultWalletProxy.terminate();
    console.log('Secure process terminated. Script finished.');
  }

  private async walletCreationLoop(): Promise<void> {
    while (true) {
      const walletName = await this.askQuestion(
        '\nEnter wallet name (or type "quit" to finish): '
      );
      if (walletName.toLowerCase() === 'quit') {
        break;
      }

      const chain = await this.askQuestion('Enter chain (e.g., btc, bch): ');
      const network = await this.askQuestion('Enter network (e.g., livenet, testnet): ');

      const walletOptions: WalletObj = {
        name: walletName,
        chain,
        network,
        baseUrl: '',
        path: '',
        password: '',
        storageType: '',
        tokens: [],
        lite: false,
        addressType: ''
      };

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
    console.log('\n--- Adding Passphrases ---');
    for (const walletName of this.vaultWalletProxy.walletAddresses.keys()) {
      try {
        console.log(`\nAdding passphrase for wallet: ${walletName}`);
        await this.vaultWalletProxy.addPassphrase(walletName);
        console.log(`Passphrase added for ${walletName}.`);
      } catch (error) {
        console.error(`Failed to add passphrase for ${walletName}:`, error);
      }
    }
  }
}

const loader = new WalletLoader();
loader
  .run()
  .catch((error) => {
    console.error('An unexpected error occurred:', error);
    process.exit(1);
  });
