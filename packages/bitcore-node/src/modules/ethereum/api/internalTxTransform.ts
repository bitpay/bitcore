import { Transform } from 'stream';
import Web3 from 'web3';
import { MongoBound } from '../../../models/base';
import { IWalletAddress, WalletAddressStorage } from '../../../models/walletAddress';
import { IEthTransaction } from '../types';

export class InternalTxRelatedFilterTransform extends Transform {
  private walletAddresses: IWalletAddress[] = [];
  constructor(private web3: Web3, private walletId) {
    super({ objectMode: true });
  }

  async _transform(tx: MongoBound<IEthTransaction>, _, done) {
    if (tx.internal && tx.internal.length > 0) {
      const walletAddresses = await this.getWalletAddresses(tx);
      const walletAddressesArray = walletAddresses.map(walletAddress => walletAddress.address);
      const walletRelatedInternalTxs = tx.internal.filter((internalTx: any) =>
        walletAddressesArray.includes(internalTx.action.to)
      );
      walletRelatedInternalTxs.forEach(internalTx => {
        const _tx = Object.assign({}, tx);
        _tx.value = Number(internalTx.action.value);
        _tx.to = this.web3.utils.toChecksumAddress(internalTx.action.to);
        if (internalTx.action.from) _tx.from = this.web3.utils.toChecksumAddress(internalTx.action.from);
        this.push(_tx);
      });
      if (walletRelatedInternalTxs.length) return done();
    }
    this.push(tx);
    return done();
  }

  async getWalletAddresses(tx) {
    if (!this.walletAddresses.length) {
      this.walletAddresses = await WalletAddressStorage.collection
        .find({ chain: tx.chain, network: tx.network, wallet: this.walletId })
        .toArray();
    }
    return this.walletAddresses;
  }
}
