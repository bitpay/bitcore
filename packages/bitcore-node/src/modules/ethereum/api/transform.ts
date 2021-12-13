import { Transform } from 'stream';
import { MongoBound } from '../../../models/base';
import { IEthTransactionTransformed } from '../types';

export class EthListTransactionsStream extends Transform {
  constructor(private walletAddresses: Array<string>) {
    super({ objectMode: true });
  }
  async _transform(transaction: MongoBound<IEthTransactionTransformed>, _, done) {
    const dataStr = transaction.data ? transaction.data.toString() : '';

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
            initialFrom: transaction.initialFrom || transaction.from,
            gasPrice: transaction.gasPrice,
            gasLimit: transaction.gasLimit,
            receipt: transaction.receipt,
            address: transaction.to,
            blockTime: transaction.blockTimeNormalized,
            abiType: transaction.abiType,
            error: transaction.error,
            internal: transaction.internal,
            network: transaction.network,
            chain: transaction.chain,
            data: dataStr,
            nonce: transaction.nonce
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
            initialFrom: transaction.initialFrom || transaction.from,
            gasPrice: transaction.gasPrice,
            gasLimit: transaction.gasLimit,
            receipt: transaction.receipt,
            address: transaction.to,
            blockTime: transaction.blockTimeNormalized,
            abiType: transaction.abiType,
            error: transaction.error,
            internal: transaction.internal,
            network: transaction.network,
            chain: transaction.chain,
            data: dataStr,
            nonce: transaction.nonce
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
            initialFrom: transaction.initialFrom || transaction.from,
            gasPrice: transaction.gasPrice,
            gasLimit: transaction.gasLimit,
            receipt: transaction.receipt,
            address: transaction.to,
            blockTime: transaction.blockTimeNormalized,
            abiType: transaction.abiType,
            error: transaction.error,
            internal: transaction.internal,
            network: transaction.network,
            chain: transaction.chain,
            data: dataStr,
            nonce: transaction.nonce
          }) + '\n'
        );
      }
    }
    return done();
  }
}
