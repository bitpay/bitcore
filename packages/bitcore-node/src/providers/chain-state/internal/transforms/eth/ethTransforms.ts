import { Transform } from 'stream';
import { IWallet } from '../../../../../models/wallet';
import { WalletAddressStorage } from '../../../../../models/walletAddress';
import { IEthTransaction } from '../../../../../types/Transaction';

export class EthListTransactionsStream extends Transform {
  constructor(private wallet: IWallet) {
    super({ objectMode: true });
  }

  async _transform(transaction: IEthTransaction, _, done) {
    const sending = await WalletAddressStorage.collection.countDocuments({
      wallet: this.wallet._id,
      address: transaction.from
    });
    if (sending > 0) {
      const sendingToOurself = await WalletAddressStorage.collection.countDocuments({
        wallets: this.wallet._id,
        address: transaction.to
      });
      if (!sendingToOurself) {
        this.push(
          JSON.stringify({
            txid: transaction.txid,
            fee: transaction.fee,
            category: 'send',
            value: -transaction.value,
            height: transaction.blockHeight,
            from: transaction.from,
            to: transaction.to,
            blockTime: transaction.blockTimeNormalized,
            internal: transaction.internal,
            abiType: transaction.abiType,
            error: transaction.error
          }) + '\n'
        );
      } else {
        this.push(
          JSON.stringify({
            txid: transaction.txid,
            fee: transaction.fee,
            category: 'move',
            value: transaction.value,
            height: transaction.blockHeight,
            from: transaction.from,
            to: transaction.to,
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
            txid: transaction.txid,
            fee: transaction.fee,
            category: 'recieve',
            value: transaction.value,
            height: transaction.blockHeight,
            from: transaction.from,
            to: transaction.to,
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
