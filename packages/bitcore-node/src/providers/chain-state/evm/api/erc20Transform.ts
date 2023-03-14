import { Transform } from 'stream';
import Web3 from 'web3';
import { MongoBound } from '../../../../models/base';
import { IAbiDecodedData, IEVMTransaction } from '../types';

export class Erc20RelatedFilterTransform extends Transform {
  constructor(private web3: Web3, private walletAddresses: string[]) {
    super({ objectMode: true });
  }

  async _transform(tx: MongoBound<IEVMTransaction>, _, done) {
    tx.transfers = [];
    // Check if tx has the abi for an ERC20 transfer or transferFrom
    if (
      tx.abiType &&
      tx.abiType.type === 'ERC20' &&
      (tx.abiType.name === 'transfer' || tx.abiType.name === 'transferFrom')
    ) {
      
      tx.transfers.push({
        to: this.getERC20AbiPropertyValue(tx.abiType, tx.from, 'to'),
        from: this.getERC20AbiPropertyValue(tx.abiType, tx.from, 'from'),
        value: this.getERC20AbiPropertyValue(tx.abiType, tx.from, 'value') as any,
        tokenContract: tx.to
      });
    } 
    
    // Then check if any internal Txs have ERC20 transfer or transferFrom
    if (tx.internal && tx.internal.length > 0) {
      this.erigonInternalTransform(tx);
    } else if (tx.calls && tx.calls.length > 0) {
      this.gethInternalTransform(tx);
    } 

    this.push(tx);
    return done();
  }

  erigonInternalTransform(tx: MongoBound<IEVMTransaction>) {
    try {
      for (const internalTx of tx.internal) {
        if (
          internalTx.abiType &&
          internalTx.abiType.type == 'ERC20' &&
          (internalTx.abiType.name === 'transfer' || internalTx.abiType.name === 'transferFrom')
        ) {
            // If we have walletAddresses then skip any internal tx that doesn't pertain to them
            if (
              this.walletAddresses &&
              this.walletAddresses.length > 0 &&
              !(this.walletAddresses.includes(internalTx.action.to) ||
                this.walletAddresses.includes(internalTx.action.from!))
            ) {
              continue;
            }

            tx.transfers = tx.transfers || [];
            tx.transfers.push({
              to: this.getERC20AbiPropertyValue(internalTx.abiType, internalTx.action.from as string, 'to'),
              from: this.getERC20AbiPropertyValue(internalTx.abiType, internalTx.action.from as string, 'from'),
              value: this.getERC20AbiPropertyValue(internalTx.abiType, internalTx.action.from as string, 'value') as any,
              tokenContract: tx.to
            });
          }
      }
    } catch (err) {
      console.error(err);
    }
  }

  gethInternalTransform(tx: MongoBound<IEVMTransaction>) {
    try {
      for (const call of tx.calls) {
        if (call.abiType && call.abiType.type === 'ERC20' && (call.abiType.name === 'transfer' || call.abiType.name === 'transferFrom')) {
          // If we have walletAddresses then skip any internal tx that doesn't pertain to them
          if (
            this.walletAddresses &&
            this.walletAddresses.length > 0 &&
            !(this.walletAddresses.includes(call.to) ||
              this.walletAddresses.includes(call.from!))
          ) {
            continue;
          }

          tx.transfers = tx.transfers || [];
          tx.transfers.push({
            to: this.getERC20AbiPropertyValue(call.abiType, call.from, 'to'),
            from: this.getERC20AbiPropertyValue(call.abiType, call.from, 'from'),
            value: this.getERC20AbiPropertyValue(call.abiType, call.from, 'value') as any,
            tokenContract: tx.to
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  }
  
  getERC20AbiPropertyValue(abi: IAbiDecodedData, from: string , property: string): string {
    // Transfer method unlike tranferFrom doesn't have from address in params
    if (abi.name === 'transfer' && property === 'from') {
      return this.web3.utils.toChecksumAddress(from);
    }

    // If to or from, parse as checksum address
    if (property === 'to' || property === 'from') {
      return this.web3.utils.toChecksumAddress(abi.params.find(p => p.name === '_' + property)?.value || '');
    }

    // Otherwise must be value
    return abi.params.find(p => p.name === '_' + property)?.value as string;
  }
}
