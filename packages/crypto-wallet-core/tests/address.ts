var Mnemonic = require('../../bitcore-mnemonic');
import { CryptoKeys } from '../src';

describe('Address Derivation', () => {
  test('should be able to generate a valid ETH address', () => {
    const words =
      'select scout crash enforce riot rival spring whale hollow radar rule sentence';

    const mnemonic = new Mnemonic(words);
    const xPriv = mnemonic.toHDPrivateKey();
    const path = CryptoKeys.pathFor('ETH', 'mainnet');
    expect(path).toEqual(`m/44'/60'/0'`);

    const pubKey = xPriv.derive(path).xpubkey;

    const address = CryptoKeys.deriveAddress(
      'ETH',
      'mainnet',
      pubKey,
      0,
      false
    );

    const expectedAddress = '0x9dbfE221A6EEa27a0e2f52961B339e95426931F9';
    expect(address).toEqual(expectedAddress);
  });
});
