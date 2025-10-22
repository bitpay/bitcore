import { ArbValidation } from './arb';
import { BaseValidation } from './base';
import { BchValidation } from './bch';
import { BtcValidation } from './btc';
import { DogeValidation } from './doge';
import { EthValidation } from './eth';
import { LtcValidation } from './ltc';
import { MaticValidation } from './matic';
import { OpValidation } from './op';
import { SolValidation } from './sol';
import { XrpValidation } from './xrp';
import type { IValidation } from '../types/validation';

const validation: { [chain: string]: IValidation } = {
  BTC: new BtcValidation(),
  BCH: new BchValidation(),
  ETH: new EthValidation(),
  XRP: new XrpValidation(),
  DOGE: new DogeValidation(),
  LTC: new LtcValidation(),
  MATIC: new MaticValidation(),
  ARB: new ArbValidation(),
  BASE: new BaseValidation(),
  OP: new OpValidation(),
  SOL: new SolValidation(),
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
