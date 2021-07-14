import { Transform } from 'stream';
import Web3 from 'web3';
import { MongoBound } from '../../../models/base';
import { IEthTransaction } from '../types';

export class EthMultisigRelatedFilterTransform extends Transform {
  constructor(private web3: Web3, private multisigContractAddress: string, private tokenAddress: string) {
    super({ objectMode: true });
  }

  async _transform(tx: MongoBound<IEthTransaction>, _, done) {
    if (tx.internal && tx.internal.length > 0 && !this.tokenAddress) {
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
    } else if (
      tx.abiType &&
      tx.abiType.type === 'ERC20' &&
      tx.abiType.name === 'transfer' &&
      this.tokenAddress &&
      tx.to.toLowerCase() === this.tokenAddress.toLowerCase()
    ) {
      tx.value = tx.abiType!.params[1].value as any;
      tx.to = this.web3.utils.toChecksumAddress(tx.abiType!.params[0].value);
    } else if (
      tx.internal &&
      tx.internal.length > 0 &&
      tx.internal[0].abiType &&
      tx.internal[0].abiType.type === 'ERC20' &&
      tx.internal[0].abiType.name === 'transfer' &&
      tx.internal[0].action.to &&
      tx.internal[0].action.from &&
      tx.internal[0].action.to.toLowerCase() === this.tokenAddress.toLowerCase()
    ) {
      tx.value = tx.internal[0].abiType!.params[1].value as any;
      tx.to = this.web3.utils.toChecksumAddress(tx.internal[0].abiType!.params[0].value);
      tx.from = this.web3.utils.toChecksumAddress(tx.internal[0].action.from);
    } else if (tx.to !== this.multisigContractAddress || (tx.to === this.multisigContractAddress && tx.abiType)) {
      return done();
    }
    this.push(tx);
    return done();
  }
}
