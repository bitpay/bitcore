import Web3 from 'web3';

if (Symbol['asyncIterator'] === undefined) (Symbol as any)['asyncIterator'] = Symbol.for('asyncIterator');

interface ParityBlockReward {
  author: string;
  rewardType: 'block';
  value: string;
}
interface ParityCall {
  callType: 'call';
  from: string;
  gas: string;
  input: string;
  to: string;
  value: string;
}
export interface ParityTraceResponse {
  action: ParityBlockReward | ParityCall;
  blockHash: string;
  blockNumber: number;
  result?: { gasUsed: string; output: string };
  subtraces: number;
  traceAddress: [];
  transactionHash?: string;
  transactionPosition?: number;
  type: 'reward' | 'call';
}

export class ParityRPC {
  web3: Web3;

  constructor(web3: Web3) {
    this.web3 = web3;
  }

  public async *getTransactionsForAddress(bestBlock: number, address: string) {
    const fromBlock = bestBlock - 100000;
    const txs = await this.scan(fromBlock, bestBlock, address);
    for (const tx of txs) {
      let { timestamp } = await this.web3.eth.getBlock(tx.blockNumber);
      let blockTime = new Date(timestamp * 1000).toUTCString();
      yield {
        id: null,
        txid: tx.transactionHash,
        fee: tx.result ? tx.result.gasUsed : null,
        category: 'receive',
        satoshis: tx.action.value,
        height: tx.blockNumber,
        address,
        outputIndex: tx.result ? tx.result.output : null,
        blockTime,
        chain: 'ETH',
        network: 'mainnet'
      };
    }
  }

  scan(fromHeight: number, toHeight: number, address: string) {
    return new Promise<Array<ParityTraceResponse>>(resolve =>
      this.web3.eth.currentProvider.send(
        {
          method: 'trace_filter',
          params: [
            {
              fromBlock: this.web3.utils.toHex(fromHeight),
              toBlock: this.web3.utils.toHex(toHeight),
              toAddress: [address],
            }
          ],
          jsonrpc: '2.0',
          id: 0
        },
        (_, data) => resolve(data.result as Array<ParityTraceResponse>)
      )
    );
  }
}
