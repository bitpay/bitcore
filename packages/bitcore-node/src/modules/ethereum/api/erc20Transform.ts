import { Transform } from 'stream';
import Web3 from 'web3';
import { MongoBound } from '../../../models/base';
import { IEthTransaction, IEthTransactionTransformed } from '../types';

export class Erc20RelatedFilterTransform extends Transform {
  constructor(private web3: Web3, private tokenAddress: string) {
    super({ objectMode: true });
  }

  async _transform(tx: MongoBound<IEthTransaction>, _, done) {
    if (
      tx.abiType &&
      tx.abiType.type === 'ERC20' &&
      tx.abiType.name === 'transfer' &&
      tx.to.toLowerCase() === this.tokenAddress.toLowerCase()
    ) {
      tx.value = tx.abiType!.params[1].value as any;
      tx.to = this.web3.utils.toChecksumAddress(tx.abiType!.params[0].value);
    } else if (
      tx.abiType &&
      tx.abiType.type === 'INVOICE' &&
      tx.abiType.name === 'pay' &&
      tx.abiType.params[8].value.toLowerCase() === this.tokenAddress.toLowerCase()
    ) {
      tx.value = tx.abiType!.params[0].value as any;
    } else if (tx.internal && tx.internal.length > 0) {
      try {
        const tokenRelatedIncomingInternalTxs = tx.internal.filter(
          (internalTx: any) =>
            internalTx.action.to && this.tokenAddress.toLowerCase() === internalTx.action.to.toLowerCase()
        );
        for (const internalTx of tokenRelatedIncomingInternalTxs) {
          if (
            internalTx.abiType &&
            (internalTx.abiType.name === 'transfer' || internalTx.abiType.name === 'transferFrom')
          ) {
            const _tx: IEthTransactionTransformed = Object.assign({}, tx);
            for (const element of internalTx.abiType.params) {
              if (element.name === '_value') _tx.value = element.value as any;
              if (element.name === '_to') _tx.to = this.web3.utils.toChecksumAddress(element.value);
              if (element.name === '_from') {
                _tx.initialFrom = tx.from;
                _tx.from = this.web3.utils.toChecksumAddress(element.value);
              } else if (internalTx.action.from && internalTx.abiType && internalTx.abiType.name == 'transfer') {
                _tx.initialFrom = tx.from;
                _tx.from = this.web3.utils.toChecksumAddress(internalTx.action.from);
              }
            }
            this.push(_tx);
          }
        }
        return done();
      } catch (err) {
        console.error(err);
        return done();
      }
    } else {
      return done();
    }
    this.push(tx);
    return done();
  }
}
