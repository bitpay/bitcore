import { expect } from 'chai';
import crypto from 'crypto';
import { Deriver } from '../src';

describe('IDeriver', function () {
  describe('getPublicKey (Buffer-first)', () => {
    it('BTC: should derive the compressed secp256k1 public key', () => {
      // Well-known secp256k1 test vector: private key 1 maps to generator point G.
      const privHex = '0000000000000000000000000000000000000000000000000000000000000001';
      const expectedPubKey = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
      const privBuf = Deriver.privateKeyToBuffer('BTC', privHex);
      try {
        const pubKey = Deriver.getPublicKey('BTC', 'testnet', privBuf);

        expect(pubKey).to.equal(expectedPubKey);
        expect(pubKey).to.match(/^(02|03)/);
        expect(pubKey).to.have.length(66);
      } finally {
        privBuf.fill(0);
      }
    });
  
    it('ETH: should derive the compressed pubKey used by wallet imports', () => {
      // Vetted fixture from `test/address.test.ts`.
      const privHex = '62b8311c71f355c5c07f6bffe9b1ae60aa20d90e2e2ec93ec11b6014b2ae6340';
      const expectedPubKey = '0386d153aad9395924631dbc78fa560107123a759eaa3e105958248c60cd4472ad';
      const expectedAddress = '0xb497281830dE4F19a3482AbF3D5C35c514e6fB36';
      const privBuf = Deriver.privateKeyToBuffer('ETH', privHex);
      try {
        const pubKey = Deriver.getPublicKey('ETH', 'mainnet', privBuf);

        expect(pubKey).to.equal(expectedPubKey);
        expect(pubKey).to.match(/^(02|03)/);
        expect(pubKey).to.have.length(66);
        expect(Deriver.getAddress('ETH', 'mainnet', pubKey)).to.equal(expectedAddress);
      } finally {
        privBuf.fill(0);
      }
    });
  
    it('XRP: should derive the compressed pubKey used by wallet imports', () => {
      // Vetted fixture from `test/address.test.ts`.
      const privHex = 'D02C6801D8F328FF2EAD51D01F9580AF36C8D74E2BD463963AC4ADBE51AE5F2C';
      const expectedPubKey = '03DBEEC5E9E76DA09C5B502A67136BC2D73423E8902A7C35A8CBC0C5A6AC0469E8';
      const expectedAddress = 'r9dmAJBfBe7JL2RRLiFWGJ8kM4CHEeTpgN';
      const privBuf = Deriver.privateKeyToBuffer('XRP', privHex);
      try {
        const pubKey = Deriver.getPublicKey('XRP', 'mainnet', privBuf);

        expect(pubKey).to.equal(expectedPubKey);
        expect(pubKey).to.match(/^(02|03)/);
        expect(pubKey).to.have.length(66);
        expect(Deriver.getAddress('XRP', 'mainnet', pubKey)).to.equal(expectedAddress);
      } finally {
        privBuf.fill(0);
      }
    });
  
    it('SOL: should derive the public key used by wallet imports', () => {
      // Vetted fixture from `test/address.test.ts`.
      const privKey = 'E4Tp4nTgMCa5dtGwqvkWoMGrJC7FKRNjcpeFFXi4nNb9';
      const expectedPubKey = '5c9c85b20525ee81d3cc56da1f8307ec169086ae41458c5458519aced7683b66';
      const expectedAddress = '7EWwMxKQa5Gru7oTcS1Wi3AaEgTfA6MU3z7MaLUT6hnD';
      const privBuf = Deriver.privateKeyToBuffer('SOL', privKey);
      try {
        const pubKey = Deriver.getPublicKey('SOL', 'mainnet', privBuf);

        expect(pubKey).to.equal(expectedPubKey);
        expect(pubKey).to.have.length(64);
        expect(Deriver.getAddress('SOL', 'mainnet', pubKey)).to.equal(expectedAddress);
      } finally {
        privBuf.fill(0);
      }
    });
  });

  describe('privateKeyToBuffer', function () {
    it('ETH: should accept with/without 0x', () => {
      const privHex = crypto.randomBytes(32).toString('hex');
      const privBufNo0x = Deriver.privateKeyToBuffer('ETH', privHex);
      const privBuf0x = Deriver.privateKeyToBuffer('ETH', `0x${privHex}`);
      try {
        expect(privBuf0x.equals(privBufNo0x)).to.be.true;
      } finally {
        privBufNo0x.fill(0);
        privBuf0x.fill(0);
      }
    });
    it('ETH: hex-stringified buffer output equals input', () => {
      const privHex = crypto.randomBytes(32).toString('hex');
      const privBuf = Deriver.privateKeyToBuffer('ETH', privHex);
      try {
        expect(privBuf.toString('hex')).to.equal(privHex);
      } finally {
        privBuf.fill(0);
      }
    });

    it('XRP: should accept uppercase/lowercase hex', () => {
      // Vetted fixture from `test/address.test.ts`.
      const privHexUpper = 'D02C6801D8F328FF2EAD51D01F9580AF36C8D74E2BD463963AC4ADBE51AE5F2C';
      const privHexLower = privHexUpper.toLowerCase();
      const privBufUpper = Deriver.privateKeyToBuffer('XRP', privHexUpper);
      const privBufLower = Deriver.privateKeyToBuffer('XRP', privHexLower);
      try {
        expect(privBufUpper.equals(privBufLower)).to.be.true;
      } finally {
        privBufUpper.fill(0);
        privBufLower.fill(0);
      }
    });

    it('XRP: hex-stringified buffer output equals fixture bytes', () => {
      // Vetted fixture from `test/address.test.ts`.
      const privHexUpper = 'D02C6801D8F328FF2EAD51D01F9580AF36C8D74E2BD463963AC4ADBE51AE5F2C';
      const privBuf = Deriver.privateKeyToBuffer('XRP', privHexUpper);
      try {
        expect(privBuf.toString('hex')).to.equal(privHexUpper.toLowerCase());
      } finally {
        privBuf.fill(0);
      }
    });
  });
});


