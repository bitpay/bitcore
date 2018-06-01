import { IBlock } from '../../../models/block';
import { ITransaction } from '../../../models/transaction';
import { IChainAdapter } from '../../../types/namespaces/ChainAdapter';
import { Bitcoin } from "../../../types/namespaces/Bitcoin";
import { ChainNetwork } from '../../../types/ChainNetwork';

export class BTCAdapter implements IChainAdapter<Bitcoin.Block, Bitcoin.Transaction> {
  convertBlock(chainnet: ChainNetwork, block: Bitcoin.Block): IBlock {
    let header = block.header.toObject();
    const converted: IBlock = {
      chain: chainnet.chain,
      network: chainnet.network,
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

  convertTx(chainnet: ChainNetwork, transaction: Bitcoin.Transaction, block?: Bitcoin.Block) {
    let convertedBlock;
    if (block) {
      convertedBlock = this.convertBlock(block);
    }
    const converted: ITransaction = {
      chain: chainnet.chain,
      network: chainnet.network,
      txid: transaction.hash,
      coinbase: transaction.isCoinbase(),
      fee: 0,
      size: transaction.toBuffer().length,
      locktime: transaction.nLockTime,
      wallets: [],
      blockHash: convertedBlock? convertedBlock.hash : undefined,
      blockTime: convertedBlock? convertedBlock.blockTime : Date.now(),
      blockHeight: convertedBlock? convertedBlock.height : -1,
      blockTimeNormalized: convertedBlock? convertedBlock.blockTimeNormalized : Date.now(),
    };
    return converted;
  }
}
