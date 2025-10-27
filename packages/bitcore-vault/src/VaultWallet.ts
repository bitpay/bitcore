import * as crypto from 'crypto';
import { Storage } from '../../bitcore-client/src/storage';
import { StorageType } from '../../bitcore-client/src/types/storage';
import { Wallet } from '../../bitcore-client/src/wallet';

export class VaultWallet extends Wallet {
  constructor(params) {
    super(params);
  }

  /**
   * Override the static loadWallet method to return a VaultWallet instance
   */
  static async loadWallet(params: { name: string; path?: string; storage?: Storage; storageType?: StorageType }) {
    const { name, path, storageType } = params;
    let { storage } = params;
    storage = storage || new Storage({ errorIfExists: false, createIfMissing: false, path, storageType });
    const loadedWallet = await storage.loadWallet({ name });
    if (loadedWallet) {
      return new VaultWallet(Object.assign(loadedWallet, { storage }));
    } else {
      throw new Error('No wallet could be found');
    }
  }

  /**
   * Higher Order Function that wraps any parent method with unlock/lock pattern
   * @param passphrase The passphrase to unlock the wallet
   * @param method The parent method to execute
   * @param args The arguments to pass to the method
   * @returns Promise with the method's return value
   */
  private async withVaultAccess<T>(passphrase: Buffer, method: (...args: any[]) => T, ...args: any[]): Promise<T> {
    try {
      // Note: bcrypt documentation suggests passphrase will be stringified - this is not ideal - but the bcrypt compare method can take a buffer - hope for bcrypt's cleanup as best as possible
      await super.unlock(passphrase);
      const result = await method.call(this, ...args);
      return result;
    } finally {
      crypto.randomFillSync(passphrase); // Overwrite passphrase memory
      this.lock();
    }
  }

  /**
   * Checks if the provided passphrase can unlock the wallet.
   * @param passphrase The passphrase to check.
   * @returns A promise that resolves if the passphrase is correct, and rejects otherwise.
   */
  public async checkPassphrase(passphrase: Buffer): Promise<{ success: boolean }> {
    try {
      // Note: bcrypt documentation suggests passphrase will be stringified - this is not ideal - but the bcrypt compare method can take a buffer - hope for bcrypt's cleanup as best as possible
      await super.unlock(passphrase);
      return { success: true };
    } catch {
      return { success: false };
    } finally {
      crypto.randomFillSync(passphrase); // Overwrite passphrase memory
      this.lock();
    }
  }

  /**
   * Override signTx to require vault access
   */
  public async signTx(params: any): Promise<any> {
    return this.withVaultAccess(params.passphrase, super.signTx.bind(this), params);
  }

  /**
   * Override derivePrivateKey to require vault access
   */
  public async derivePrivateKey(_isChange: boolean, _addressIndex?: number): Promise<any> {
    // This method needs a passphrase, but it's not passed as a parameter
    // We'll need to handle this differently - perhaps store the passphrase temporarily
    throw new Error('derivePrivateKey requires vault access - use withVaultAccess wrapper');
  }

  /**
   * Override generateAddressPair to require vault access
   */
  public async generateAddressPair(_addressIndex: number, _withChangeAddress?: boolean): Promise<any> {
    // This method needs a passphrase, but it's not passed as a parameter
    // We'll need to handle this differently - perhaps store the passphrase temporarily
    throw new Error('generateAddressPair requires vault access - use withVaultAccess wrapper');
  }

  /**
   * Override nextAddressPair to require vault access
   */
  public async nextAddressPair(_withChangeAddress?: boolean): Promise<any> {
    // This method needs a passphrase, but it's not passed as a parameter
    // We'll need to handle this differently - perhaps store the passphrase temporarily
    throw new Error('nextAddressPair requires vault access - use withVaultAccess wrapper');
  }

  /**
   * Override importKeys to require vault access
   */
  public async importKeys(_params: { keys: any[], rederiveAddys?: boolean }): Promise<any> {
    // This method needs a passphrase, but it's not passed as a parameter
    // We'll need to handle this differently - perhaps store the passphrase temporarily
    throw new Error('importKeys requires vault access - use withVaultAccess wrapper');
  }
}
