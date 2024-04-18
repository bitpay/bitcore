import Web3 from 'web3';
import logger from '../../../../../logger';
import { EVMTransactionStorage } from '../../models/transaction';
import { GethBlock, IAbiDecodedData, IEVMBlock, IEVMTransactionInProcess } from '../../types';
import { Callback, IJsonRpcRequest, IJsonRpcResponse, IRpc } from './index';

interface IGethTxTraceResponse {
  result: IGethTxTrace;
}

interface IGethTxTraceBase {
  from: string;
  gas: string;
  gasUsed: string;
  input: string;
  output: string;
  to: string;
  type: 'CALL' | 'STATICCALL' | 'DELEGATECALL' | 'CREATE' | 'CREATE2';
  value: string;
  abiType?: IAbiDecodedData;
}

export interface IGethTxTrace extends IGethTxTraceBase {
  calls?: IGethTxTrace[];
}

export interface IGethTxTraceFlat extends IGethTxTraceBase {
  depth: string;
}

export class GethRPC implements IRpc {
  web3: Web3;

  constructor(web3: Web3) {
    this.web3 = web3;
  }

  public getBlock(blockNumber: number): Promise<GethBlock> {
    return (this.web3.eth.getBlock(blockNumber, true) as unknown) as Promise<GethBlock>;
  }

  private async traceBlock(blockNumber: number): Promise<IGethTxTraceResponse[]> {
    let result = [] as IGethTxTraceResponse[];
    try {
      result = await this.send<IGethTxTraceResponse[]>({
        method: 'debug_traceBlockByNumber',
        params: [this.web3.utils.toHex(blockNumber), { tracer: 'callTracer' }],
        jsonrpc: '2.0',
        id: Date.now() + Math.round(Math.random() * 1000)
      });
    } catch (e: any) {
      logger.debug('%o', e);
    }
    return result;
  }

  public async getTransactionsFromBlock(blockNumber: number): Promise<IGethTxTrace[]> {
    const tracedTxs = await this.traceBlock(blockNumber);
    const txs = tracedTxs && tracedTxs.length > 0 ? tracedTxs.filter(tx => tx.result) : [];
    return txs.map(tx => this.transactionFromGethTrace(tx));
  }

  public send<T>(data: IJsonRpcRequest) {
    return new Promise<T>((resolve, reject) => {
      const provider = this.web3.eth.currentProvider as any;
      provider.send(data, function(err, data) {
        if (err || data.error) return reject(err || data.error);
        resolve(data.result as T);
      } as Callback<IJsonRpcResponse>);
    });
  }

  private transactionFromGethTrace(tx: IGethTxTraceResponse) {
    const convertedTx = tx.result;
    convertedTx.abiType = EVMTransactionStorage.abiDecode(tx.result.input);

    for (let call of convertedTx.calls || []) {
      call.abiType = EVMTransactionStorage.abiDecode(tx.result.input);
    }
    return convertedTx;
  }

  public reconcileTraces(block: IEVMBlock, transactions: IEVMTransactionInProcess[], traces: IGethTxTrace[]) {
    // TODO calculate total block reward including fees
    block;

    for (let i in traces) {
      if (traces[i].calls) {
        let tx = transactions[i];
        tx.calls = traces[i].calls!.flatMap((call, idx) => this.flattenTraceCalls(call, idx.toString()));
      }
    }
    return transactions;
  }

  private flattenTraceCalls(trace: IGethTxTrace, depth: string): IGethTxTraceFlat[] {
    const retval: IGethTxTraceFlat[] = [];

    const calls = trace.calls;

    delete trace.calls;
    trace.abiType = trace.input ? EVMTransactionStorage.abiDecode(trace.input) : undefined;
    if (trace.abiType) {
      for (let param of trace.abiType.params) {
        param.value = typeof param.value === 'string' ? param.value : JSON.stringify(param.value);
        if (param.value && param.value.length > 100) {
          // Need to truncate this so it doesn't blow up the index.
          param.value = param.value.substring(0, 100) + '...';
        }
      }
    }
    (trace as IGethTxTraceFlat).depth = depth;
    retval.push(trace as IGethTxTraceFlat);

    if (calls) {
      retval.push(...calls.flatMap((call, idx) => this.flattenTraceCalls(call, depth + '_' + idx)));
    }

    return retval;
  }
}
