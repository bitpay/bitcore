import { Transform } from 'stream';
import { MongoBound } from '../../../../models/base';
import { Config } from '../../../../services/config';
import { IEVMNetworkConfig } from '../../../../types/Config';
import { IEVMTransactionTransformed } from '../types';

export class EVMListTransactionsStream extends Transform {
  constructor(private walletAddresses: Array<string>) {
    super({ objectMode: true });
  }
  async _transform(transaction: MongoBound<IEVMTransactionTransformed>, _, done) {
    const baseTx = {
      id: transaction._id,
      txid: transaction.txid,
      fee: transaction.fee,
      height: transaction.blockHeight,
      from: transaction.from,
      initialFrom: transaction.initialFrom || transaction.from,
      gasPrice: transaction.gasPrice,
      gasLimit: transaction.gasLimit,
      receipt: transaction.receipt,
      address: transaction.to,
      blockTime: transaction.blockTimeNormalized,
      error: transaction.error,
      network: transaction.network,
      chain: transaction.chain,
      nonce: transaction.nonce,
      effects: transaction.effects,
      callStack: transaction.callStack
    } as any;

    // Add old properties if leanTxStorage is not enabled
    const config = Config.chainConfig({ chain: transaction.chain, network: transaction.network }) as IEVMNetworkConfig;
    if (!config || !config.leanTransactionStorage) {
      baseTx.abiType = transaction.abiType;
      baseTx.internal = transaction.internal;
      baseTx.calls = transaction.calls;
      baseTx.data = transaction.data ? transaction.data.toString() : '';
    }
    let sending = this.walletAddresses.includes(transaction.from);
    if (sending) {
      let sendingToOurself = this.walletAddresses.includes(transaction.to);
      if (!sendingToOurself) {
        baseTx.category = 'send';
        baseTx.satoshis = -transaction.value
        this.push(
          JSON.stringify(baseTx) + '\n'
        );
      } else {
        baseTx.category = 'move';
        baseTx.satoshis = transaction.value;
        this.push(
          JSON.stringify(baseTx) + '\n'
        );
      }
    } else {
      const weReceived = this.walletAddresses.includes(transaction.to);
      if (weReceived) {
        baseTx.category = 'receive';
        baseTx.satoshis = transaction.value;
        this.push(
          JSON.stringify(baseTx) + '\n'
        );
      }
    }
    return done();
  }
}
