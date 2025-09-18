import * as crypto from 'crypto';
import { Wallet } from '../../bitcore-client/src/wallet';

export class VaultWallet extends Wallet {
  constructor(params) {
    super(params);
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
  public async checkPassphrase(passphrase: Buffer): Promise<void> {
    try {
      // Note: bcrypt documentation suggests passphrase will be stringified - this is not ideal - but the bcrypt compare method can take a buffer - hope for bcrypt's cleanup as best as possible
      await super.unlock(passphrase);
    } finally {
      crypto.randomFillSync(passphrase); // Overwrite passphrase memory
      this.lock();
    }
  }
}
