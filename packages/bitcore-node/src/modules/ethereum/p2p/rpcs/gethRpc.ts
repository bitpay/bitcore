import Web3 from 'web3';
import { EthTransactionStorage } from '../../models/transaction';
import { GethBlock, IAbiDecodedData, IEthBlock, IEthTransaction } from '../../types';
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
  type: 'CREATE';
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
    // throw new Error('Geth support is not fully implemented yet.');
  }

  public getBlock(blockNumber: number): Promise<GethBlock> {
    return (this.web3.eth.getBlock(blockNumber, true) as unknown) as Promise<GethBlock>;
  }

  private async traceBlock(blockNumber: number): Promise<IGethTxTraceResponse[]> {
    const result = await this.send<IGethTxTraceResponse[]>({
      method: 'debug_traceBlockByNumber',
      params: [this.web3.utils.toHex(blockNumber), { tracer: 'callTracer' }],
      jsonrpc: '2.0',
      id: 1
    });
    return result;
  }

  public async getTransactionsFromBlock(blockNumber: number): Promise<IGethTxTrace[]> {
    const txs = (await this.traceBlock(blockNumber)) || [];
    return txs.map(tx => this.transactionFromGethTrace(tx));
  }

  public send<T>(data: IJsonRpcRequest) {
    return new Promise<T>((resolve, reject) => {
      const provider = this.web3.eth.currentProvider as any;
      provider.send(data, function(err, data) {
        if (err) return reject(err);
        resolve(data.result as T);
      } as Callback<IJsonRpcResponse>);
    });
  }

  private transactionFromGethTrace(tx: IGethTxTraceResponse) {
    const convertedTx = tx.result;
    convertedTx.abiType = EthTransactionStorage.abiDecode(tx.result.input);

    for (let call of convertedTx.calls || []) {
      call.abiType = EthTransactionStorage.abiDecode(tx.result.input);
    }
    return convertedTx;
  }

  public reconcileTraces(block: IEthBlock, transactions: IEthTransaction[], traces: IGethTxTrace[]) {
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
    trace.abiType = trace.input ? EthTransactionStorage.abiDecode(trace.input) : undefined;
    (trace as IGethTxTraceFlat).depth = depth;
    retval.push(trace as IGethTxTraceFlat);

    if (calls) {
      retval.push(...calls.flatMap((call, idx) => this.flattenTraceCalls(call, depth + '_' + idx)));
    }

    return retval;
  }
}
