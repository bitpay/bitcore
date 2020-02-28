import { BitcoinBlockType } from '../../src/types/namespaces/Bitcoin';
import { TEST_TX, TEST_TX_1, TEST_TX_2, TEST_TX_3 } from './test-tx';
export const TEST_BLOCK: BitcoinBlockType = {
  hash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
  transactions: [TEST_TX],
  toBuffer: () => {
    return { length: 264 } as Buffer;
  },
  header: {
    toObject: () => {
      return {
        hash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929',
        confirmations: 1,
        strippedsize: 228,
        size: 264,
        weight: 948,
        height: 1355,
        version: 536870912,
        versionHex: '20000000',
        merkleRoot: '08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08',
        tx: ['08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08'],
        time: 1526756523,
        mediantime: 1526066375,
        nonce: 2,
        bits: parseInt('207fffff', 16),
        difficulty: 4.656542373906925e-10,
        chainwork: '0000000000000000000000000000000000000000000000000000000000000a98',
        prevHash: '3420349f63d96f257d56dd970f6b9079af9cf2784c267a13b1ac339d47031fe9'
      };
    }
  }
};
export const TEST_BLOCK_1: BitcoinBlockType = {
  hash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
  transactions: [TEST_TX_1],
  toBuffer: () => {
    return { length: 264 } as Buffer;
  },
  header: {
    toObject: () => {
      return {
        hash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7',
        confirmations: 122,
        strippedsize: 226,
        size: 262,
        weight: 940,
        height: 1362,
        version: 536870912,
        versionHex: '20000000',
        merkleRoot: 'a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e',
        tx: ['a2262b524615b6d2f409784ceff898fd46bdde6a584269788c41f26ac4b4919e'],
        time: 1526326784,
        mediantime: 1526326784,
        nonce: 3,
        bits: parseInt('207fffff', 16),
        difficulty: 4.656542373906925e-10,
        chainwork: '0000000000000000000000000000000000000000000000000000000000000a98',
        prevHash: '64bfb3eda276ae4ae5b64d9e36c9c0b629bc767fb7ae66f9d55d2c5c8103a929'
      };
    }
  }
};
export const TEST_BLOCK_2: BitcoinBlockType = {
  hash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
  transactions: [TEST_TX_2],
  toBuffer: () => {
    return { length: 264 } as Buffer;
  },
  header: {
    toObject: () => {
      return {
        hash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86',
        confirmations: 106,
        strippedsize: 226,
        size: 262,
        weight: 940,
        height: 1367,
        version: 536870912,
        versionHex: '20000000',
        merkleRoot: '8a351fa9fc3fcd38066b4bf61a8b5f71f08aa224d7a86165557e6da7ee13a826',
        tx: ['8a351fa9fc3fcd38066b4bf61a8b5f71f08aa224d7a86165557e6da7ee13a826'],
        time: 1526326785,
        mediantime: 1526326784,
        nonce: 0,
        bits: parseInt('207fffff', 16),
        difficulty: 4.656542373906925e-10,
        chainwork: '0000000000000000000000000000000000000000000000000000000000000a98',
        prevHash: '528f01c17829622ed6a4af51b3b3f6c062f304fa60e66499c9cbb8622c8407f7'
      };
    }
  }
};
export const TEST_BLOCK_3: BitcoinBlockType = {
  hash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
  transactions: [TEST_TX_3],
  toBuffer: () => {
    return { length: 264 } as Buffer;
  },
  header: {
    toObject: () => {
      return {
        hash: '3279069d22ce5af68ef38332d5b40e79e1964b154d466e7fa233015a34c27312',
        confirmations: 126,
        strippedsize: 226,
        size: 262,
        weight: 940,
        height: 1357,
        version: 536870912,
        versionHex: '20000000',
        merkleRoot: '8c29860888b915715878b21ce14707a17b43f6c51dfb62a1e736e35bc5d8093f',
        tx: ['8c29860888b915715878b21ce14707a17b43f6c51dfb62a1e736e35bc5d8093f'],
        time: 1526326785,
        mediantime: 1526326785,
        nonce: 3,
        bits: parseInt('207fffff', 16),
        difficulty: 4.656542373906925e-10,
        chainwork: '0000000000000000000000000000000000000000000000000000000000000a98',
        prevHash: '2a883ff89c7d6e9302bb4a4634cd580319a4fd59d69e979b344972b0ba042b86'
      };
    }
  }
};
