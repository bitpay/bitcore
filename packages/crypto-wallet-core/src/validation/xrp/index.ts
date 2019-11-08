import baseX from 'base-x';
import Bitcore from 'bitcore-lib';
import { IValidation } from '..';

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
    const buffer = new Buffer(base58.decode(address));
    let prefix = buffer.slice(0, 1);
    let data = buffer.slice(1, -4);
    let hash = Buffer.concat([prefix, data]);
    hash = Bitcore.crypto.Hash.sha256(hash);
    hash = Bitcore.crypto.Hash.sha256(hash);
    let checksum = buffer.slice(-4).reduce((acc, check, index) => {
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
    // Check if the input is a valid uri or address
    const URI = Bitcore.URI;
    // Bip21 uri
    return URI.isValid(addressUri);
  }
}
