import { Transform } from 'stream';
import { MongoBound } from '../../../models/base';
import { IEthTransaction } from '../types';

export class EthListTransactionsStream extends Transform {
  constructor(private walletAddresses: Array<string>) {
    super({ objectMode: true });
  }

  async _transform(transaction: MongoBound<IEthTransaction>, _, done) {
    let sending = this.walletAddresses.includes(transaction.from);
    if (sending) {
      let sendingToOurself = this.walletAddresses.includes(transaction.to);
      if (!sendingToOurself) {
        this.push(
          JSON.stringify({
            id: transaction._id,
            txid: transaction.txid,
            fee: transaction.fee,
            category: 'send',
            satoshis: -transaction.value,
            height: transaction.blockHeight,
            from: transaction.from,
            gasPrice: transaction.gasPrice,
            gasLimit: transaction.gasLimit,
            receipt: transaction.receipt,
            address: transaction.to,
            blockTime: transaction.blockTimeNormalized,
            internal: transaction.internal,
            abiType: transaction.abiType,
            error: transaction.error
          }) + '\n'
        );
      } else {
        this.push(
          JSON.stringify({
            id: transaction._id,
            txid: transaction.txid,
            fee: transaction.fee,
            category: 'move',
            satoshis: transaction.value,
            height: transaction.blockHeight,
            from: transaction.from,
            gasPrice: transaction.gasPrice,
            gasLimit: transaction.gasLimit,
            receipt: transaction.receipt,
            address: transaction.to,
            blockTime: transaction.blockTimeNormalized,
            internal: transaction.internal,
            abiType: transaction.abiType,
            error: transaction.error
          }) + '\n'
        );
      }
    } else {
      const weReceived = this.walletAddresses.includes(transaction.to);
      if (weReceived) {
        this.push(
          JSON.stringify({
            id: transaction._id,
            txid: transaction.txid,
            fee: transaction.fee,
            category: 'receive',
            satoshis: transaction.value,
            height: transaction.blockHeight,
            from: transaction.from,
            gasPrice: transaction.gasPrice,
            gasLimit: transaction.gasLimit,
            receipt: transaction.receipt,
            address: transaction.to,
            blockTime: transaction.blockTimeNormalized,
            internal: transaction.internal,
            abiType: transaction.abiType,
            error: transaction.error
          }) + '\n'
        );
      }
    }
    return done();
  }
}
