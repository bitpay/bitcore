import { EthValidation } from '../eth';

export class ArcValidation extends EthValidation {
  constructor() {
    super();
    this.regex = /arc/i;
  }
}
