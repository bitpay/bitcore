import { Transform } from 'stream';
import Web3 from 'web3';
import { MongoBound } from '../../../../models/base';
import { ClassifiedTrace, IEVMTransaction } from '../types';

export class MultisigRelatedFilterTransform extends Transform {
  constructor(private web3: Web3, private multisigContractAddress: string, private tokenAddress: string) {
    super({ objectMode: true });
  }

  async _transform(tx: MongoBound<IEVMTransaction>, _, done) {
    if (tx.calls && tx.calls.length > 0 && !this.tokenAddress) {
      const walletRelatedIncomingInternalTxs = tx.calls.filter(
        (internalTx: ClassifiedTrace) =>
          this.multisigContractAddress === this.web3.utils.toChecksumAddress(internalTx.to)
      );
      const walletRelatedOutgoingInternalTxs = tx.calls.filter(
        (internalTx: ClassifiedTrace) =>
          this.multisigContractAddress === this.web3.utils.toChecksumAddress(internalTx.from)
      );
      walletRelatedIncomingInternalTxs.forEach(internalTx => {
        const _tx = Object.assign({}, tx);
        _tx.value = Number(internalTx.value);
        _tx.to = this.web3.utils.toChecksumAddress(internalTx.to);
        if (internalTx.from) _tx.from = this.web3.utils.toChecksumAddress(internalTx.from);
        this.push(_tx);
      });
      walletRelatedOutgoingInternalTxs.forEach(internalTx => {
        const _tx = Object.assign({}, tx);
        _tx.value = Number(internalTx.value);
        _tx.to = this.web3.utils.toChecksumAddress(internalTx.to);
        if (internalTx.from) _tx.from = this.web3.utils.toChecksumAddress(internalTx.from);
        this.push(_tx);
      });
      if (walletRelatedIncomingInternalTxs.length || walletRelatedOutgoingInternalTxs.length) return done();
    } else if (
      tx.abiType &&
      tx.abiType.type === 'ERC20' &&
      tx.abiType.name === 'transfer' &&
      this.tokenAddress &&
      tx.to.toLowerCase() === this.tokenAddress.toLowerCase()
    ) {
      tx.value = tx.abiType!.params[1].value as any;
      tx.to = this.web3.utils.toChecksumAddress(tx.abiType!.params[0].value);
    } else if (tx.to !== this.multisigContractAddress || (tx.to === this.multisigContractAddress && tx.abiType)) {
      return done();
    }
    this.push(tx);
    return done();
  }
}
