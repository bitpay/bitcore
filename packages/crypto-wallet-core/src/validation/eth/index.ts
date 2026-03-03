import { utils } from 'web3';
import type { IValidation } from '../../types/validation';

export class EthValidation implements IValidation {
  regex: RegExp;

  constructor() {
    this.regex = /ethereum/i;
  }

  validateAddress(_network: string, address: string): boolean {
    return utils.isAddress(address);
  }

  validateUri(addressUri: string): boolean {
    if (!addressUri) {
      return false;
    }
    const address = this.extractAddress(addressUri);
    const prefix = this.regex.exec(addressUri);
    if (!prefix) {
      return false;
    }
    if (!utils.isAddress(address)) {
      return false;
    }
    // Validate that numeric parameters contain only valid numbers
    if (!this.validateUriParams(addressUri)) {
      return false;
    }
    return true;
  }

  /**
   * Validates that URI parameters contain properly formatted numeric values.
   * Returns false if any recognized numeric parameter has an invalid (non-numeric) value.
   *
   * @param {string} uri - The full URI string
   * @returns {boolean} True if all numeric params are valid, or no params exist
   */
  protected validateUriParams(uri: string): boolean {
    const queryIndex = uri.indexOf('?');
    if (queryIndex === -1) {
      return true;
    }
    const queryString = uri.substring(queryIndex + 1);
    const params = queryString.split('&');
    const numericParams = ['value', 'gas', 'gasPrice', 'gasLimit', 'amount'];

    for (const param of params) {
      const [key, value] = param.split('=');
      if (numericParams.includes(key)) {
        if (!value || isNaN(Number(value.replace(',', '.')))) {
          return false;
        }
      }
    }
    return true;
  }

  protected extractAddress(data: string): string {
    const prefix = /^[a-z]+:/i;
    const params = /([?&](value|gas|gasPrice|gasLimit)=(\d+([,.]\d+)?))+/i;
    return data.replace(prefix, '').replace(params, '');
  }
}
