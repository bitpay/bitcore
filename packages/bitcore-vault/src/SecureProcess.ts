import * as crypto from 'crypto';
import { StorageType } from '../../bitcore-client/src/types/storage';
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

  constructor() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    this.publicKey = publicKey;
    this.privateKey = privateKey;
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

    try {
      let result: any;
      switch (action) {
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

  public getPublicKey(): string {
    return this.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  }

  public async loadWallet({ name, storageType = 'Level' }: { name: string; storageType?: StorageType }): Promise<string> {
    const wallet = await VaultWallet.loadWallet({ name, storageType });
    const walletName = name;
    if (!walletName) {
      throw new Error('Wallet name must be provided.');
    }
    if (this.wallets.has(walletName)) {
      throw new Error(`Wallet with name ${walletName} already loaded.`);
    }

    this.wallets.set(walletName, { wallet });
    const address = wallet.deriveAddress(0, false); // REVIEWER - is this right?
    // @TODO - do we want to sync wallet tokens here too? See sweep script

    return address;
  }

  public async addPassphrase(payload: { name: string; encryptedPassphrase: string }): Promise<{ success: boolean }> {
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
      passphrase = crypto.privateDecrypt(
        {
          key: this.privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        encryptedPassphraseBuffer
      );

      // This method is responsible for its own cleanup of the passphrase buffer.
      // We wrap this in a try/finally as a defense-in-depth measure.
      const { success: returnedSuccess } = await walletEntry.wallet.checkPassphrase(passphrase);
      success = returnedSuccess;
    } finally {
      // Overwrite the buffer to ensure the secret is not left in memory.
      crypto.randomFillSync(passphrase);
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
