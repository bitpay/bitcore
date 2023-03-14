import { Transform } from 'stream';
import Web3 from 'web3';
import { MongoBound } from '../../../../models/base';
import { IEVMTransaction, IEVMTransactionTransformed } from '../types';

export class InternalTxRelatedFilterTransform extends Transform {
  constructor(private web3: Web3, private walletAddresses: string[]) {
    super({ objectMode: true });
  }

  /**
   * Subtracts any internal value that is being sent back to the
   * original sending address from the original value sent.
   * @param tx Transaction object
   * @param _ Encoding (discarded)
   * @param done Callback
   * @returns
   */
  async _transform(tx: MongoBound<IEVMTransaction>, _, done) {
    let numInternalTxs = 0;
    // Check internal txs for any that refund the sender
    if (tx.internal && tx.internal.length > 0) {
      numInternalTxs = this.erigonRefundTransform(tx);
    } else if (tx.calls && tx.calls.length > 0) {
      numInternalTxs = this.gethRefundTransform(tx);
    }

    // Discard original tx if original value is 0
    if (numInternalTxs > 0 && tx.value === 0) {
      return done();
    }

    this.push(tx);
    return done();
  }

  erigonRefundTransform(tx: MongoBound<IEVMTransaction>) {
    // Filter to internal txs that are sending back to the original sender
    const walletRelatedInternalTxs = tx.internal.filter((internalTx: any) =>
      this.walletAddresses.includes(this.web3.utils.toChecksumAddress(internalTx.action.to))
    );
    for (let internalTx of walletRelatedInternalTxs) {
      // Contract will refund the excess back to the sender
      const isRefund = tx.value && internalTx.action.to === tx.from.toLowerCase();
      const internalValue = Number(internalTx.action.value);
      if (isRefund) {
        tx.value -= internalValue;
      } else {
        // TODO: rethink how we handle complex smart contracts. Creating objects w/ dup txid's doesn't seem right.
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

  gethRefundTransform(tx: MongoBound<IEVMTransaction>) {
    // Filter to internal txs that are sending back to the original sender
    const walletRelatedInternalTxs = tx.calls.filter((call: any) => this.walletAddresses.includes(this.web3.utils.toChecksumAddress(call.to)));
    for (let call of walletRelatedInternalTxs) {
      // Contract will refund the excess back to the sender
      const isRefund = tx.value && call.to === tx.from.toLowerCase();
      const internalValue = Number(call.value);
      if (isRefund) {
        tx.value -= internalValue;
      } else {
        // TODO: rethink how we handle complex smart contracts. Creating objects w/ dup txid's doesn't seem right.
        const _tx: IEVMTransactionTransformed = Object.assign({}, tx);
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
