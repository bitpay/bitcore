import Bitcore from '@bitpay-labs/bitcore-lib';
import baseX from 'base-x';
import type { IValidation } from '../../types/validation';

const RIPPLE_ALPHABET = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';
const RippleAddressRegex = /^r[rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz]{27,35}$/;

export class XrpValidation implements IValidation {
  validateAddress(_network: string, address: string): boolean {
    if (!address || typeof address !== 'string') {
      return false;
    }

    // First ensure it matches regex
    if (!address.match(RippleAddressRegex)) {
      return false;
    }

    // Then ensure it is a valid base58check encoding
    try {
      const base58 = baseX(RIPPLE_ALPHABET);
      const buffer = Buffer.from(base58.decode(address));

      if (buffer.length < 5) {
        return false;
      }

      const prefix = buffer.subarray(0, 1);
      const data = buffer.subarray(1, -4);
      let hash = Buffer.concat([prefix, data]);
      hash = Bitcore.crypto.Hash.sha256(hash);
      hash = Bitcore.crypto.Hash.sha256(hash);
      const checksum = buffer.subarray(-4).reduce((acc, check, index) => {
        if (check !== hash[index]) {
          // Invalid checksum
          return 0;
        } else return acc || 1;
      });
      if (checksum === 0) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  validateUri(addressUri: string): boolean {
    if (!addressUri) {
      return false;
    }
    const address = this.extractAddress(addressUri);
    const ripplePrefix = /ripple/i.exec(addressUri);
    if (!ripplePrefix) {
      return false;
    }
    if (!this.validateAddress('livenet', address)) {
      return false;
    }
    // Validate that numeric parameters are well-formed
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
  private validateUriParams(uri: string): boolean {
    const queryIndex = uri.indexOf('?');
    if (queryIndex === -1) {
      return true;
    }
    const queryString = uri.substring(queryIndex + 1);
    const params = queryString.split('&');
    const numericParams = ['amount', 'dt'];

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

  private extractAddress(data: string): string {
    const prefix = /^[a-z]+:/i;
    const params = /([?&](amount|dt)=(\d+([,.]\d+)?))+/i;
    return data.replace(prefix, '').replace(params, '');
  }
}
