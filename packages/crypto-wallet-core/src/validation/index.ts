import { BchValidation } from './bch';
import { BtcValidation } from './btc';
import { EthValidation } from './eth';
import { LtcValidation } from './ltc';
import { XrpValidation } from './xrp';

export interface IValidation {
  validateAddress(network: string, address: string): boolean;
  validateUri(addressUri: string): boolean;
}

const validation: { [chain: string]: IValidation } = {
  BTC: new BtcValidation(),
  BCH: new BchValidation(),
  ETH: new EthValidation(),
  XRP: new XrpValidation(),
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
