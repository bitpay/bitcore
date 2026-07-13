import { MongoBound } from '../../../../models/base';
import { Config } from '../../../../services/config';
import { IEVMNetworkConfig } from '../../../../types/Config';
import { jsonStringify } from '../../../../utils';
import { TransformWithEventPipe } from '../../../../utils/streamWithEventPipe';
import { IEVMTransactionTransformed } from '../types';

const isFailedReceipt = (receipt?: { status?: boolean | number | string | bigint }) => {
  const status = receipt?.status;
  return status === false || status === 0 || status === 0n || status === '0' || status === '0x0';
};

export class EVMListTransactionsStream extends TransformWithEventPipe {
  private walletAddressSet: Set<string>;

  constructor(walletAddresses: Array<string>, private tokenAddress?: string) {
    super({ objectMode: true });
    this.walletAddressSet = new Set(walletAddresses.map(address => address.toLowerCase()));
  }

  private isWalletAddress(address?: string) {
    return !!address && this.walletAddressSet.has(address.toLowerCase());
  }

  async _transform(transaction: MongoBound<IEVMTransactionTransformed>, _, done) {
    const tokenAddressLower = this.tokenAddress?.toLowerCase();
    if (tokenAddressLower && isFailedReceipt(transaction.receipt)) {
      return done();
    }

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
    const sending = this.isWalletAddress(transaction.from);
    if (sending) {
      const sendingToOurself = this.isWalletAddress(transaction.to);
      if (!sendingToOurself) {
        baseTx.category = 'send';
        baseTx.satoshis = -transaction.value;
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
      const weReceived = this.isWalletAddress(transaction.to);
      const weReceivedInternal = transaction.effects?.some(e => this.isWalletAddress(e.to));
      if (weReceivedInternal) {
        baseTx.satoshis = 0n;
        for (const effect of transaction.effects!) {
          if (this.isWalletAddress(effect.to) && (effect.contractAddress?.toLowerCase() == tokenAddressLower)) {
            baseTx.satoshis += BigInt(effect.amount || 0);
          }
        }
        this.push(
          jsonStringify(baseTx) + '\n'
        );
      } else if (weReceived) {
        baseTx.satoshis = BigInt(transaction.value || 0);
        this.push(
          jsonStringify(baseTx) + '\n'
        );
      }
    }
    return done();
  }
}
