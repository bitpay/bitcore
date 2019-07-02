import { BtcValidation } from './btc';
import { BchValidation } from './bch';
import { EthValidation } from './eth';

 export interface IValidation {
  validateAddress(
    network: string,
    address: string,
  ): boolean;
}

 const validation: { [chain: string]: IValidation } = {
  BTC: new BtcValidation(),
  BCH: new BchValidation(),
  ETH: new EthValidation()
};

 export class ValidationProxy {
  get(chain) {
    const normalizedChain = chain.toUpperCase();
    return validation[normalizedChain];
  }

   validateAddress(chain, network, address) {
    return this.get(chain).validateAddress(
      network,
      address
    );
  }
}

 export default new ValidationProxy();
