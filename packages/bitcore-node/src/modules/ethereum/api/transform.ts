import { Transform } from 'stream';
import { MongoBound } from '../../../models/base';
import { IWallet } from '../../../models/wallet';
import { WalletAddressStorage } from '../../../models/walletAddress';
import { IEthTransaction } from '../types';

export class EthListTransactionsStream extends Transform {
  constructor(private wallet: IWallet) {
    super({ objectMode: true });
  }

  async _transform(transaction: MongoBound<IEthTransaction>, _, done) {
    const sending = await WalletAddressStorage.collection.countDocuments({
      wallet: this.wallet._id,
      address: transaction.from
    });
    if (sending > 0) {
      const sendingToOurself = await WalletAddressStorage.collection.countDocuments({
        wallet: this.wallet._id,
        address: transaction.to
      });
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
            address: transaction.to,
            blockTime: transaction.blockTimeNormalized,
            internal: transaction.internal,
            abiType: transaction.abiType,
            error: transaction.error
          }) + '\n'
        );
      }
      return done();
    } else {
      const weReceived = await WalletAddressStorage.collection.countDocuments({
        wallet: this.wallet._id,
        address: transaction.to
      });
      if (weReceived > 0) {
        this.push(
          JSON.stringify({
            id: transaction._id,
            txid: transaction.txid,
            fee: transaction.fee,
            category: 'receive',
            satoshis: transaction.value,
            height: transaction.blockHeight,
            from: transaction.from,
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
