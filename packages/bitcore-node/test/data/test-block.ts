import { TEST_TX, TEST_CORE_TX } from './test-tx';
import { Bitcoin } from '../../src/types/namespaces/Bitcoin';
import { CoreBlock } from '../../src/types/namespaces/ChainAdapter';
import { IBlock } from '../../src/models/block';

export const TEST_BLOCK: Bitcoin.Block = {
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

export const TEST_CORE_BLOCK: CoreBlock = {
  chain: 'BTC',
  network: 'regtest',
  parent: undefined,
  header: {
    hash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
    version: '536870912',
    merkleRoot: '08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08',
    time: 1526756523,
    nonce: '2',
    bits: '545259519',
    prevHash: '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
  },
  size: 264,
  reward: 0.09765625,
  transactions: [ TEST_CORE_TX ]
};

export const TEST_MONGO_BLOCK: IBlock = {
  chain: "BTC",
  network: "regtest",
  hash: "64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929",
  reward: 0.09765625,
  size: 264,
  transactionCount: 1,
  nonce: 2,
  bits: '545259519',
  time: new Date(1526756523),
  timeNormalized: new Date(1526756523),
  merkleRoot: "08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08",
  previousBlockHash: "3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9",
  version: 536870912,
  height: 1355,
  processed: true,
  nextBlockHash: "13a6180d89b771e10a2d0f41e2c454712a3773cc463b9c317ee582a1bde51151"
};
