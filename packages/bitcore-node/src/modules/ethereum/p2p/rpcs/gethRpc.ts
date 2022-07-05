import Web3 from 'web3';
import { EthTransactionStorage } from '../../models/transaction';
import { IEthTransaction } from '../../types';
import { Callback, IJsonRpcRequest, IJsonRpcResponse, IRpc } from './index';

interface IGethTransactionTrace {
  result: IGethTransactionTraceResult;
}

interface IGethTransactionTraceResult {
  from: string;
  gas: string;
  gasUsed: string;
  input: string;
  output: string;
  to: string;
  type: 'CREATE';
  value: string;
  calls?: IGethTransactionTraceResult[];
  abiType?: IEthTransaction['abiType'];
}

export class GethRPC implements IRpc {
  web3: Web3;

  constructor(web3: Web3) {
    this.web3 = web3;
    throw new Error('Geth support is not fully implemented yet.');
  }

  public getBlock(blockNumber: number) {
    return this.web3.eth.getBlock(blockNumber, true);
  }

  private async traceBlock(blockNumber: number) {
    const txs = await this.send<Array<IGethTransactionTrace>>({
      method: 'debug_traceBlockByNumber',
      params: [this.web3.utils.toHex(blockNumber), { tracer: 'callTracer' }],
      jsonrpc: '2.0',
      id: 1
    });
    return txs;
  }

  public async getTransactionsFromBlock(blockNumber: number) {
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

  private transactionFromGethTrace(tx: IGethTransactionTrace) {
    const convertedTx = tx.result;
    convertedTx.abiType = EthTransactionStorage.abiDecode(tx.result.input);

    for (let call of convertedTx.calls || []) {
      call.abiType = EthTransactionStorage.abiDecode(tx.result.input);
    }
    return convertedTx;
  }
}
