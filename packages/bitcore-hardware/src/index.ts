import { Base } from './base.js';
import Burner from './burner.js';
import { GetPublicKey, Sign } from './types/methods.js';

export default class BitcoreHardware implements Base {
  hardwareWallet: Base | undefined;
  constructor(wallet: string, currency: string) {
    switch (wallet.toLowerCase()) {
      case ('burner'): {
        if (!(['btc', 'eth'].includes(currency.toLowerCase()))) {
          throw new Error(`Burner can only be run with btc or eth, not ${currency}`);
        };
        this.hardwareWallet = new Burner(currency);
        break;
      }
    }
  }

  connect() {
    this.hardwareWallet?.connect();
  }

  async sign(params: Sign): Promise<any> {
    return this.hardwareWallet?.sign(params) || {};
  }

  async getPublicKey(params: GetPublicKey): Promise<any> {
    return this.hardwareWallet?.getPublicKey(params);
  }
}
