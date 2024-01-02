import { Transform } from 'stream';
import Web3 from 'web3';
import { MongoBound } from '../../../../models/base';
import { IEVMTransactionInProcess, IEVMTransactionTransformed } from '../types';

export class Erc20RelatedFilterTransform extends Transform {
  constructor(private tokenAddress: string) {
    super({ objectMode: true });
  }

  async _transform(tx: MongoBound<IEVMTransactionInProcess>, _, done) {
    this.tokenAddress = Web3.utils.toChecksumAddress(this.tokenAddress)
    if (tx.effects && tx.effects.length) {
      // Get all effects where contractAddress is tokenAddress
      const tokenRelatedInternalTxs = tx.effects.filter(
        (effect: any) => effect.contractAddress === this.tokenAddress
        );

      // Create a tx object for each erc20 transfer
      for (let internalTx of tokenRelatedInternalTxs) {
        const _tx: IEVMTransactionTransformed = Object.assign({}, tx);
        _tx.value = Number(internalTx.amount);
        _tx.to = internalTx.to;
        _tx.from = internalTx.from;
        if (internalTx.from != tx.from) {
          _tx.initialFrom = tx.from
        }
        // This is how a requester can verify uniqueness in light of duplicated txids
        _tx.callStack = internalTx.callStack;
        this.push(_tx);
      }
    } 
    return done(); 
  }
}
