import logger from '../../../logger';
import { ITransaction } from '../../../models/baseTransaction';
import { ErrorType, IVerificationPeer } from '../../../services/verification';
import { EthBlockStorage } from '../models/block';
import { EthP2pWorker } from './p2p';

export class EthVerificationPeer extends EthP2pWorker implements IVerificationPeer {
  prevBlockNum = 0;
  prevHash = '';
  nextBlockHash = '';
  deepScan = false;

  enableDeepScan() {
    this.deepScan = true;
  }

  disableDeepScan() {
    this.deepScan = false;
  }

  async setupListeners() {
    this.txSubscription = await this.web3!.eth.subscribe('pendingTransactions');
    this.txSubscription.subscribe((_err, tx) => {
      this.events.emit('transaction', tx);
    });
    this.blockSubscription = await this.web3!.eth.subscribe('newBlockHeaders');
    this.blockSubscription.subscribe((_err, block) => {
      this.events.emit('block', block);
    });
  }

  async resync(start: number, end: number) {
    const { chain, network } = this;
    let currentHeight = Math.max(1, start);
    while (currentHeight <= end) {
      let lastLog = Date.now();
      const block = await this.getBlock(currentHeight);
      const { convertedBlock, convertedTxs } = await this.convertBlock(block);

      const nextBlock = await EthBlockStorage.collection.findOne({ chain, network, previousBlockHash: block.hash });
      if (nextBlock) {
        convertedBlock.nextBlockHash = nextBlock.hash;
      }

      await this.blockModel.processBlock({
        chain: this.chain,
        network: this.network,
        forkHeight: this.chainConfig.forkHeight,
        parentChain: this.chainConfig.parentChain,
        initialSyncComplete: this.initialSyncComplete,
        block: convertedBlock,
        transactions: convertedTxs
      });

      currentHeight++;

      if (Date.now() - lastLog > 100) {
        logger.info('Re-Sync ', {
          chain,
          network,
          height: currentHeight
        });
        lastLog = Date.now();
      }
    }
  }

  async getBlockForNumber(blockNum: number) {
    return this.getBlock(blockNum);
  }

  async validateDataForBlock(blockNum: number, tipHeight: number, log = false) {
    let success = true;
    const { chain, network } = this;
    const atTipOfChain = blockNum === tipHeight;
    const errors = new Array<ErrorType>();

    const [block, blockTxs] = await Promise.all([
      this.blockModel.collection.findOne({
        chain,
        network,
        height: blockNum,
        processed: true
      }),
      this.txModel.collection.find({ chain, network, blockHeight: blockNum }).toArray()
    ]);

    if (!block) {
      success = false;
      const error = {
        model: 'block',
        err: true,
        type: 'MISSING_BLOCK',
        payload: { blockNum }
      };
      errors.push(error);
      if (log) {
        console.log(JSON.stringify(error));
      }
      return { success, errors };
    }

    const blockTxids = blockTxs.map(t => t.txid);
    const firstHash = blockTxs[0] ? blockTxs[0].blockHash : block!.hash;
    const [mempoolTxs, blocksForHash, blocksForHeight] = await Promise.all([
      this.txModel.collection.find({ chain, network, blockHeight: -1, txid: { $in: blockTxids } }).toArray(),
      this.blockModel.collection.countDocuments({ chain, network, hash: firstHash }),
      this.blockModel.collection.countDocuments({
        chain,
        network,
        height: blockNum,
        processed: true
      })
    ]);

    const seenTxs = {} as { [txid: string]: ITransaction };

    const linearProgress = this.prevBlockNum && this.prevBlockNum == blockNum - 1;
    const prevHashMismatch = this.prevHash && block.previousBlockHash != this.prevHash;
    const nextHashMismatch = this.nextBlockHash && block.hash != this.nextBlockHash;
    this.prevHash = block.hash;
    this.nextBlockHash = block.nextBlockHash;
    this.prevBlockNum = blockNum;
    const missingLinearData = linearProgress && (prevHashMismatch || nextHashMismatch);
    const missingNextBlockHash = !atTipOfChain && !block.nextBlockHash;
    const missingPrevBlockHash = !block.previousBlockHash;
    const missingData = missingNextBlockHash || missingPrevBlockHash || missingLinearData;

    if (!block || block.transactionCount != blockTxs.length || missingData) {
      success = false;
      const error = {
        model: 'block',
        err: true,
        type: 'CORRUPTED_BLOCK',
        payload: { blockNum, txCount: block.transactionCount, foundTxs: blockTxs.length }
      };

      errors.push(error);

      if (log) {
        console.log(JSON.stringify(error));
      }
    }

    for (let tx of mempoolTxs) {
      success = false;
      const error = { model: 'transaction', err: true, type: 'DUPE_TRANSACTION', payload: { tx, blockNum } };
      errors.push(error);
      if (log) {
        console.log(JSON.stringify(error));
      }
    }

    for (let tx of blockTxs) {
      if (tx.fee < 0) {
        success = false;
        const error = { model: 'transaction', err: true, type: 'NEG_FEE', payload: { tx, blockNum } };
        errors.push(error);
        if (log) {
          console.log(JSON.stringify(error));
        }
      }
      if (seenTxs[tx.txid]) {
        success = false;
        const error = { model: 'transaction', err: true, type: 'DUPE_TRANSACTION', payload: { tx, blockNum } };
        errors.push(error);
        if (log) {
          console.log(JSON.stringify(error));
        }
      } else {
        seenTxs[tx.txid] = tx;
      }
    }

    if (blocksForHeight === 0) {
      success = false;
      const error = {
        model: 'block',
        err: true,
        type: 'MISSING_BLOCK',
        payload: { blockNum }
      };
      errors.push(error);
      if (log) {
        console.log(JSON.stringify(error));
      }
    }

    if (blocksForHeight > 1) {
      success = false;
      const error = {
        model: 'block',
        err: true,
        type: 'DUPE_BLOCKHEIGHT',
        payload: { blockNum, blocksForHeight }
      };
      errors.push(error);
      if (log) {
        console.log(JSON.stringify(error));
      }
    }
    // blocks with same hash
    if (blockTxs.length > 0) {
      const hashFromTx = blockTxs[0].blockHash;
      if (blocksForHash > 1) {
        success = false;
        const error = { model: 'block', err: true, type: 'DUPE_BLOCKHASH', payload: { hash: hashFromTx, blockNum } };
        errors.push(error);
        if (log) {
          console.log(JSON.stringify(error));
        }
      }
    }

    return { success, errors };
  }
}
