import { EthValidation } from '../eth';

export class ArbValidation extends EthValidation {
  constructor() {
    super();
    this.regex = /arbitrum/i;
  }
}
