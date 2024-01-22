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
import { ErigonBlock, IAbiDecodedData, IEVMBlock, IEVMTransactionInProcess } from '../../types';
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

export interface ClassifiedTrace extends ErigonTraceResponse {
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
      id: Date.now() + Math.round(Math.random() * 1000)
    });
    return txs;
  }

  public async getTransactionsFromBlock(blockNumber: number): Promise<ClassifiedTrace[]> {
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

  private transactionFromErigonTrace(tx: ErigonTraceResponse): ClassifiedTrace {
    const abiType = EVMTransactionStorage.abiDecode(tx.action.input!);
    const convertedTx: ClassifiedTrace = {
      ...tx
    };
    if (abiType) {
      convertedTx.abiType = abiType;
    }
    return convertedTx;
  }

  public reconcileTraces(block: IEVMBlock, transactions: IEVMTransactionInProcess[], traceTxs: ClassifiedTrace[]) {
    const gasSum = transactions.reduce((sum, e) => sum + e.fee, 0);

    for (const tx of traceTxs) {
      if (tx.type === 'reward') {
        if (tx.action.rewardType && tx.action.rewardType === 'block') {
          const totalReward = Number.parseInt(tx.action.value, 16) + gasSum;
          block.reward = totalReward;
        }
        if (tx.action.rewardType && tx.action.rewardType === 'uncle') {
          const uncles = block.uncleReward || [];
          const uncleValue = Number.parseInt(tx.action.value, 16);
          uncles.push(uncleValue);
          block.uncleReward = uncles;
        }
      }
      if (tx && tx.action) {
        const foundIndex = transactions.findIndex(
          t =>
            t.txid === tx.transactionHash &&
            t.from !== tx.action.from &&
            t.to.toLowerCase() !== (tx.action.to || '').toLowerCase()
        );
        if (foundIndex > -1) {
          transactions[foundIndex].internal.push(tx);
        }
        if (tx.error) {
          const errorIndex = transactions.findIndex(t => t.txid === tx.transactionHash);
          if (errorIndex && errorIndex > -1) {
            transactions[errorIndex].error = tx.error;
          }
        }
      }
    }
  }
}
