import { EthValidation } from '../eth';

export class MaticValidation extends EthValidation {
  regex: RegExp;

  constructor() {
    super();
    this.regex = /matic|polygon/i;
  }
}
