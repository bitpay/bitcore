import { Bitcoin } from "../../../types/namespaces/Bitcoin";
import {
  IChainAdapter,
  CoreBlock,
  ChainInfo,
  CoreTransaction,
} from '../../../types/namespaces/ChainAdapter';
const Chain = require("../../../chain");

export class BTCAdapter implements IChainAdapter<Bitcoin.Block, Bitcoin.Transaction> {
  convertBlock(info: ChainInfo, block: Bitcoin.Block): CoreBlock {
    const header = block.header.toObject();
    return {
      chain: info.chain,
      network: info.network,
      parent: info.parent? {
        chain: info.parent.chain,
        height: info.parent.height,
      } : undefined,
      header,
      size: block.toBuffer().length,
      reward: block.transactions[0].outputAmount,
      transactions: block.transactions.map(tx => this.convertTx(info, tx)),
    };
  }

  convertTx(info: ChainInfo, transaction: Bitcoin.Transaction): CoreTransaction {
    return Object.assign(info, {
      hash: transaction.hash,
      size: transaction.toBuffer().length,
      coinbase: transaction.isCoinbase(),
      nLockTime: transaction.nLockTime,
      inputs: transaction.inputs.map(input => input.toObject()),
      outputs: transaction.outputs.map(out => {
        // TODO: is there always an address?
        let address = out.script.toAddress(info.network).toString();
        if (address === "false" &&
            out.script.classify() === "Pay to public key"
        ) {
          const hash = Chain[info.chain].lib.crypto.Hash.sha256ripemd160(
            out.script.chunks[0].buf);
          address = Chain[info.chain].lib.Address(hash, info.network).toString();
        }

        return {
          address,
          value: out.satoshis,
          script: out.script.toBuffer(),
        };
      }),
    });
  }
}
