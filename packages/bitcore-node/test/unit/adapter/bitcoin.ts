import { AdapterProvider } from '../../../src/providers/adapter';
import { expect } from 'chai';

describe('Adapters', () => {
  const TEST_TX = {
    hash: '08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08',
    _hash: '08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08',
    isCoinbase: () => true,
    outputAmount: 0.09765625,
    inputs: [],
    outputs: [],
    nLockTime: 0,
    toBuffer: () => Buffer.from('')
  };

  const TEST_BLOCK = {
    hash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
    transactions: [TEST_TX],
    toBuffer: () => {
      return { length: 264 } as Buffer;
    },
    header: {
      toObject: () => {
        return {
          hash:
          '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
          confirmations: 1,
          strippedsize: 228,
          size: 264,
          weight: 948,
          height: 1355,
          version: '536870912',
          versionHex: '20000000',
          merkleRoot:
          '08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08',
          tx: [
            '08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08'
          ],
          time: 1526756523,
          mediantime: 1526066375,
          nonce: '2',
          bits: parseInt('207fffff', 16).toString(),
          difficulty: 4.656542373906925e-10,
          chainwork:
          '0000000000000000000000000000000000000000000000000000000000000a98',
          prevHash:
          '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
        };
      }
    }
  };

  it('should convert a bitcoin block to an internal block', () => {
    const convertedBlock = AdapterProvider.get({ chain: 'BTC' }).convertBlock({
      chain: 'BTC',
      network: 'regtest',
    }, TEST_BLOCK);
    expect(convertedBlock.header.hash).equals(TEST_BLOCK.hash);
    expect(convertedBlock.header.bits).equals("545259519");
    expect(convertedBlock.chain).equals('BTC');
    expect(convertedBlock.size).equals(264);
    expect(convertedBlock.header.merkleRoot).equals(
      '08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08'
    );
  });

  it('should convert a bitcoin transaction to an internal transaction', () => {
    const convertTx = AdapterProvider.get({chain: 'BTC'}).convertTx({
      chain: 'BTC',
      network: 'regtest',
    }, TEST_TX, TEST_BLOCK);
    expect(convertTx.chain).equals('BTC');
    expect(convertTx.hash).equals(TEST_TX.hash);
  });
});
