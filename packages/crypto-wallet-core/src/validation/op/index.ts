import { EthValidation } from '../eth';

export class OpValidation extends EthValidation {
  constructor() {
    super();
    this.regex = /optimism/i;
  }
}
