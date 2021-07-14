import { Transform } from 'stream';
import Web3 from 'web3';
import { MongoBound } from '../../../models/base';
import { IEthTransaction } from '../types';

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
    } else {
      return done();
    }
    this.push(tx);
    return done();
  }
}
