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
    if (sending) {
      const sends = outputs.filter(o => o.address != tx.from);
      sends.forEach(output => {
        this.push(
          JSON.stringify({
            id: tx.txid,
            txid: tx.txid,
            fee: tx.fee,
            size: 0,
            category: 'send',
            satoshis: -1 * Math.abs(output.value),
            height: tx.blockHeight,
            address: output.address,
            outputIndex: output.mintIndex,
            blockTime: tx.blockTimeNormalized
          }) + '\n'
        );
      });

      const moves = outputs.filter(o => o.address != tx.from && relevantAddresses.includes(o.address));
      moves.forEach(output => {
        this.push(
          JSON.stringify({
            id: tx.txid,
            txid: tx.txid,
            fee: tx.fee,
            size: 0,
            category: 'move',
            satoshis: -1 * Math.abs(output.value),
            height: tx.blockHeight,
            address: output.address,
            outputIndex: output.mintIndex,
            blockTime: tx.blockTimeNormalized
          }) + '\n'
        );
      });

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
    } else {
      const receives = outputs.filter(o => relevantAddresses.includes(o.address));
      receives.forEach(output => {
        this.push(
          JSON.stringify({
            id: tx.txid,
            txid: tx.txid,
            fee: tx.fee,
            size: 0,
            category: 'receive',
            satoshis: Math.abs(output.value),
            height: tx.blockHeight,
            address: output.address,
            outputIndex: output.mintIndex,
            blockTime: tx.blockTimeNormalized
          }) + '\n'
        );
      });
    }
    done();
  }
}
