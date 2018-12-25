import { pubToAddress } from 'ethereumjs-util';
const { Address } = require('bitcore-lib');
var ec = require('elliptic').ec('secp256k1');

export const AddressConverters = {
  ETH: pubKey => pubToAddress(ec.keyFromPublic(pubKey.toBuffer()).getPublic()),
  BTC: pubKey => Address.fromPublicKey(pubKey)
};
export class AddressProvider {
  static get(currency: keyof typeof AddressConverters) {
    return AddressConverters[currency];
  }

  static fromPublicKey({ currency, pubKey }:{currency: keyof typeof AddressConverters, pubKey: any}) {
    this.get(currency)(pubKey);
  }
}
