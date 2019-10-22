import { expect } from 'chai';
import { Deriver } from '../src';

describe('Address Derivation', () => {
  it('should be able to generate a valid ETH address', () => {
    const xPub = 'xpub6D8rChqkgFuaZULuq2n6VrS4zB5Cmv24gcRc889dFRRgYAH1CGQmQZ9kcPfMAfWGPnyMd1X5foBYFmJ5ZPfvwhm6tXjaY13ao1rQHRtkKDv';
      'select scout crash enforce riot rival spring whale hollow radar rule sentence';

    const path = Deriver.pathFor('ETH', 'mainnet');
    expect(path).to.equal(`m/44'/60'/0'`);

    const address = Deriver.deriveAddress('ETH', 'mainnet', xPub, 0, false);
    const expectedAddress = '0x9dbfE221A6EEa27a0e2f52961B339e95426931F9';
    expect(address).to.equal(expectedAddress);
  });

  it('should be able to generate a valid ETH address, privKey, pubKey', () => {
    const privKey = 'xprv9ypBjKErGMqCdzd44hfSdy1Vk6PGtU3si8ogZcow7rA23HTxMi9XfT99EKmiNdLMr9BAZ9S8ZKCYfN1eCmzYSmXYHje1jnYQseV1VJDDfdS';

    const path = Deriver.pathFor('ETH', 'mainnet');
    expect(path).to.equal(`m/44'/60'/0'`);

    const result = Deriver.derivePrivateKey('ETH', 'mainnet', privKey, 0, false);
    const expectedResult = { 
      address: '0xb497281830dE4F19a3482AbF3D5C35c514e6fB36',
      privKey: '62b8311c71f355c5c07f6bffe9b1ae60aa20d90e2e2ec93ec11b6014b2ae6340',
      pubKey: '0386d153aad9395924631dbc78fa560107123a759eaa3e105958248c60cd4472ad' 
    };
    expect(result.address).to.equal(expectedResult.address);
    expect(result.privKey).to.equal(expectedResult.privKey);
    expect(result.pubKey).to.equal(expectedResult.pubKey);
  });
});
