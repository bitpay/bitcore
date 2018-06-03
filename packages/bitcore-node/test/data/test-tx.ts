import { CoreTransaction } from "../../src/types/namespaces/ChainAdapter";

export const TEST_TX = {
  hash: '08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08',
  _hash: '08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08',
  isCoinbase: () => true,
  outputAmount: 0.09765625,
  inputs: [],
  outputs: [],
  nLockTime: 0,
  toBuffer: () => Buffer.from('')
};

export const TEST_CORE_TX: CoreTransaction = {
  chain: 'BTC',
  network: 'regtest',
  parent: undefined,
  hash: '08e23107e8449f02568d37d37aa76e840e55bbb5f100ed8ad257af303db88c08',
  size: 0,
  coinbase: true,
  nLockTime: 0,
  inputs: [],
  outputs: []
};
