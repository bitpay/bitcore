import { EthValidation } from '../eth';

export class ArbValidation extends EthValidation {
  regex: RegExp;

  constructor() {
    super();
    this.regex = /arbitrum/i;
  }
}
