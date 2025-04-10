import { EthValidation } from '../eth';

export class BaseValidation extends EthValidation {
  constructor() {
    super();
    this.regex = /base/i;
  }
}
