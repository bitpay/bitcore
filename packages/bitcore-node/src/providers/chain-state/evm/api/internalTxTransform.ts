import { Transform } from 'stream';
import Web3 from 'web3';
import { MongoBound } from '../../../../models/base';
import { IWalletAddress, WalletAddressStorage } from '../../../../models/walletAddress';
import { Effect, IEVMTransactionInProcess, IEVMTransactionTransformed } from '../types';

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
  async _transform(tx: MongoBound<IEVMTransactionInProcess>, _, done) {
    const walletAddresses = await this.getWalletAddresses(tx);
    // TODO: rethink how we handle complex smart contracts. Creating objects w/ dup txid's doesn't seem right.
    let internalTxsToProcess: Effect[] = [];
    if (tx.effects && tx.effects.length) {
      const walletRelatedInternalTxs = tx.effects.filter((internalTx: any) =>
        walletAddresses.includes(internalTx.to) && !internalTx.contractAddress
      );
      
      const refundTxs = walletRelatedInternalTxs.filter(i => i.to === tx.from);
      const nonRefundTxs = walletRelatedInternalTxs.filter(i => i.to != tx.from);
      const refundTotal = refundTxs.reduce((a,b) => a + Number(b.amount), 0);
      // Only consider it a refund if the amount refunded is less than or equal to tx value
      const hasRefund = refundTotal <= tx.value;
      
      if (hasRefund) {
        // Subtract refund from tx.value
        tx.value -= refundTotal;
        // Handle any remaining internal txs
        internalTxsToProcess = nonRefundTxs;
      } else {
        // Treat all txs normal
        internalTxsToProcess = refundTxs.concat(nonRefundTxs);
      }

      for (let internalTx of internalTxsToProcess) {
          const _tx: IEVMTransactionTransformed = Object.assign({}, tx);
          _tx.value = Number(internalTx.amount);
          _tx.to = internalTx.to;
          if (internalTx.from != tx.from) {
            _tx.initialFrom = tx.from;
            _tx.from = internalTx.from;
            
          }
          // This is how a requester can verify uniqueness in light of duplicated txids
          _tx.callStack = internalTx.callStack;
          this.push(_tx);
      }
    }

    // Discard original tx if original value is 0 - perhaps after refunds
    if (internalTxsToProcess.length > 0 && tx.value === 0) {
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
    return this.walletAddresses.map(walletAddress => this.web3.utils.toChecksumAddress(walletAddress.address));
  }
}
