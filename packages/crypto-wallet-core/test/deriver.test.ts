import { expect } from 'chai';
import crypto from 'crypto';
import { Deriver } from '../src';
import BitcoreLib from 'bitcore-lib';
import { encoding } from 'bitcore-lib';
import * as ed25519 from 'ed25519-hd-key';

describe('Deriver.getPublicKey (Buffer-first)', () => {
  it('BTC: should derive pubKey from privKey buffer', () => {
    const privHex = crypto.randomBytes(32).toString('hex');
    const privBuf = Deriver.privateKeyToBuffer('BTC', privHex);
    try {
      const pubKey = Deriver.getPublicKey('BTC', 'testnet', privBuf);
      const expected = new BitcoreLib.PrivateKey(privHex).publicKey.toString();
      expect(pubKey).to.equal(expected);
    } finally {
      privBuf.fill(0);
    }
  });

  it('ETH: privateKeyToBuffer should accept with/without 0x, and getPublicKey should match', () => {
    const privHex = crypto.randomBytes(32).toString('hex');
    const privBufNo0x = Deriver.privateKeyToBuffer('ETH', privHex);
    const privBuf0x = Deriver.privateKeyToBuffer('ETH', `0x${privHex}`);
    try {
      expect(privBuf0x.equals(privBufNo0x)).to.equal(true);

      const pubKey = Deriver.getPublicKey('ETH', 'mainnet', privBufNo0x);
      const expected = new BitcoreLib.PrivateKey(privHex).publicKey.toString('hex');
      expect(pubKey).to.equal(expected);
    } finally {
      privBufNo0x.fill(0);
      privBuf0x.fill(0);
    }
  });

  it('XRP: should derive uppercase hex pubKey from privKey buffer', () => {
    const privHex = crypto.randomBytes(32).toString('hex').toUpperCase();
    const privBuf = Deriver.privateKeyToBuffer('XRP', privHex);
    try {
      const pubKey = Deriver.getPublicKey('XRP', 'mainnet', privBuf);
      const expected = new BitcoreLib.PrivateKey(privHex.toLowerCase()).publicKey.toString('hex').toUpperCase();
      expect(pubKey).to.equal(expected);
    } finally {
      privBuf.fill(0);
    }
  });

  it('SOL: should derive pubKey hex from privKey buffer', () => {
    const seed = crypto.randomBytes(32);
    const seed58 = encoding.Base58.encode(seed);
    const privBuf = Deriver.privateKeyToBuffer('SOL', seed58);
    try {
      // ensure the base58 path yields the original bytes
      expect(Buffer.compare(privBuf, seed)).to.equal(0);

      const pubKey = Deriver.getPublicKey('SOL', 'mainnet', privBuf);
      const expected = Buffer.from(ed25519.getPublicKey(seed, false)).toString('hex');
      expect(pubKey).to.equal(expected);
    } finally {
      seed.fill(0);
      privBuf.fill(0);
    }
  });
});

