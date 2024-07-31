import { EthValidation } from '../eth';

export class OpValidation extends EthValidation {
  regex: RegExp;

  constructor() {
    super();
    this.regex = /optimism/i;
  }
}
