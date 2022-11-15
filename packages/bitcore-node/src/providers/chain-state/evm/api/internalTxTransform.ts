import { Transform } from 'stream';
import Web3 from 'web3';
import { MongoBound } from '../../../../models/base';
import { IWalletAddress, WalletAddressStorage } from '../../../../models/walletAddress';
import { IEVMTransaction, IEVMTransactionTransformed } from '../types';

export class InternalTxRelatedFilterTransform extends Transform {
  private walletAddresses: IWalletAddress[] = [];
  constructor(private web3: Web3, private walletId) {
    super({ objectMode: true });
  }

  /**
   * This creates a duplicate transaction object for each relevant
   * internal tx with the `value` field reset to the internal value.
   * @param tx Transaction object
   * @param _ Encoding (discarded)
   * @param done Callback
   * @returns
   */
  async _transform(tx: MongoBound<IEVMTransaction>, _, done) {
    const walletAddresses = await this.getWalletAddresses(tx);
    // TODO: rethink how we handle complex smart contracts. Creating objects w/ dup txid's doesn't seem right.

    let numInternalTxs = 0;
    if (tx.internal && tx.internal.length > 0) {
      numInternalTxs = this.erigonTransform(tx, walletAddresses);
    } else if (tx.calls && tx.calls.length > 0) {
      numInternalTxs = this.gethTransform(tx, walletAddresses);
    }

    // Discard original tx if original value is 0
    if (numInternalTxs > 0 && tx.value === 0) {
      return done();
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
    return this.walletAddresses.map(walletAddress => walletAddress.address.toLowerCase());
  }

  erigonTransform(tx: MongoBound<IEVMTransaction>, walletAddresses: string[]) {
    const walletRelatedInternalTxs = tx.internal.filter((internalTx: any) =>
      walletAddresses.includes(internalTx.action.to)
    );
    for (let internalTx of walletRelatedInternalTxs) {
      // Contract will refund the excess back to the sender
      const isRefund = tx.value && internalTx.action.to === tx.from.toLowerCase();
      const internalValue = Number(internalTx.action.value);
      if (isRefund) {
        tx.value -= internalValue;
      } else {
        const _tx: IEVMTransactionTransformed = Object.assign({}, tx);
        _tx.value = internalValue;
        _tx.to = this.web3.utils.toChecksumAddress(internalTx.action.to);
        if (internalTx.action.from) {
          _tx.initialFrom = tx.from;
          _tx.from = this.web3.utils.toChecksumAddress(internalTx.action.from);
        }
        this.push(_tx);
      }
    }
    return walletRelatedInternalTxs.length;
  }

  gethTransform(tx: MongoBound<IEVMTransaction>, walletAddresses: string[]) {
    const walletRelatedInternalTxs = tx.calls.filter((call: any) => walletAddresses.includes(call.to));
    for (let call of walletRelatedInternalTxs) {
      // Contract will refund the excess back to the sender
      const isRefund = tx.value && call.to === tx.from.toLowerCase();
      const internalValue = Number(call.value);
      if (isRefund) {
        tx.value -= internalValue;
      } else {
        const _tx: IEVMTransactionTransformed = JSON.parse(JSON.stringify(tx));
        _tx.value = internalValue;
        _tx.to = this.web3.utils.toChecksumAddress(call.to);
        if (call.from) {
          _tx.initialFrom = tx.from;
          _tx.from = this.web3.utils.toChecksumAddress(call.from);
        }
        this.push(_tx);
      }
    }
    return walletRelatedInternalTxs.length;
  }
}
