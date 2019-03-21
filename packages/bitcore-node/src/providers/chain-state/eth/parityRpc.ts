import Web3 from 'web3';
import AbiDecoder from 'abi-decoder';
import { ObjectID } from 'bson';
const erc20abi = require('../erc20/erc20abi');

if (Symbol['asyncIterator'] === undefined) (Symbol as any)['asyncIterator'] = Symbol.for('asyncIterator');

interface ParityCall {
  callType?: 'call' | 'delegatecall';
  author?: string;
  rewardType?: 'block';
  from?: string;
  gas?: string;
  input?: string;
  to?: string;
  value: string;
}

export interface ParityTraceResponse {
  action: ParityCall;
  blockHash: string;
  blockNumber: number;
  result: { gasUsed?: string; output: string };
  subtraces: number;
  traceAddress: [];
  transactionHash: string;
  transactionPosition: number;
  type: 'reward' | 'call' | 'delegatecall' | 'create';
}

export interface TokenTransferResponse {
  name?: 'transfer';
  params?: [{ name: string; value: string; type: string }];
}

export class ParityRPC {
  web3: Web3;

  constructor(web3: Web3) {
    this.web3 = web3;
  }

  private async traceBlock(blockNumber: number) {
    const txs = await this.send<Array<ParityTraceResponse>>({
      method: 'trace_block',
      params: [this.web3.utils.toHex(blockNumber)],
      jsonrpc: '2.0',
      id: 0
    });
    return txs;
  }

  public async *getTransactionsFromBlock(blockNumber: number, chain: string, network: string) {
    const txs = await this.traceBlock(blockNumber);
    if (txs && txs.length > 1) {
      for (const tx of txs) {
        yield this.transactionFromParityTrace(tx, chain, network);
      }
    }
  }

  public send<T>(data: any) {
    return new Promise<T>(resolve => {
      this.web3.eth.currentProvider.send(data, (_, data) => resolve(data.result));
    });
  }

  private decodeTokenTransfer(input: ParityCall['input']): TokenTransferResponse {
    try {
      AbiDecoder.addABI(erc20abi);
      return AbiDecoder.decodeMethod(input);
    } catch (err) {
      return err;
    }
  }

  private async transactionFromParityTrace(tx: ParityTraceResponse, chain: string, network: string) {
    const decodedData = await this.decodeTokenTransfer(tx.action.input!);

    let chainId = 1;
    switch (network) {
      case 'mainnet':
        chainId = 1;
        break;
      case 'ropsten':
        chainId = 3;
        break;
      case 'rinkeby':
        chainId = 4;
        break;
      default:
        chainId = 1;
        break;
    }
            // gasUsed: parseInt(tx.result.gasUsed!) || parseInt(tx.action.gas!),
            // new Buffer(tx.result.gasUsed!) ||
    if (decodedData && decodedData.params) {
      return {
        chain,
        network,
        chainId,
        txid: tx.transactionHash,
        blockHeight: tx.blockNumber,
        blockHash: tx.blockHash,
        data: tx.action.input,
        fee: tx.action.gas! ? parseInt(tx.action.gas!) : 0,
        gasLimit: Buffer.from('600000'),
        gasPrice: tx.action.gas! ? Buffer.from(`${tx.action.gas}`) : Buffer.from('0'),
        nonce: Buffer.from(`${tx.transactionPosition!}`),
        outputIndex: tx.result ? tx.result.output : undefined,
        outputAmount: tx.action.rewardType === 'block' ? parseInt(tx.action.value) : 0,
        value: parseInt(tx.action.value) || 0,
        wallets: [] as ObjectID[],
        from: tx.action.from!,
        to: tx.action.to!,
        category: 'transfer',
        ERC20: true,
        tokenTransfer: decodedData.params.filter(e => e.name === '_value')[0].value || 0
      };
    } else {
      return {
        chain,
        network,
        chainId,
        txid: tx.transactionHash,
        blockHeight: tx.blockNumber,
        blockHash: tx.blockHash,
        data: tx.action.input,
        fee: tx.action.gas! ? parseInt(tx.action.gas!) : 0,
        gasLimit: Buffer.from('600000'),
        gasPrice: tx.action.gas! ? Buffer.from(`${tx.action.gas}`) : Buffer.from('0'),
        nonce: Buffer.from(`${tx.transactionPosition!}`),
        outputIndex: tx.result ? tx.result.output : undefined,
        outputAmount: tx.action.rewardType === 'block' ? parseInt(tx.action.value) : 0,
        value: parseInt(tx.action.value) || 0,
        wallets: [] as ObjectID[],
        from: tx.action.from,
        to: tx.action.to,
        category: tx.type,
        ERC20: false,
        tokenTransfer: 0
      };
    }
  }
}
