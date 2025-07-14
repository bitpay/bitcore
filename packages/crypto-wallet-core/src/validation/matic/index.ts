import { EthValidation } from '../eth';

export class MaticValidation extends EthValidation {
  constructor() {
    super();
    this.regex = /matic|polygon/i;
  }
}
