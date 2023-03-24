import { BchValidation } from './bch';
import { BtcValidation } from './btc';
import { DogeValidation } from './doge';
import { EthValidation } from './eth';
import { LtcValidation } from './ltc';
import { MaticValidation } from './matic';
import { XrpValidation } from './xrp';

export interface IValidation {
  validateAddress(network: string, address: string): boolean;
  validateUri(addressUri: string): boolean;
  validateRawTx?(params: any): boolean;
}

const validation: { [chain: string]: IValidation } = {
  BTC: new BtcValidation(),
  BCH: new BchValidation(),
  ETH: new EthValidation(),
  XRP: new XrpValidation(),
  DOGE: new DogeValidation(),
  LTC: new LtcValidation(),
  MATIC: new MaticValidation()
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

  validateRawTx(chain, params) {
    const validation = this.get(chain);
    return validation.validateRawTx ? validation.validateRawTx(params) : null;
  }
}

export default new ValidationProxy();
