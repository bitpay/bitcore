import { TEST_TX } from './test-tx';
import { Bitcoin } from '../../src/types/namespaces/Bitcoin';
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
export const TEST_BLOCK1: Bitcoin.Block = {
  hash: '1e980bdd683513b2cdeaf81985f1f52e17175d3ce34e3be56e0c210eed0a21a3',
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
