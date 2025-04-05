import { Transform } from 'stream';
import { MongoBound } from '../../../../models/base';
import { IEVMTransactionInProcess } from '../types';

export class MultisigRelatedFilterTransform extends Transform {
  constructor(private multisigContractAddress: string, private tokenAddress: string) {
    super({ objectMode: true });
  }

  async _transform(tx: MongoBound<IEVMTransactionInProcess>, _, done) {
    let hasEffects = false;
    if (tx.effects && tx.effects.length) {
      // All internal to and from multisig - if tokenAddress is undefined then it only gets native transfers
      const walletRelatedInternalTxs = tx.effects.filter(
        (internalTx: any) => {
          if (this.tokenAddress) {
            return [internalTx.to, internalTx.from].includes(this.multisigContractAddress) && internalTx.contractAddress && internalTx.contractAddress.toLowerCase() == this.tokenAddress.toLowerCase();
          } else {
            // contractAddress is undefined on native asset transfers
            return [internalTx.to, internalTx.from].includes(this.multisigContractAddress) && !internalTx.contractAddress;
          }
        }
      );

      // Create a tx object for each internal transfer
      for (let internalTx of walletRelatedInternalTxs) {
        const _tx = Object.assign({}, tx);
        _tx.value = Number(internalTx.amount);
        _tx.to = internalTx.to;
        _tx.from = internalTx.from;
        this.push(_tx);
      }
      // If we didn't find any internal transfers, original tx may be inconsequential
      hasEffects = !!walletRelatedInternalTxs.length;
    } 
    
    if (!hasEffects && tx.to !== this.multisigContractAddress) {
      // If no effects and tx isn't to multisig, we don't care about original tx, return done()
      return done();
    }

    this.push(tx);
    return done();
  }
}
