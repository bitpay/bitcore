import { Transform } from 'stream';
import Web3 from 'web3';
import { MongoBound } from '../../../models/base';
import { IEthTransaction } from '../types';

export class Erc20RelatedFilterTransform extends Transform {
  constructor(private web3: Web3, private tokenAddress: string) {
    super({ objectMode: true });
  }

  async _transform(tx: MongoBound<IEthTransaction>, _, done) {
    if (tx.logs && tx.logs.length > 0) {
      const ERC20Log: any = tx.logs.find(
        l =>
          l.type == 'ERC20' &&
          !l.logs.find(
            i =>
              i.name == 'Transfer' &&
              i.address.toLowerCase() == this.tokenAddress.toLowerCase() &&
              i.events[i.events.findIndex(j => j.name == '_from')].value.toLowerCase() == tx.from.toLowerCase()
          )
      );
      if (ERC20Log) {
        const log: any = ERC20Log.logs.find(
          i =>
            i.name == 'Transfer' &&
            i.address.toLowerCase() == this.tokenAddress.toLowerCase() &&
            i.events[i.events.findIndex(j => j.name == '_from')].value.toLowerCase() == tx.from.toLowerCase()
        );
        if (log && log.events) {
          tx.value = log.events.find(j => j.name == '_value').value;
          tx.to = this.web3.utils.toChecksumAddress(log.events.find(j => j.name == '_to').value);
        }
      }
    }
    this.push(tx);
    return done();
  }
}
