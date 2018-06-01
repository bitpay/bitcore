import { IBlock } from '../../../models/block';
import { ITransaction } from '../../../models/transaction';
import { Adapter } from '../../../types/namespaces/ChainAdapter';
import { Bitcoin } from "../../../types/namespaces/Bitcoin";

type BitcoinConvertBlockParams = Adapter.ConvertBlockParams<Bitcoin.Block>;
type BitcoinConvertTxParams = Adapter.ConvertTxParams<
  Bitcoin.Transaction,
  Bitcoin.Block
>;

export class BTCAdapter
  implements Adapter.IChainAdapter<Bitcoin.Block, Bitcoin.Transaction> {
  convertBlock(params: BitcoinConvertBlockParams): IBlock {
    const { chain, network, height, block } = params;
    let header = block.header.toObject();
    const converted: IBlock = {
      chain,
      network,
      height,
      hash: block.hash,
      previousBlockHash: header.prevHash,
      merkleRoot: header.merkleRoot,
      version: Number(header.version),
      bits: Number(header.bits),
      nonce: Number(header.nonce),
      time: new Date(header.time * 1000),
      timeNormalized: new Date(header.time * 1000),
      transactionCount: block.transactions.length,
      size: block.toBuffer().length,
      reward: block.transactions[0].outputAmount,
      nextBlockHash: '',
      processed: false
    };
    return converted;
  }

  convertTx(params: BitcoinConvertTxParams) {
    const convertedBlock = this.convertBlock(params);
    const { chain, network, tx } = params;
    const { time, height, hash, timeNormalized } = convertedBlock;
    const converted: ITransaction = {
      chain,
      network,
      txid: tx.hash,
      coinbase: tx.isCoinbase(),
      fee: 0,
      size: tx.toBuffer().length,
      locktime: tx.nLockTime,
      wallets: [],
      blockHash: hash,
      blockTime: time,
      blockHeight: height,
      blockTimeNormalized: timeNormalized
    };
    return converted;
  }
}
