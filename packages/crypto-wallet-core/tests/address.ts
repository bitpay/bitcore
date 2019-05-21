import { expect } from 'chai';
import { Deriver } from '../src';
var Mnemonic = require('../../bitcore-mnemonic');

describe('Address Derivation', () => {
  it('should be able to generate a valid ETH address', () => {
    const words =
      'select scout crash enforce riot rival spring whale hollow radar rule sentence';

    const mnemonic = new Mnemonic(words);
    const xPriv = mnemonic.toHDPrivateKey();
    const path = Deriver.pathFor('ETH', 'mainnet');
    expect(path).to.equal(`m/44'/60'/0'`);

    const xPub = xPriv.derive(path).xpubkey;
    const address = Deriver.deriveAddress('ETH', 'mainnet', xPub, 0, false);
    const expectedAddress = '0x9dbfE221A6EEa27a0e2f52961B339e95426931F9';
    expect(address).to.equal(expectedAddress);
  });
});
