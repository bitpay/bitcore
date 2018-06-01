import { Bitcoin } from "../../../types/namespaces/Bitcoin";
import {
  IChainAdapter,
  CoreBlock,
  ChainInfo,
  CoreTransaction,
} from '../../../types/namespaces/ChainAdapter';

export class BTCAdapter implements IChainAdapter<Bitcoin.Block, Bitcoin.Transaction> {
  convertBlock(info: ChainInfo, block: Bitcoin.Block): CoreBlock {
    const header = block.header.toObject();
    return Object.assign(info, {
      header,
      size: block.toBuffer().length,
      reward: block.transactions[0].outputAmount,
      transactions: block.transactions.map(tx => this.convertTx(info, tx)),
    });
  }

  convertTx(info: ChainInfo, transaction: Bitcoin.Transaction): CoreTransaction {
    return Object.assign(info, {
      hash: transaction.hash,
      coinbase: transaction.isCoinbase(),
      nLockTime: transaction.nLockTime,
      inputs: transaction.inputs.map(input => input.toObject()),
      outputs: transaction.outputs.map(out => {
        return {
          satoshis: out.satoshis,
          script: out.script.toBuffer(),
        };
      }),
    });
  }
}
