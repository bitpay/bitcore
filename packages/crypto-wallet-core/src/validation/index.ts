import { BchValidation } from './bch';
import { BtcValidation } from './btc';
import { DogeValidation } from './doge';
import { LtcValidation } from './ltc';
import { XecValidation } from './xec';
import { XpiValidation } from './xpi';

export interface IValidation {
  validateAddress(network: string, address: string): boolean;
  validateUri(addressUri: string): boolean;
}

const validation: { [chain: string]: IValidation } = {
  BTC: new BtcValidation(),
  BCH: new BchValidation(),
  DOGE: new DogeValidation(),
  XEC: new XecValidation(),
  XPI: new XpiValidation(),
  LTC: new LtcValidation()
};

export class ValidationProxy {
  get(chain) {
    const normalizedChain = chain.toUpperCase();
    return validation[normalizedChain];
  }

  validateAddress(chain, network, address) {
    return this.get(chain).validateAddress(network, address);
  }

  validateUri(chain, addressUri) {
    return this.get(chain).validateUri(addressUri);
  }
}

export default new ValidationProxy();
