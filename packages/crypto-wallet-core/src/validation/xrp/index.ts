import baseX from 'base-x';
import Bitcore from 'bitcore-lib';
import type { IValidation } from '../../types/validation';

const RIPPLE_ALPHABET = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';

export class XrpValidation implements IValidation {
  validateAddress(_network: string, address: string): boolean {
    // First ensure it matches regex
    const RippleAddressRegex = new RegExp(/^r[rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz]{27,35}$/);
    if (!address.match(RippleAddressRegex)) {
      return false;
    }

    // Then ensure it is a valid base58check encoding
    const base58 = baseX(RIPPLE_ALPHABET);
    const buffer = Buffer.from(base58.decode(address));
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
  }

  validateUri(addressUri: string): boolean {
    if (!addressUri) {
      return false;
    }
    const address = this.extractAddress(addressUri);
    const ripplePrefix = /ripple/i.exec(addressUri);
    return !!ripplePrefix && this.validateAddress('livenet', address);
  }

  private extractAddress(data) {
    const prefix = /^[a-z]+:/i;
    const params = /([\?\&](amount|dt)=(\d+([\,\.]\d+)?))+/i;
    return data.replace(prefix, '').replace(params, '');
  }
}
