import Web3 from 'web3';
import AbiDecoder from 'abi-decoder';
import { IEthTransaction } from '../../../types/Transaction';
import { LoggifyClass } from '../../../decorators/Loggify';
const erc20abi = require('../erc20/erc20abi');
const erc721abi = require('../erc20/erc721abi');

if (Symbol['asyncIterator'] === undefined) (Symbol as any)['asyncIterator'] = Symbol.for('asyncIterator');

interface ParityCall {
  callType?: 'call' | 'delegatecall';
  author?: string;
  rewardType?: 'block' | 'uncle';
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
  error: string;
  result: { gasUsed?: string; output: string };
  subtraces: number;
  traceAddress: [];
  transactionHash: string;
  transactionPosition: number;
  type: 'reward' | 'call' | 'delegatecall' | 'create';
}

export interface ClassifiedTrace extends ParityTraceResponse {
  abiType?: IEthTransaction['abiType'];
}

export interface TokenTransferResponse {
  name?: 'transfer';
  params?: [{ name: string; value: string; type: string }];
}

@LoggifyClass
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

  public async *getTransactionsFromBlock(blockNumber: number) {
    const txs = await this.traceBlock(blockNumber);
    if (txs && txs.length > 1) {
      for (const tx of txs) {
        yield this.transactionFromParityTrace(tx);
      }
    }
  }

  public send<T>(data: any) {
    return new Promise<T>((resolve, reject) => {
      this.web3.eth.currentProvider.send(data, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data.result);
      });
    });
  }

  abiDecode(input: string) {
    try {
      try {
        AbiDecoder.addABI(erc20abi);
        if (!AbiDecoder.decodeMethod(input).params) throw new Error('Failed to decode for ERC20');
        return 'ERC20';
      } catch {
        AbiDecoder.addABI(erc721abi);
        if (!AbiDecoder.decodeMethod(input).params) throw new Error('Failed to decode for ERC20');
        return 'ERC721';
      }
    } catch {
      return undefined;
    }
  }

  private async transactionFromParityTrace(tx: ParityTraceResponse): Promise<ClassifiedTrace> {
    const abiType = await this.abiDecode(tx.action.input!);
    const convertedTx: ClassifiedTrace = {
      ...tx
    };
    if (abiType) {
      convertedTx.abiType = abiType;
    }
    return convertedTx;
  }
}
