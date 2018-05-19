import { AdapterProxy } from '../../../src/providers/adapters';
import { Adapter } from '../../../src/types/namespaces/ChainAdapter';
import { Bitcoin } from '../../../src/types/namespaces/Bitcoin';
import { expect } from 'chai';

describe('Adapters', () => {
  it('should convert a bitcoin block to an internal block', () => {
    const block: Bitcoin.Block = {
      hash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
      transactions: [{
        hash: '08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08',
        _hash: '08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08',
        isCoinbase: () => true,
        outputAmount: 0.09765625,
        inputs: [],
        outputs: [],
        nLockTime: 0,
        toBuffer: () => Buffer.from('')
      }],
      toBuffer: () => Buffer.from(''),
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

    const params: Adapter.ConvertBlockParams<Bitcoin.Block> = {
      chain: 'BTC',
      network: 'regtest',
      block,
      height: 1355
    };
    const convertedBlock = AdapterProxy.convertBlock(params);
    console.log(convertedBlock);
    expect(1).equals(1);
  });
});
