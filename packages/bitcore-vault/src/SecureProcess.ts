import * as crypto from 'crypto';
import inspector from 'node:inspector';
import { StorageType } from '../../bitcore-client/src/types/storage';
import { SecurityManager } from './SecurityManager';
import { VaultWallet } from './VaultWallet';
import { installSignalPolicyHard } from './SignalHardening';
import { inspect } from 'node:util';

/**
 * CRITICAL: Module initialization hook to disable inspector at the absolute earliest point.
 * This must execute before ANY other code, including event loop startup.
 * 
 * Why at module load time?
 * - Node.js inspector C++ module registers SIGUSR1 handler when first imported
 * - By putting this at the top level, it can intercept the import before handler is registered
 * - This is defense-in-depth: prevents programmatic inspector access early
 * 
 * The security check remains the primary defense (it's working and catches debugger attachment)
 * This supplementary measure provides an additional layer.
 */
function hardcodeInspectorDisable(): void {
  try {
    // Disable programmatic access to inspector immediately
    inspector.close();
  } catch {
    // Expected if inspector not available or already closed
  }

  // Prevent reopening the inspector programmatically
  try {
    Object.defineProperty(inspector, 'open', {
      value() { throw new Error('Inspector is disabled for security reasons'); },
      writable: false,
      configurable: false,
      enumerable: true
    });
    
    Object.defineProperty(inspector, 'Session', {
      value: undefined,
      writable: false,
      configurable: false,
      enumerable: true
    });
    
    Object.freeze(inspector);
  } catch {
    // If we can't freeze, continue anyway - security check will catch it
  }
}

// Execute at module load time, before anything else
hardcodeInspectorDisable();

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
  private readonly securityQuickCheckIntervalMs: number = 5000;
  private readonly securitySlowCheckIntervalMs: number = 30000;

  constructor() {
    this.securityManager = new SecurityManager();
    // Initial security checks
    if (!SecurityManager.isSecureHeapEnabled()) {
      console.error('[SecureProcess] Secure heap not enabled - secure process terminating');
      // Send fatal error even though handler isn't set up yet - parent listens to all messages
      if (process.send) {
        process.send({
          messageId: 'fatal-constructor-' + Date.now(),
          error: { message: 'Secure heap not enabled' },
          fatalError: true
        });
      }
      // Give parent a moment to receive message, then force exit
      setTimeout(() => process.exit(1), 1000);
      return;
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

    let fatalErrorOccurred = false;
    try {
      let result: any;
      switch (action) {
        case 'initialize':
          result = await this.initialize();
          break;
        case 'checkSecureHeap':
          result = this.checkSecureHeap();
          // If secure heap check fails, it's a fatal error
          if (!result) {
            fatalErrorOccurred = true;
            this.sendFatalError('Secure heap check failed', messageId);
            return;
          }
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
        case 'startSecurityCheckIntervals':
          // Start the security check intervals after wallets are loaded
          this.startSecurityCheckIntervals();
          result = { success: true };
          break;
        case 'cleanup':
          // Handle cleanup request from parent
          await this.cleanupSecureProcess();
          result = { success: true };
          break;
        default:
          // Unknown action is a security concern - treat as fatal
          fatalErrorOccurred = true;
          this.sendFatalError(`Unknown action: ${action}`, messageId);
          return;
      }
      this.sendResponse(messageId, result);

    } catch (error) {
      const err = error as Error;
      
      // Determine if this is a fatal error
      const fatalActions = ['initialize', 'checkSecureHeap'];
      if (fatalActions.includes(action)) {
        fatalErrorOccurred = true;
        this.sendFatalError(err, messageId);
      } else {
        this.sendError(messageId, err);
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

  /**
   * Send a fatal error response to parent and wait for termination.
   * Parent will request cleanup and then kill this process.
   * If messageId is provided, responds to that message; otherwise sends unsolicited error.
   */
  private sendFatalError(error: Error | string, messageId?: string): void {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    console.error('[SecureProcess] Fatal error:', errorObj.message);
    
    if (process.send) {
      const response = {
        messageId: messageId || 'fatal-' + Date.now(),
        error: { message: errorObj.message, stack: errorObj.stack },
        fatalError: true
      };
      process.send(response);
    }
    
    // Wait for parent to send cleanup and terminate us
    // Set a timeout in case parent doesn't respond
    setTimeout(() => {
      console.error('[SecureProcess] Parent did not terminate within timeout. Forcing exit.');
      process.exit(1);
    }, 5000);
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
      throw new Error('CRITICAL: RSA key generation failed');
    };

    // Ensure secure heap allocation settles before getting secure heap allocation after key creation
    await new Promise(resolve => setTimeout(resolve, 500));
    const allocationAfter = SecurityManager.getCurrentSecureHeapAllocation();

    // Validate allocation measurement is a valid number
    if (typeof allocationAfter !== 'number' || allocationAfter < 0) {
      throw new Error(`Invalid secure heap allocation measurement: ${allocationAfter}`);
    }

    // Ensure we actually allocated secure heap memory for the keypair
    // Note - something around 1400 bytes I think is right
    if (allocationAfter <= allocationBefore) {
      throw new Error(`RSA keypair may not be stored in secure heap. Before: ${allocationBefore}, After: ${allocationAfter}`);
    }

    this.publicKey = keypair.publicKey;
    this.privateKey = keypair.privateKey;
    this.securityManager.setBaselineSecureHeapAllocation(allocationAfter - allocationBefore);

    // Run one-time security checks (but don't start intervals yet)
    console.log('Running initial quick security check...');
    const quickCheckResult = this.securityManager.runQuickSecurityCheck();
    if (!quickCheckResult?.result) {
      throw new Error(`Initial quick security check failed: ${quickCheckResult.reason}`);
    }
    console.log('Initial quick security check passed');

    console.log('Running initial slow security check...');
    const slowCheckResult = await this.securityManager.runSlowSecurityCheck();
    if (!slowCheckResult?.result) {
      throw new Error(`Initial slow security check failed: ${slowCheckResult.reason}`);
    }
    console.log('Initial slow security check passed');

    console.log('Initialization complete. Security check intervals will start after wallets are loaded.');
  }

  private startSecurityCheckIntervals() {
    // Start quick security check interval
    this.securityQuickCheckInterval = setInterval(() => {
      console.log('Running quick security check'); // FOR DEV USE ONLY - REMOVE
      const checkResult = this.securityManager.runQuickSecurityCheck();
      if (!checkResult?.result) {
        console.error(`Quick security check failed: ${checkResult.reason}`);
        this.sendFatalError(`Quick security check failed: ${checkResult.reason}`);
        return;
      }

      // TODO Proof of concept log - must be removed
      if (checkResult.result === true) {
        console.log('Quick security checks passed');
      }
    }, this.securityQuickCheckIntervalMs);

    // Start slow security check interval
    this.securitySlowCheckInterval = setInterval(async () => {
      try {
        console.log('Running slow security check'); // FOR DEV USE ONLY - REMOVE
        const checkResult = await this.securityManager.runSlowSecurityCheck();
        if (!checkResult?.result) {
          console.error(`Slow security check failed: ${checkResult.reason}`);
          this.sendFatalError(`Slow security check failed: ${checkResult.reason}`);
          return;
        }

        // TODO Proof of concept log - must be removed
        if (checkResult.result === true) {
          console.log('Slow security checks passed');
        }
      } catch (err) {
        console.error('Error during slow security check:', err);
        this.sendFatalError(err as Error);
      }
    }, this.securitySlowCheckIntervalMs);
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
      // Send fatal error for debug/inspector detection
      if (process.send) {
        process.send({
          messageId: 'fatal-startup-' + Date.now(),
          error: { message: 'Inspector/debugger detected at startup' },
          fatalError: true
        });
      }
      setTimeout(() => process.exit(1), 1000);
    }
  })()
  .catch((err) => {
    console.error('Startup check failed:', err);
    if (process.send) {
      process.send({
        messageId: 'fatal-startup-error-' + Date.now(),
        error: { message: `Startup check failed: ${err.message}` },
        fatalError: true
      });
    }
    setTimeout(() => process.exit(1), 1000);
  });
}

