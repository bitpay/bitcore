import { AdapterProvider } from '../../../src/providers/adapter';
import { Adapter } from '../../../src/types/namespaces/ChainAdapter';
import { Bitcoin } from '../../../src/types/namespaces/Bitcoin';
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
    const block: Bitcoin.Block = TEST_BLOCK;

    const params: Adapter.ConvertBlockParams<Bitcoin.Block> = {
      chain: 'BTC',
      network: 'regtest',
      block,
      height: 1355
    };
    const convertedBlock = AdapterProvider.convertBlock(params);
    expect(convertedBlock.hash).equals(block.hash);
    expect(convertedBlock.bits).equals(545259519);
    expect(convertedBlock.chain).equals('BTC');
    expect(convertedBlock.height).equals(1355);
    expect(convertedBlock.size).equals(264);
    expect(convertedBlock.merkleRoot).equals(
      '08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08'
    );
  });

  it('should convert a bitcoin transaction to an internal transaction', () => {

    const params: Adapter.ConvertTxParams<
      Bitcoin.Transaction,
      Bitcoin.Block
      > = {
        chain: 'BTC',
        network: 'regtest',
        tx: TEST_TX,
        block: TEST_BLOCK,
        height: 1355
      };
    const convertTx = AdapterProvider.convertTx(params);
    expect(convertTx.blockHash).equals(TEST_BLOCK.hash);
    expect(convertTx.blockHeight).equals(1355);
    expect(convertTx.chain).equals('BTC');
    expect(convertTx.txid).equals(TEST_TX.hash);
  });
});
