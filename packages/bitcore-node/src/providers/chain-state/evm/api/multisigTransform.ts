import { Transform } from 'stream';
import { MongoBound } from '../../../../models/base';
import { IEVMTransactionInProcess } from '../types';

export class MultisigRelatedFilterTransform extends Transform {
  constructor(private multisigContractAddress: string, private tokenAddress?: string) {
    super({ objectMode: true });
  }

  async _transform(tx: MongoBound<IEVMTransactionInProcess>, _, done) {
    const multisigContractAddressLower = this.multisigContractAddress.toLowerCase();
    const tokenAddressLower = this.tokenAddress?.toLowerCase();
    let hasEffects = false;
    if (tx.effects && tx.effects.length) {
      // All internal to and from multisig - if tokenAddress is undefined then it only gets native transfers
      const walletRelatedInternalTxs = tx.effects.filter(
        (internalTx: any) => {
          const relatedToMultisig = [internalTx.to, internalTx.from].some(address => (
            address?.toLowerCase() === multisigContractAddressLower
          ));
          if (tokenAddressLower) {
            return relatedToMultisig && internalTx.contractAddress && internalTx.contractAddress.toLowerCase() === tokenAddressLower;
          } else {
            // contractAddress is undefined on native asset transfers
            return relatedToMultisig && !internalTx.contractAddress;
          }
        }
      );

      // Create a tx object for each internal transfer
      for (const internalTx of walletRelatedInternalTxs) {
        const _tx = Object.assign({}, tx);
        _tx.value = Number(internalTx.amount);
        _tx.to = internalTx.to;
        _tx.from = internalTx.from;
        _tx.effects = [internalTx];
        this.push(_tx);
      }
      // If we didn't find any internal transfers, original tx may be inconsequential
      hasEffects = !!walletRelatedInternalTxs.length;
    } 

    if (hasEffects && tokenAddressLower) {
      return done();
    }
    
    if (!hasEffects && tx.to?.toLowerCase() !== multisigContractAddressLower) {
      // If no effects and tx isn't to multisig, we don't care about original tx, return done()
      return done();
    }

    this.push(tx);
    return done();
  }
}
