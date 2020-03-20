import { Transform } from 'stream';
import { CoinStorage } from '../../../models/coin';
import { IWallet } from '../../../models/wallet';
import { IWalletAddress, WalletAddressStorage } from '../../../models/walletAddress';
import { IXrpTransaction } from '../types';
export class RippleDbWalletTransactions extends Transform {
  walletAddresses?: Array<IWalletAddress>;
  constructor(public wallet: IWallet) {
    super({ objectMode: true });
  }

  async getAddresses() {
    const { chain, network, _id } = this.wallet;
    if (!this.walletAddresses) {
      this.walletAddresses = await WalletAddressStorage.collection.find({ chain, network, wallet: _id }).toArray();
    }
    return this.walletAddresses;
  }

  async _transform(tx: IXrpTransaction, _, done) {
    const { chain, network } = this.wallet;
    const outputs = await CoinStorage.collection
      .find(
        {
          chain,
          network,
          mintTxid: tx.txid
        },
        { batchSize: 10000 }
      )
      .project({ address: 1, wallets: 1, value: 1, mintIndex: 1 })
      .addCursorFlag('noCursorTimeout', true)
      .toArray();

    const walletAddresses = await this.getAddresses();
    const relevantAddresses = walletAddresses.map(w => w.address);
    let sending = relevantAddresses.includes(tx.from);
    let receiving = false;
    for (const output of outputs) {
      const { address } = output;
      if (relevantAddresses.includes(output.address) && output.value > 0) {
        receiving = true;
      }
      if (sending) {
        if (!receiving) {
          this.push(
            JSON.stringify({
              id: tx.txid,
              txid: tx.txid,
              fee: tx.fee,
              size: 0,
              category: 'send',
              satoshis: -1 * output.value,
              height: tx.blockHeight,
              address,
              outputIndex: output.mintIndex,
              blockTime: tx.blockTimeNormalized
            }) + '\n'
          );
        } else {
          this.push(
            JSON.stringify({
              id: tx.txid,
              txid: tx.txid,
              fee: tx.fee,
              size: 0,
              category: 'move',
              satoshis: -1 * output.value,
              height: tx.blockHeight,
              address,
              outputIndex: output.mintIndex,
              blockTime: tx.blockTimeNormalized
            }) + '\n'
          );
        }
        if (tx.fee > 0) {
          this.push(
            JSON.stringify({
              id: tx.txid,
              txid: tx.txid,
              category: 'fee',
              satoshis: -1 * tx.fee,
              height: tx.blockHeight,
              blockTime: tx.blockTimeNormalized
            }) + '\n'
          );
        }
        return done();
      } else {
        if (receiving) {
          this.push(
            JSON.stringify({
              id: tx.txid,
              txid: tx.txid,
              fee: tx.fee,
              size: 0,
              category: 'receive',
              satoshis: output.value * 1e6,
              height: tx.blockHeight,
              address,
              outputIndex: output.mintIndex,
              blockTime: tx.blockTimeNormalized
            }) + '\n'
          );
        }
      }
    }
    done();
  }
}
