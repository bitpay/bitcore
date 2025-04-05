import { EthValidation } from '../eth';

export class BaseValidation extends EthValidation {
  regex: RegExp;

  constructor() {
    super();
    this.regex = /base/i;
  }
}
