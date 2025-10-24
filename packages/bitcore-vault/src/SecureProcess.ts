import * as crypto from 'crypto';
import inspector from 'node:inspector';
import { StorageType } from '../../bitcore-client/src/types/storage';
import { SecurityManager } from './SecurityManager';
import { VaultWallet } from './VaultWallet';
import { installSignalPolicyHard } from './SignalHardening';
import { inspect } from 'node:util';

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
  private securityQuickCheckInterval: NodeJS.Timeout | null = null;
  private securitySlowCheckInterval: NodeJS.Timeout | null = null;
  private readonly securityCheckIntervalMs: number = 30000; // 30 seconds

  constructor() {
    this.securityManager = new SecurityManager();
    // Initial security checks
    if (!SecurityManager.isSecureHeapEnabled()) {
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

    const allocationBefore = SecurityManager.getCurrentSecureHeapAllocation();
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
    const allocationAfter = SecurityManager.getCurrentSecureHeapAllocation();

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

    // Start the security check intervals
    this.startSecurityCheckIntervals();
  }

  private startSecurityCheckIntervals() {
    // Start quick security check interval
    this.securityQuickCheckInterval = setInterval(() => {
      console.log('Running quick security check'); // FOR DEV USE ONLY - REMOVE
      const checkResult = this.securityManager.runQuickSecurityCheck();
      if (!checkResult?.result) {
        console.error(`Quick security check failed: ${checkResult.reason}`);
        // @TODO: Implement proper teardown/remediation
        process.exit(1);
      }

      // Proof of concept log - must be removed
      if (checkResult.result === true) {
        console.log('Quick security checks passed');
      }
    }, this.securityCheckIntervalMs);

    // Start slow security check interval
    this.securitySlowCheckInterval = setInterval(async () => {
      try {
        console.log('Running slow security check'); // FOR DEV USE ONLY - REMOVE
        const checkResult = await this.securityManager.runSlowSecurityCheck();
        if (!checkResult?.result) {
          console.error(`Slow security check failed: ${checkResult.reason}`);
          // @TODO: Implement proper teardown/remediation
          process.exit(1);
        }

        // Proof of concept log - must be removed
        if (checkResult.result === true) {
          console.log('Slow security checks passed');
        }
      } catch (err) {
        console.error('Error during slow security check:', err);
        process.exit(1);
      }
    }, 5000);
  }

  private cleanupSecurityCheckIntervals() {
    if (this.securityQuickCheckInterval) {
      clearInterval(this.securityQuickCheckInterval);
      this.securityQuickCheckInterval = null;
    }
    if (this.securitySlowCheckInterval) {
      clearInterval(this.securitySlowCheckInterval);
      this.securitySlowCheckInterval = null;
    }
    console.log('Security check intervals cleaned up');
  }

  private checkSecureHeap(): boolean {
    return SecurityManager.isSecureHeapEnabled();
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
      console.log('Before passphrase decrypt - alloc:', SecurityManager.getCurrentSecureHeapAllocation());
      passphrase = crypto.privateDecrypt(
        {
          key: this.privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        encryptedPassphraseBuffer
      );
      console.log('After passphrase decrypt - alloc:', SecurityManager.getCurrentSecureHeapAllocation());

      // This method is responsible for its own cleanup of the passphrase buffer.
      // We wrap this in a try/finally as a defense-in-depth measure.
      const { success: returnedSuccess } = await walletEntry.wallet.checkPassphrase(passphrase);
      console.log('After passphrase check', SecurityManager.getCurrentSecureHeapAllocation());
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

  public async cleanupSecureProcess(): Promise<void> {
    try {
      console.log('Starting secure process cleanup...');

      // 1. Iterate over wallets and zeroize passphrases before clearing
      for (const [name, walletEntry] of this.wallets.entries()) {
        try {
          // Zeroize passphrase buffer if it exists
          if (Buffer.isBuffer(walletEntry.passphrase)) {
            crypto.randomFillSync(walletEntry.passphrase);
          }
          // Remove wallet from map entirely to allow garbage collection
          this.wallets.delete(name);
        } catch (err) {
          console.error(`Error cleaning up wallet ${name}:`, err);
        }
      }

      // 2. Clear the wallets map itself
      this.wallets.clear();
      (this.wallets as any) = null;

      // 3. Zeroize and null the private and public keys
      // Note: KeyObjects are managed by crypto module; nulling the reference
      // doesn't guarantee immediate memory cleanup, but it helps GC
      (this.privateKey as any) = null;
      (this.publicKey as any) = null;

      // 4. Stop security check intervals
      this.cleanupSecurityCheckIntervals();

      console.log('Secure process cleanup completed');
    } catch (err) {
      console.error('Error during cleanup:', err);
      // Continue with exit even if cleanup errors
    }
  }
}

// Instantiate and run the secure process
if (require.main === module) {
  const secureProcessInstance = new SecureProcess();
  // lockdownProcess() MUST BE called after instance creation so cleanup has access to it
  lockdownProcess(async () => {
    await secureProcessInstance.cleanupSecureProcess();
  });

    // run one-time checks
    (async () => {
      if (
        SecurityManager.checkInspectFlagsAtLaunch() ||
        SecurityManager.inspectorUrlExists() ||
        (await SecurityManager.probeDebugPort())
      ) {
        process.exit(1);
      }
    })()
    .catch(() => {
      console.error('Startup check failed');
      process.exit(1);
    });
}

function lockdownProcess(onShutdown?: () => void | Promise<void>): void {
  try {
  // Signal lockdown
  installSignalPolicyHard(async () => {
    if (onShutdown) {
      await onShutdown();
    }
  }); } catch {
    console.error('Signal policy hardening failed');
    process.exit(1);
  }

  // Explict inspector check - should 
  try {
    inspector.close();
  } catch {/** no op - expected if inspector not available on child fork */}

  // Inspector override
  try {
    // Prevent programmatic reopen
    Object.defineProperty(inspector, 'open', {
      value() { throw new Error('Debugger is disabled for this process.'); },
      writable: false, configurable: false, enumerable: true
    });
    Object.freeze(inspector);
  } catch (err) {
    console.error('Inspector override failed');
    process.exit(1);
  }


}