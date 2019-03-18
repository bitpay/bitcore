import Web3 from 'web3';
import AbiDecoder from 'abi-decoder';
const erc20abi = require('../erc20/erc20abi');

if (Symbol['asyncIterator'] === undefined) (Symbol as any)['asyncIterator'] = Symbol.for('asyncIterator');

interface ParityBlockReward {
  author: string;
  rewardType: 'block';
  value: string;
  input?: string;
  from?: string;
  to?: string;
}
interface ParityCall {
  callType: 'call' | 'delegatecall';
  from: string;
  gas: string;
  input: string;
  to: string;
  value: string;
}
export interface ParityTraceResponse {
  action: ParityCall | ParityBlockReward;
  blockHash: string;
  blockNumber: number;
  result: { gasUsed: string; output: string };
  subtraces: number;
  traceAddress: [];
  transactionHash: string;
  transactionPosition?: number;
  type: 'reward' | 'call' | 'delegatecall';
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

  private async transactionFromParityTrace(tx: ParityTraceResponse, received: boolean) {
    let { timestamp } = await this.web3.eth.getBlock(tx.blockNumber);
    let blockTime = new Date(timestamp * 1000).toUTCString();
    const decodedData = await this.decodeTokenTransfer(tx.action.input!);
    console.log(decodedData);
    if (decodedData && decodedData.params && tx.action.value === '0x0') {
      return {
        chain: 'ETH',
        network: 'mainnet',
        txid: tx.transactionHash!,
        height: tx.blockNumber,
        blockHeight: tx.blockNumber,
        blockHash: tx.blockHash,
        blockTime: new Date(blockTime),
        blockTimeNormalized: new Date(blockTime),
        coinbase: false,
        fee: parseInt(tx.result.gasUsed),
        size: 0,
        locktime: 0,
        inputCount: 0,
        outputCount: 0,
        outputIndex: tx.result ? tx.result.output : null,
        value: 0,
        wallets: [],
        from: tx.action.from!,
        to: tx.action.to!,
        category: 'transfer',
        type: tx.type,
        ERC20: true,
        satoshis: decodedData.params.filter(e => e.name === '_value')[0].value
      };
    } else {
      return {
        chain: 'ETH',
        network: 'mainnet',
        txid: tx.transactionHash!,
        height: tx.blockNumber,
        blockHeight: tx.blockNumber,
        blockHash: tx.blockHash,
        blockTime: new Date(blockTime),
        blockTimeNormalized: new Date(blockTime),
        coinbase: false,
        fee: parseInt(tx.result.gasUsed),
        size: 0,
        locktime: 0,
        inputCount: 0,
        outputCount: 0,
        outputIndex: tx.result ? tx.result.output : null,
        value: parseInt(tx.action.value!, 16),
        wallets: [],
        from: tx.action.from,
        to: tx.action.to,
        category: received ? 'receive' : 'send',
        ERC20: false,
        type: tx.type,
        satoshis: tx.action.value
      };
    }
  }

  public async *getTransactionsForAddress(_bestBlock: number, address: string) {
    // const fromBlock = bestBlock - 10000;
    // 4344449, 4344500
    const txs = await this.scan(4344449, 4344499, address);
    for (const tx of txs.to) {
      yield this.transactionFromParityTrace(tx, true);
    }
    for (const tx of txs.from) {
      yield this.transactionFromParityTrace(tx, false);
    }
  }

  async scan(fromHeight: number, toHeight: number, address: string) {
    const from = await this.send<Array<ParityTraceResponse>>({
      method: 'trace_filter',
      params: [
        {
          fromBlock: this.web3.utils.toHex(fromHeight),
          toBlock: this.web3.utils.toHex(toHeight),
          fromAddress: [address],
          count: 10
        }
      ],
      jsonrpc: '2.0',
      id: 0
    });

    const to = await this.send<Array<ParityTraceResponse>>({
      method: 'trace_filter',
      params: [
        {
          fromBlock: this.web3.utils.toHex(fromHeight),
          toBlock: this.web3.utils.toHex(toHeight),
          toAddress: [address],
          count: 10
        }
      ],
      jsonrpc: '2.0',
      id: 0
    });
    return { from, to };
  }
}
