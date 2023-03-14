import { Transform } from 'stream';
import { MongoBound } from '../../../../models/base';
import { IEVMTransactionTransformed } from '../types';

export class EVMListTransactionsStream extends Transform {
  constructor(private walletAddresses: Array<string>) {
    super({ objectMode: true });
  }
  async _transform(transaction: MongoBound<IEVMTransactionTransformed>, _, done) {
    const dataStr = transaction.data ? transaction.data.toString() : '';
    // Set sending, receiving or moving on ERC20 transfers
    if (transaction.transfers && transaction.transfers.length > 0) {
      for (const transfer of transaction.transfers) {
        const send = this.walletAddresses.includes(transfer.from);
        const receive = this.walletAddresses.includes(transfer.to);
        
        if (send && !receive) { // Send
          transfer.value = -transfer.value;
          transfer.category = 'send';
        } else if (send && receive) { // Move
          transfer.category = 'move';
        }  else if (!send && receive) { // Receive
          transfer.category = 'receive';
        }
      }
      
    }
    
    // Format according to whether tx was sent, received or moved
    const weSent = this.walletAddresses.includes(transaction.from);
    const weReceived = this.walletAddresses.includes(transaction.to);
    if (weSent) {
      if (!weReceived) { // Send
        this.push(
          JSON.stringify({
            id: transaction._id,
            txid: transaction.txid,
            fee: transaction.fee,
            category: 'send',
            satoshis: -transaction.value,
            height: transaction.blockHeight,
            from: transaction.from,
            initialFrom: transaction.initialFrom || transaction.from,
            gasPrice: transaction.gasPrice,
            gasLimit: transaction.gasLimit,
            receipt: transaction.receipt,
            address: transaction.to,
            blockTime: transaction.blockTimeNormalized,
            abiType: transaction.abiType,
            error: transaction.error,
            internal: transaction.internal,
            calls: transaction.calls,
            transfers: transaction.transfers || [],
            network: transaction.network,
            chain: transaction.chain,
            data: dataStr,
            nonce: transaction.nonce
          }) + '\n'
        );
      } else { // Move
        this.push(
          JSON.stringify({
            id: transaction._id,
            txid: transaction.txid,
            fee: transaction.fee,
            category: 'move',
            satoshis: transaction.value,
            height: transaction.blockHeight,
            from: transaction.from,
            initialFrom: transaction.initialFrom || transaction.from,
            gasPrice: transaction.gasPrice,
            gasLimit: transaction.gasLimit,
            receipt: transaction.receipt,
            address: transaction.to,
            blockTime: transaction.blockTimeNormalized,
            abiType: transaction.abiType,
            error: transaction.error,
            internal: transaction.internal,
            calls: transaction.calls,
            transfers: transaction.transfers || [],
            network: transaction.network,
            chain: transaction.chain,
            data: dataStr,
            nonce: transaction.nonce
          }) + '\n'
        );
      }
    } else {
      if (weReceived) { // Receive
        this.push(
          JSON.stringify({
            id: transaction._id,
            txid: transaction.txid,
            fee: transaction.fee,
            category: 'receive',
            satoshis: transaction.value,
            height: transaction.blockHeight,
            from: transaction.from,
            initialFrom: transaction.initialFrom || transaction.from,
            gasPrice: transaction.gasPrice,
            gasLimit: transaction.gasLimit,
            receipt: transaction.receipt,
            address: transaction.to,
            blockTime: transaction.blockTimeNormalized,
            abiType: transaction.abiType,
            error: transaction.error,
            internal: transaction.internal,
            calls: transaction.calls,
            transfers: transaction.transfers || [],
            network: transaction.network,
            chain: transaction.chain,
            data: dataStr,
            nonce: transaction.nonce
          }) + '\n'
        );
      } else { // We neither sent nor recieved this tx, probably ERC20 transfer to our address from unknown address
        this.push(
          JSON.stringify({
            id: transaction._id,
            txid: transaction.txid,
            fee: transaction.fee,
            category: 'unknown',
            satoshis: transaction.value,
            height: transaction.blockHeight,
            from: transaction.from,
            initialFrom: transaction.initialFrom || transaction.from,
            gasPrice: transaction.gasPrice,
            gasLimit: transaction.gasLimit,
            receipt: transaction.receipt,
            address: transaction.to,
            blockTime: transaction.blockTimeNormalized,
            abiType: transaction.abiType,
            error: transaction.error,
            internal: transaction.internal,
            calls: transaction.calls,
            transfers: transaction.transfers || [],
            network: transaction.network,
            chain: transaction.chain,
            data: dataStr,
            nonce: transaction.nonce
          }) + '\n'
        );
      }
    }
    return done();
  }
}
