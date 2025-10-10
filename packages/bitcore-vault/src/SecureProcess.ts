import * as crypto from 'crypto';
import { StorageType } from '../../bitcore-client/src/types/storage';
import { SecurityManager } from './SecurityManager';
import { VaultWallet } from './VaultWallet';

// Define a type for the wallet entry in our map
interface WalletEntry {
  wallet: VaultWallet;
  passphrase?: Buffer; // Encrypted passphrase
}

// Uniform message structure from VaultWalletProxy
interface SecureProcessMessage {
  action: string;
  payload: any;
  messageId: string;
}

export class SecureProcess {
  private privateKey: crypto.KeyObject;
  private publicKey: crypto.KeyObject;
  private wallets: Map<string, WalletEntry>;
  private securityManager: SecurityManager;
  private securityCheckInterval: NodeJS.Timeout | null = null;
  private readonly securityCheckIntervalMs: number = 30000; // 30 seconds

  constructor() {
    this.securityManager = new SecurityManager();
    if (!this.securityManager.isSecureHeapEnabled()) {
      console.error('Secure heap not enabled - secure process terminating');
      process.exit(1);
    }

    this.wallets = new Map<string, WalletEntry>();
    this.setupMessageHandler();
  }


  private setupMessageHandler() {
    process.on('message', (msg: SecureProcessMessage) => {
      this.handleMessage(msg);
    });
  }

  private async handleMessage(msg: SecureProcessMessage) {
    const { action, payload, messageId } = msg;

    let teardownAfterSend = false;
    try {
      let result: any;
      switch (action) {
        case 'initialize':
          result = await this.initialize();
          break;
        case 'checkSecureHeap':
          result = this.checkSecureHeap();
          // If result is false, flip teardownAfterSend
          teardownAfterSend = !result;
          break;
        case 'getPublicKey':
          result = this.getPublicKey();
          break;
        case 'loadWallet':
          result = await this.loadWallet(payload);
          break;
        case 'addPassphrase':
          result = await this.addPassphrase(payload);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      this.sendResponse(messageId, result);


    } catch (error) {
      this.sendError(messageId, error as Error);
      // Running list of methods to flip teardownAfterSend on ANY error
      teardownAfterSend = ['checkSecureHeap'].includes(action);
    } finally {
      if (teardownAfterSend) {
        console.log('teardownAfterSend', teardownAfterSend);
        // @TODO better teardown
        process.exit(1);
      }
    }
  }

  private sendResponse(messageId: string, result: any) {
    if (process.send) {
      process.send({ messageId, result });
    }
  }

  private sendError(messageId: string, error: Error) {
    if (process.send) {
      process.send({ messageId, error: { message: error.message, stack: error.stack } });
    }
  }

  private async initialize() {
    // Ensure secure heap allocation settles before getting secure heap allocation baseline
    await new Promise(resolve => setTimeout(resolve, 500));

    const allocationBefore = this.securityManager.getCurrentSecureHeapAllocation();
    // Validate allocation measurement is a valid number
    if (typeof allocationBefore !== 'number' || allocationBefore < 0) {
      throw new Error(`Invalid secure heap allocation measurement: ${allocationBefore}`);
    }

    const keypair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    if (!(keypair?.privateKey && keypair.publicKey)) {
      console.error('CRITICAL: RSA key generation failed');
      // These might should just be error messages back across the boundary and then it'll shut down afterwards. Below too.
      process.exit(1);
    };

    // Ensure secure heap allocation settles before getting secure heap allocation after key creation
    await new Promise(resolve => setTimeout(resolve, 500));
    const allocationAfter = this.securityManager.getCurrentSecureHeapAllocation();

    // Validate allocation measurement is a valid number
    if (typeof allocationAfter !== 'number' || allocationAfter < 0) {
      console.error(`Invalid secure heap allocation measurement: ${allocationAfter}`);
      process.exit(1);
    }

    // Ensure we actually allocated secure heap memory for the keypair
    // Note - something around 1400 bytes I think is right
    if (allocationAfter <= allocationBefore) {
      console.error(`RSA keypair may not be stored in secure heap. Before: ${allocationBefore}, After: ${allocationAfter}`);
      process.exit(1);
    }

    this.publicKey = keypair.publicKey;
    this.privateKey = keypair.privateKey;
    this.securityManager.setBaselineSecureHeapAllocation(allocationAfter - allocationBefore);

    // Start the security check interval
    this.startSecurityCheckInterval();
  }

  private startSecurityCheckInterval() {
    this.securityCheckInterval = setInterval(() => {
      console.log('Running security check'); // FOR DEV USE ONLY - REMOVE
      const checkResult = this.securityManager.runSecurityCheck();
      if (!checkResult?.result) {
        console.error(`Security check failed: ${checkResult.reason}`);
        // @TODO: Implement proper teardown/remediation
        process.exit(1);
      }

      // Proof of concept log - must be removed
      if (checkResult.result === true) {
        console.log('Security checks passed');
      }
    }, this.securityCheckIntervalMs);
  }

  private checkSecureHeap(): boolean {
    return this.securityManager.isSecureHeapEnabled();
  }

  private getPublicKey(): string {
    return this.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  }

  private async loadWallet({ name, storageType = 'Level' }: { name: string; storageType?: StorageType }): Promise<string> {
    const wallet = await VaultWallet.loadWallet({ name, storageType });
    const walletName = name;
    if (!walletName) {
      throw new Error('Wallet name must be provided.');
    }

    // @TODO - this should probably be hoisted
    if (this.wallets.has(walletName)) {
      throw new Error(`Wallet with name ${walletName} already loaded.`);
    }

    this.wallets.set(walletName, { wallet });
    const address = wallet.deriveAddress(0, false);
    // @TODO - do we want to sync wallet tokens here too? See sweep script

    return address;
  }

  private async addPassphrase(payload: { name: string; encryptedPassphrase: string }): Promise<{ success: boolean }> {
    const { name, encryptedPassphrase } = payload;
    const walletEntry = this.wallets.get(name);

    if (!walletEntry) {
      throw new Error(`Wallet not found: ${name}`);
    }

    const encryptedPassphraseBuffer = Buffer.from(encryptedPassphrase, 'base64');

    let success = false;;
    // Decrypt the passphrase with the private key
    let passphrase: Buffer<ArrayBufferLike> | null = null;
    try {
      console.log('Before passphrase decrypt - alloc:', this.securityManager.getCurrentSecureHeapAllocation());
      passphrase = crypto.privateDecrypt(
        {
          key: this.privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        encryptedPassphraseBuffer
      );
      console.log('After passphrase decrypt - alloc:', this.securityManager.getCurrentSecureHeapAllocation());

      // This method is responsible for its own cleanup of the passphrase buffer.
      // We wrap this in a try/finally as a defense-in-depth measure.
      const { success: returnedSuccess } = await walletEntry.wallet.checkPassphrase(passphrase);
      console.log('After passphrase check', this.securityManager.getCurrentSecureHeapAllocation());
      success = returnedSuccess;
    } finally {
      if (Buffer.isBuffer(passphrase)) {
        // Overwrite the buffer to ensure the secret is not left in memory.
        crypto.randomFillSync(passphrase);
      }
    }

    if (success) {
      // Store the encrypted passphrase
      walletEntry.passphrase = encryptedPassphraseBuffer;
      this.wallets.set(name, walletEntry);
    }

    return { success };
  }
}

// Instantiate and run the secure process
if (require.main === module) {
  new SecureProcess();
}
