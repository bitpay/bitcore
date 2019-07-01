import BN from 'bn.js';
export declare namespace Ethereum {
  export type Block = {
    header: Header;
    transactions: Transaction[];
    uncleHeaders: Header[];
    raw: Buffer[];
    txTrie: any;
  };

  export type Header = {
    parentHash: Buffer;
    uncleHash: Buffer;
    coinbase: Buffer;
    stateRoot: Buffer;
    transactionsTrie: Buffer;
    receiptTrie: Buffer;
    bloom: Buffer;
    difficulty: Buffer;
    number: Buffer;
    gasLimit: Buffer;
    gasUsed: Buffer;
    timestamp: Buffer;
    extraData: Buffer;
    mixHash: Buffer;
    nonce: Buffer;
    raw: Array<Buffer>;
    hash: () => Buffer;
  };

  export type Transaction = {
    hash: () => Buffer;
    nonce: Buffer;
    gasPrice: Buffer;
    gasLimit: Buffer;
    to: Buffer;
    from: Buffer;
    value: Buffer;
    data: Buffer;
    // EIP 155 chainId - mainnet: 1, ropsten: 3
    chainId: number;
    getUpfrontCost: () => BN;
  };
}
