import { FormattedTransactionType } from 'ripple-lib/dist/npm/transaction/types';
import { Transform } from 'stream';
import { ITransaction } from '../../../models/baseTransaction';
import { IWallet } from '../../../models/wallet';
import { IWalletAddress, WalletAddressStorage } from '../../../models/walletAddress';
import { RippleStateProvider } from './csp';
export class RippleWalletTransactions extends Transform {
  walletAddresses?: Array<IWalletAddress>;
  constructor(private wallet: IWallet, private csp: RippleStateProvider) {
    super({ objectMode: true });
  }

  async getAddresses() {
    const { chain, network, _id } = this.wallet;
    if (!this.walletAddresses) {
      this.walletAddresses = await WalletAddressStorage.collection.find({ chain, network, wallet: _id }).toArray();
    }
    return this.walletAddresses;
  }

  async _transform(tx: FormattedTransactionType, _, done) {
    const { network } = this.wallet;
    const transaction = this.csp.transform(tx, network) as ITransaction;
    const changes = tx.outcome.balanceChanges;
    const changed = Object.keys(changes);
    const relevantAddresses = (await this.getAddresses()).filter(w => changed.includes(w.address)).map(w => w.address);
    let sending = false;
    let receiving = false;
    for (let address of relevantAddresses) {
      for (const output of changes[address]) {
        if (Number(output.value) > 0) {
          receiving = true;
        }
        if (Number(output.value) < 0) {
          sending = true;
        }
      }
      for (const output of changes[address]) {
        if (sending) {
          if (!receiving) {
            this.push(
              JSON.stringify({
                id: tx.id,
                txid: tx.id,
                fee: transaction.fee * 1e6,
                size: 0,
                category: 'send',
                satoshis: -1 * Number(output.value) * 1e6,
                height: transaction.blockHeight,
                address,
                outputIndex: changed.indexOf(address),
                blockTime: transaction.blockTimeNormalized
              }) + '\n'
            );
          } else {
            this.push(
              JSON.stringify({
                id: tx.id,
                txid: tx.id,
                fee: transaction.fee * 1e6,
                size: 0,
                category: 'move',
                satoshis: -1 * Number(output.value) * 1e6,
                height: transaction.blockHeight,
                address,
                outputIndex: changed.indexOf(address),
                blockTime: transaction.blockTimeNormalized
              }) + '\n'
            );
          }
          if (transaction.fee > 0) {
            this.push(
              JSON.stringify({
                id: tx.id,
                txid: tx.id,
                category: 'fee',
                satoshis: -1 * Number(transaction.fee) * 1e6,
                height: transaction.blockHeight,
                blockTime: transaction.blockTimeNormalized
              }) + '\n'
            );
          }
          return done();
        } else {
          if (receiving) {
            this.push(
              JSON.stringify({
                id: tx.id,
                txid: tx.id,
                fee: transaction.fee * 1e6,
                size: 0,
                category: 'receive',
                satoshis: Number(output.value) * 1e6,
                height: transaction.blockHeight,
                address,
                outputIndex: changed.indexOf(address),
                blockTime: transaction.blockTimeNormalized
              }) + '\n'
            );
          }
        }
      }
    }
    done();
  }
}
