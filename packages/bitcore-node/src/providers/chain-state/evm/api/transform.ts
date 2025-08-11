import { MongoBound } from '../../../../models/base';
import { Config } from '../../../../services/config';
import { IEVMNetworkConfig } from '../../../../types/Config';
import { jsonStringify, overlaps } from '../../../../utils';
import { TransformWithEventPipe } from '../../../../utils/streamWithEventPipe';
import { IEVMTransactionTransformed } from '../types';

export class EVMListTransactionsStream extends TransformWithEventPipe {
  constructor(private walletAddresses: Array<string>, private tokenAddress?: string) {
    super({ objectMode: true });
  }
  async _transform(transaction: MongoBound<IEVMTransactionTransformed>, _, done) {
    const baseTx = {
      id: transaction._id,
      txid: transaction.txid,
      fee: transaction.fee,
      height: transaction.blockHeight,
      from: transaction.from,
      initialFrom: transaction.initialFrom || transaction.from,
      gasPrice: transaction.gasPrice,
      gasLimit: transaction.gasLimit,
      receipt: transaction.receipt,
      address: transaction.to,
      blockTime: transaction.blockTimeNormalized,
      error: transaction.error,
      network: transaction.network,
      chain: transaction.chain,
      nonce: transaction.nonce,
      effects: transaction.effects,
      callStack: transaction.callStack
    } as any;

    // Add old properties if leanTxStorage is not enabled
    const config = Config.chainConfig({ chain: transaction.chain, network: transaction.network }) as IEVMNetworkConfig;
    if (!config || !config.leanTransactionStorage) {
      baseTx.abiType = transaction.abiType;
      baseTx.internal = transaction.internal;
      baseTx.calls = transaction.calls;
      baseTx.data = transaction.data ? transaction.data.toString() : '';
    }
    let sending = this.walletAddresses.includes(transaction.from);
    if (sending) {
      let sendingToOurself = this.walletAddresses.includes(transaction.to);
      if (!sendingToOurself) {
        baseTx.category = 'send';
        baseTx.satoshis = -transaction.value
        this.push(
          jsonStringify(baseTx) + '\n'
        );
      } else {
        baseTx.category = 'move';
        baseTx.satoshis = transaction.value;
        this.push(
          jsonStringify(baseTx) + '\n'
        );
      }
    } else {
      baseTx.category = 'receive'; // assume it's a receive, but may not be sent
      const weReceived = this.walletAddresses.includes(transaction.to);
      const weReceivedInternal = overlaps(this.walletAddresses, transaction.effects?.map(e => e.to));
      if (weReceivedInternal) {
        baseTx.satoshis = 0n;
        for (const effect of transaction.effects!) {
          if (this.walletAddresses.includes(effect.to) && (effect.contractAddress == this.tokenAddress)) {
            baseTx.satoshis += BigInt(effect.amount || 0);
          }
        }
        this.push(
          jsonStringify(baseTx) + '\n'
        );
      } else if (weReceived) {
        // console.log(weReceived, weReceivedInternal, transaction.to, this.walletAddresses, transaction);
        baseTx.satoshis = BigInt(transaction.value || 0);
        this.push(
          jsonStringify(baseTx) + '\n'
        );
      }
    }
    return done();
  }
}