function lockdownProcess(onShutdown?: () => void | Promise<void>): void {
  try {
    console.log('[Lockdown] Installing signal policy hardening...');
    // Signal lockdown - install BEFORE any other operations
    installSignalPolicyHard(async () => {
      console.log('[Lockdown] Executing shutdown sequence...');
      if (onShutdown) {
        await onShutdown();
      }
    }); 
    console.log('[Lockdown] Signal policy hardening installed successfully');
  } catch (err) {
    console.error('[Lockdown] Signal policy hardening failed:', err);
    if (process.send) {
      process.send({
        messageId: 'fatal-lockdown-signal-' + Date.now(),
        error: { message: `Signal policy hardening failed: ${err}` },
        fatalError: true
      });
    }
    setTimeout(() => process.exit(1), 1000);
    return;
  }

  // Additional inspector hardening at runtime
  // This is defense-in-depth: the hardcodeInspectorDisable() at module load
  // handles programmatic reopening, but we also handle any edge cases here.
  try {
    console.log('[Lockdown] Performing runtime inspector security checks...');
    
    // Verify inspector is closed
    if (typeof (inspector as any).close === 'function') {
      (inspector as any).close();
      console.log('[Lockdown] Inspector closed');
    }

    // Verify inspector methods are disabled
    const inspectorUrl = (inspector as any).url?.();
    if (typeof inspectorUrl === 'string' && inspectorUrl.length > 0) {
      console.warn('[Lockdown] WARNING: Inspector appears to have an active URL after close()');
      console.warn('[Lockdown] Security check will catch this within 5 seconds and kill the process');
    } else {
      console.log('[Lockdown] Inspector URL is empty (as expected)');
    }
  } catch (err) {
    console.error('[Lockdown] Runtime inspector security check failed:', err);
    // Don't fatal here - security check will catch debugger if it somehow attaches
  }

  console.log('[Lockdown] Process lockdown complete');
  console.log('[Lockdown] SIGUSR1 signal behavior: Will be detected by security check within 5 seconds');
  console.log('[Lockdown] Details: SIGUSR1 cannot be prevented at signal-handler level due to Node.js');
  console.log('[Lockdown] C++ inspector module registering handler at C++ level. Security check is');
  console.log('[Lockdown] the primary defense and will terminate process if debugger attaches.');
}