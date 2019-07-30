import { LoggifyClass } from '../../decorators/Loggify';
import { Web3 } from 'web3';
import AbiDecoder from 'abi-decoder';
import { IEthTransaction, Parity } from './types';
import { ERC20Abi } from './abi/erc20';
import { ERC721Abi } from './abi/erc721';

AbiDecoder.addABI(ERC20Abi);
AbiDecoder.addABI(ERC721Abi);

if (Symbol['asyncIterator'] === undefined) (Symbol as any)['asyncIterator'] = Symbol.for('asyncIterator');

interface ParityCall {
  callType?: 'call' | 'delegatecall';
  author?: string;
  rewardType?: 'block' | 'uncle';
  from?: string;
  gas?: string;
  input?: string;
  to: string;
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

  public getBlock(blockNumber: number): Parity.Block {
    return this.web3.eth.getBlock(blockNumber, true);
  }

  private async traceBlock(blockNumber: number) {
    const txs = await this.send<Array<ParityTraceResponse>>({
      method: 'trace_block',
      params: [this.web3.utils.toHex(blockNumber)],
      jsonrpc: '2.0',
      id: 1
    });
    return txs;
  }

  public async getTransactionsFromBlock(blockNumber: number) {
    const txs = await this.traceBlock(blockNumber);
    return txs.map(tx => this.transactionFromParityTrace(tx));
  }

  public send<T>(data: any) {
    return new Promise<T>((resolve, reject) => {
      this.web3.eth.currentProvider.send(data, (err, data) => {
        if (err) return reject(err);
        resolve(data.result);
      });
    });
  }

  abiDecode(input?: string) {
    try {
      try {
        if (!AbiDecoder.decodeMethod(input).params) throw new Error('Failed to decode for ERC20');
        return 'ERC20';
      } catch {
        if (!AbiDecoder.decodeMethod(input).params) throw new Error('Failed to decode for ERC20');
        return 'ERC721';
      }
    } catch {
      return undefined;
    }
  }

  private transactionFromParityTrace(tx: ParityTraceResponse): ClassifiedTrace {
    const abiType = this.abiDecode(tx.action.input!);
    const convertedTx: ClassifiedTrace = {
      ...tx
    };
    if (abiType) {
      convertedTx.abiType = abiType;
    }
    return convertedTx;
  }
}
