/**
 * !Important!
 * Erigon support is not actively maintained by BitPay. If there
 *  are issues with connecting to Erigon that need fixing, please
 *  open a PR.
 */

import AbiDecoder from 'abi-decoder';
import Web3 from 'web3';
import { LoggifyClass } from '../../../../../decorators/Loggify';
import { ERC20Abi } from '../../abi/erc20';
import { ERC721Abi } from '../../abi/erc721';
import { EVMTransactionStorage } from '../../models/transaction';
import { ErigonBlock, IAbiDecodedData, IEVMBlock, IEVMTransaction } from '../../types';
import { Callback, IJsonRpcRequest, IJsonRpcResponse, IRpc } from './index';

AbiDecoder.addABI(ERC20Abi);
AbiDecoder.addABI(ERC721Abi);

if (Symbol['asyncIterator'] === undefined) (Symbol as any)['asyncIterator'] = Symbol.for('asyncIterator');

interface ErigonCall {
  callType?: 'call' | 'delegatecall';
  author?: string;
  rewardType?: 'block' | 'uncle';
  from?: string;
  gas?: string;
  input?: string;
  to: string;
  value: string;
}

export interface ErigonTraceResponse {
  action: ErigonCall;
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

export interface ErigonTxTrace extends ErigonTraceResponse {
  abiType?: IAbiDecodedData;
  to?: string;
}

@LoggifyClass
export class ErigonRPC implements IRpc {
  web3: Web3;

  constructor(web3: Web3) {
    this.web3 = web3;
  }

  public getBlock(blockNumber: number): Promise<ErigonBlock> {
    return (this.web3.eth.getBlock(blockNumber, true) as unknown) as Promise<ErigonBlock>;
  }

  private async traceBlock(blockNumber: number): Promise<Array<ErigonTraceResponse>> {
    const txs = await this.send<Array<ErigonTraceResponse>>({
      method: 'trace_block',
      params: [this.web3.utils.toHex(blockNumber)],
      jsonrpc: '2.0',
      id: 1
    });
    return txs;
  }

  public async getTransactionsFromBlock(blockNumber: number): Promise<ErigonTxTrace[]> {
    const txs = (await this.traceBlock(blockNumber)) || [];
    return txs.map(tx => this.transactionFromErigonTrace(tx));
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

  private transactionFromErigonTrace(tx: ErigonTraceResponse): ErigonTxTrace {
    const abiType = EVMTransactionStorage.abiDecode(tx.action.input!);
    const convertedTx: ErigonTxTrace = {
      ...tx
    };
    if (abiType) {
      convertedTx.abiType = abiType;
    }
    return convertedTx;
  }

  public reconcileTraces(block: IEVMBlock, transactions: IEVMTransaction[], traceTxs: ErigonTxTrace[]) {
    // TODO calculate total block reward including fees
    block;

    for (const tx of traceTxs) {
      // if traceAddress is empty then the trace is the top level tx call - no need to store twice
      if (tx && tx.action && !!tx.traceAddress.length) {
        const foundIndex = transactions.findIndex(t => t.txid === tx.transactionHash);
        if (foundIndex > -1) {
          transactions[foundIndex].calls.push(EVMTransactionStorage.transformToStandardClass(tx));
          if (tx.error) {
            transactions[foundIndex].error = tx.error;
          }
        }
      }
    }
  }
}
