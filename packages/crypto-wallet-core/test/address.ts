import { expect } from 'chai';
import { Deriver } from '../src';

describe('Address Derivation', () => {
  it('should be able to generate a valid ETH address', () => {
    const xPub = 'xpub6D8rChqkgFuaZULuq2n6VrS4zB5Cmv24gcRc889dFRRgYAH1CGQmQZ9kcPfMAfWGPnyMd1X5foBYFmJ5ZPfvwhm6tXjaY13ao1rQHRtkKDv';
    // 'select scout crash enforce riot rival spring whale hollow radar rule sentence';

    const path = Deriver.pathFor('ETH', 'mainnet');
    expect(path).to.equal("m/44'/60'/0'");

    const address = Deriver.deriveAddress('ETH', 'mainnet', xPub, 0, false);
    const expectedAddress = '0x9dbfE221A6EEa27a0e2f52961B339e95426931F9';
    expect(address).to.equal(expectedAddress);
  });

  it('should be able to generate a valid XRP address', () => {
    const xPub = 'xpub6J8BBe8QHMMiVQK1F8hLpRKnmkwNTa7tkg753KWjkafzcxfWVFBMkpbPjfY9Fz4bgSvn6jiUYg1ivpeF5HjE6jvrdHm6Se7HKgEAjPFGFfr';
    // 'select scout crash enforce riot rival spring whale hollow radar rule sentence';

    const path = Deriver.pathFor('XRP', 'mainnet');
    expect(path).to.equal("m/44'/144'/0'");

    const address = Deriver.deriveAddress('XRP', 'mainnet', xPub, 0, false);
    const expectedAddress = 'r9dmAJBfBe7JL2RRLiFWGJ8kM4CHEeTpgN';
    expect(address).to.equal(expectedAddress);
  });

  it('should be able to generate a valid ETH address, privKey, pubKey', () => {
    const privKey = 'xprv9ypBjKErGMqCdzd44hfSdy1Vk6PGtU3si8ogZcow7rA23HTxMi9XfT99EKmiNdLMr9BAZ9S8ZKCYfN1eCmzYSmXYHje1jnYQseV1VJDDfdS';

    const path = Deriver.pathFor('ETH', 'mainnet');
    expect(path).to.equal("m/44'/60'/0'");

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

  it('should be able to generate a valid XRP address, privKey, pubKey', () => {
    const privKey = 'xprvA58pn8bWSyoRGvEY97ALTHP4Dj6t47Q3PTBUEw78CF91kALMwhs7D2GutQSvpRN6ACR4RX4HbF3KmF7zDf48gR8nwG7DqLp6ezUcMiPHDtV';

    const path = Deriver.pathFor('XRP', 'mainnet');
    expect(path).to.equal("m/44'/144'/0'");

    const result = Deriver.derivePrivateKey('XRP', 'mainnet', privKey, 0, false);
    const expectedResult = {
      address: 'r9dmAJBfBe7JL2RRLiFWGJ8kM4CHEeTpgN',
      privKey: 'd02c6801d8f328ff2ead51d01f9580af36c8d74e2bd463963ac4adbe51ae5f2c',
      pubKey: '03dbeec5e9e76da09c5b502a67136bc2d73423e8902a7c35a8cbc0c5a6ac0469e8'
    };
    expect(result.address).to.equal(expectedResult.address);
    expect(result.privKey).to.equal(expectedResult.privKey.toUpperCase());
    expect(result.pubKey).to.equal(expectedResult.pubKey.toUpperCase());
  });
});
