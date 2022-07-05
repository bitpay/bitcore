import AbiDecoder from 'abi-decoder';
import Web3 from 'web3';
import { LoggifyClass } from '../../../../decorators/Loggify';
import { ERC20Abi } from '../../abi/erc20';
import { ERC721Abi } from '../../abi/erc721';
import { EthTransactionStorage } from '../../models/transaction';
import { IEthTransaction } from '../../types';
import { Callback, IJsonRpcRequest, IJsonRpcResponse, IRpc } from './index';

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
  to?: string;
}

export interface TokenTransferResponse {
  name?: 'transfer';
  params?: Array<{ name: string; value: string; type: string }>;
}



@LoggifyClass
export class ParityRPC implements IRpc {
  web3: Web3;

  constructor(web3: Web3) {
    this.web3 = web3;
  }

  public getBlock(blockNumber: number) {
    return this.web3.eth.getBlock(blockNumber, true);
  }

  private async traceBlock(blockNumber: number): Promise<Array<ParityTraceResponse>> {
    const txs = await this.send<Array<ParityTraceResponse>>({
      method: 'trace_block',
      // method: 'debug_traceBlockByNumber',
      params: [this.web3.utils.toHex(blockNumber)],
      jsonrpc: '2.0',
      id: 1
    });
    return txs;
  }

  public async getTransactionsFromBlock(blockNumber: number) {
    const txs = (await this.traceBlock(blockNumber)) || [];
    return txs.map(tx => this.transactionFromParityTrace(tx));
  }

  public send<T>(data: IJsonRpcRequest) {
    return new Promise<T>((resolve, reject) => {
      const provider = this.web3.eth.currentProvider as any; // Import type HttpProvider web3-core
      provider.send(data, function(err, data) {
        if (err) return reject(err);
        resolve(data.result as T);
      } as Callback<IJsonRpcResponse>);
    });
  }

  private transactionFromParityTrace(tx: ParityTraceResponse): ClassifiedTrace {
    const abiType = EthTransactionStorage.abiDecode(tx.action.input!);
    const convertedTx: ClassifiedTrace = {
      ...tx
    };
    if (abiType) {
      convertedTx.abiType = abiType;
    }
    return convertedTx;
  }
}
