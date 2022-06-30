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
    } else if (tx.logs && tx.logs.length > 0) {
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
    } else if (tx.logs && tx.logs.length > 0) {
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
            i.events[i.events.findIndex(j => j.name == '_to')].value.toLowerCase() == tx.to.toLowerCase()
        );
        if (log && log.events) {
          tx.value = log.events.find(j => j.name == '_value').value;
          tx.to = this.web3.utils.toChecksumAddress(log.events.find(j => j.name == '_to').value);
          tx.from = this.web3.utils.toChecksumAddress(log.events.find(j => j.name == '_from').value);
        }
      }
    } else if (tx.to !== this.multisigContractAddress || tx.to === this.multisigContractAddress) {
      return done();
    }
    this.push(tx);
    return done();
  }
}
