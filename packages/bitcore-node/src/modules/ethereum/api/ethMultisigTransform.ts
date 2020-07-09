import { Transform } from 'stream';
import Web3 from 'web3';
import { MongoBound } from '../../../models/base';
import { IEthTransaction } from '../types';

export class EthMultisigRelatedFilterTransform extends Transform {
  constructor(private web3: Web3, private multisigContractAddress: string) {
    super({ objectMode: true });
  }

  async _transform(tx: MongoBound<IEthTransaction>, _, done) {
    if (tx.internal && tx.internal.length > 0) {
      const walletRelatedIncomingInternalTxs = tx.internal.filter(
        (internalTx: any) => this.multisigContractAddress === this.web3.utils.toChecksumAddress(internalTx.action.to)
      );
      const walletRelatedOutgoingInternalTxs = tx.internal.filter(
        (internalTx: any) => this.multisigContractAddress === this.web3.utils.toChecksumAddress(internalTx.action.from)
      );
      walletRelatedIncomingInternalTxs.forEach(internalTx => {
        const _tx = Object.assign({}, tx);
        _tx.value = Number(internalTx.action.value);
        _tx.to = this.web3.utils.toChecksumAddress(internalTx.action.to);
        if (internalTx.action.from) _tx.from = this.web3.utils.toChecksumAddress(internalTx.action.from);
        this.push(_tx);
      });
      walletRelatedOutgoingInternalTxs.forEach(internalTx => {
        const _tx = Object.assign({}, tx);
        _tx.value = Number(internalTx.action.value);
        _tx.to = this.web3.utils.toChecksumAddress(internalTx.action.to);
        if (internalTx.action.from) _tx.from = this.web3.utils.toChecksumAddress(internalTx.action.from);
        this.push(_tx);
      });
      if (walletRelatedIncomingInternalTxs.length || walletRelatedOutgoingInternalTxs.length) return done();
    } else if (tx.to !== this.multisigContractAddress || (tx.to === this.multisigContractAddress && tx.abiType)) {
      return done();
    }
    this.push(tx);
    return done();
  }
}
