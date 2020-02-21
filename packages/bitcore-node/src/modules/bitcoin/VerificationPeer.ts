import * as _ from 'lodash';
import logger, { timestamp } from '../../logger';
import { ITransaction } from '../../models/baseTransaction';
import { BitcoinBlockStorage } from '../../models/block';
import { CoinStorage, ICoin } from '../../models/coin';
import { TransactionStorage } from '../../models/transaction';
import { BitcoinP2PWorker } from '../../modules/bitcoin/p2p';
import { ChainStateProvider } from '../../providers/chain-state';
import { ErrorType, IVerificationPeer } from '../../services/verification';

export class VerificationPeer extends BitcoinP2PWorker implements IVerificationPeer {
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

  setupListeners() {
    this.pool.on('peerready', peer => {
      logger.info(
        `${timestamp()} | Connected to peer: ${peer.host}:${peer.port.toString().padEnd(5)} | Chain: ${
          this.chain
        } | Network: ${this.network}`
      );
    });

    this.pool.on('peerdisconnect', peer => {
      logger.warn(
        `${timestamp()} | Not connected to peer: ${peer.host}:${peer.port.toString().padEnd(5)} | Chain: ${
          this.chain
        } | Network: ${this.network}`
      );
    });

    this.pool.on('peertx', async (peer, message) => {
      const hash = message.transaction.hash;
      logger.debug('peer tx received', {
        peer: `${peer.host}:${peer.port}`,
        chain: this.chain,
        network: this.network,
        hash
      });
      this.events.emit('transaction', message.transaction);
    });

    this.pool.on('peerblock', async (peer, message) => {
      const { block } = message;
      const { hash } = block;
      logger.debug('peer block received', {
        peer: `${peer.host}:${peer.port}`,
        chain: this.chain,
        network: this.network,
        hash
      });

      this.events.emit(hash, message.block);
      this.events.emit('block', message.block);
    });

    this.pool.on('peerheaders', (peer, message) => {
      logger.debug('peerheaders message received', {
        peer: `${peer.host}:${peer.port}`,
        chain: this.chain,
        network: this.network,
        count: message.headers.length
      });
      this.events.emit('headers', message.headers);
    });

    this.pool.on('peerinv', (peer, message) => {
      const filtered = message.inventory.filter(inv => {
        const hash = this.bitcoreLib.encoding
          .BufferReader(inv.hash)
          .readReverse()
          .toString('hex');
        return !this.isCachedInv(inv.type, hash);
      });

      if (filtered.length) {
        peer.sendMessage(this.messages.GetData(filtered));
      }
    });
  }

  async getBlockForNumber(currentHeight: number) {
    const { chain, network } = this;
    const [{ hash }] = await BitcoinBlockStorage.collection
      .find({ chain, network, height: currentHeight })
      .limit(1)
      .toArray();
    return this.getBlock(hash);
  }

  async resync(start: number, end: number) {
    const { chain, network } = this;
    let currentHeight = Math.max(1, start);
    while (currentHeight < end) {
      const locatorHashes = await ChainStateProvider.getLocatorHashes({
        chain,
        network,
        startHeight: Math.max(1, currentHeight - 30),
        endHeight: currentHeight
      });
      const headers = await this.getHeaders(locatorHashes);
      if (!headers.length) {
        logger.info(`${chain}:${network} up to date.`);
        break;
      }
      const headerCount = Math.min(headers.length, end - currentHeight);
      logger.info(`Re-Syncing ${headerCount} blocks for ${chain} ${network}`);
      let lastLog = Date.now();
      for (let header of headers) {
        if (currentHeight <= end) {
          const block = await this.getBlock(header.hash);
          await BitcoinBlockStorage.processBlock({ chain, network, block, initialSyncComplete: true });
          const nextBlock = await BitcoinBlockStorage.collection.findOne({
            chain,
            network,
            previousBlockHash: block.hash
          });
          if (nextBlock) {
            await BitcoinBlockStorage.collection.updateOne(
              { chain, network, hash: block.hash },
              { $set: { nextBlockHash: nextBlock.hash } }
            );
          }
        }
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
  }

  async validateDataForBlock(blockNum: number, tipHeight: number, log = false) {
    let success = true;
    const { chain, network } = this;
    const atTipOfChain = blockNum === tipHeight;
    const errors = new Array<ErrorType>();

    const [block, blockTxs] = await Promise.all([
      BitcoinBlockStorage.collection.findOne({
        chain,
        network,
        height: blockNum,
        processed: true
      }),
      TransactionStorage.collection.find({ chain, network, blockHeight: blockNum }).toArray()
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
    const [coinsForTx, mempoolTxs, blocksForHash, blocksForHeight, p2pBlock] = await Promise.all([
      CoinStorage.collection.find({ chain, network, mintTxid: { $in: blockTxids } }).toArray(),
      TransactionStorage.collection.find({ chain, network, blockHeight: -1, txid: { $in: blockTxids } }).toArray(),
      BitcoinBlockStorage.collection.countDocuments({ chain, network, hash: firstHash }),
      BitcoinBlockStorage.collection.countDocuments({
        chain,
        network,
        height: blockNum,
        processed: true
      }),
      this.deepScan ? this.getBlockForNumber(blockNum) : Promise.resolve({} as any)
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

    if (block && this.deepScan && p2pBlock) {
      const txs = p2pBlock.transactions ? p2pBlock.transactions.slice(1) : [];
      const spends = _.chain(txs)
        .map(tx => tx.inputs)
        .flatten()
        .map(input => input.toObject())
        .value();

      for (let spend of spends) {
        const found = await CoinStorage.collection.findOne({
          chain,
          network,
          mintTxid: spend.prevTxId,
          mintIndex: spend.outputIndex
        });
        if (found && found.spentHeight !== block.height) {
          success = false;
          const error = { model: 'coin', err: true, type: 'COIN_SHOULD_BE_SPENT', payload: { coin: found, blockNum } };
          errors.push(error);
          if (log) {
            console.log(JSON.stringify(error));
          }
        } else {
          if (!found && spend.prevTxId != '0000000000000000000000000000000000000000000000000000000000000000') {
            success = false;
            const error = {
              model: 'coin',
              err: true,
              type: 'MISSING_INPUT',
              payload: { coin: { mintTxid: spend.prevTxId, mintIndex: spend.outputIndex }, blockNum }
            };
            errors.push(error);
            if (log) {
              console.log(JSON.stringify(error));
            }
          }
        }
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

    const seenTxCoins = {} as { [txid: string]: ICoin[] };
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

    for (let coin of coinsForTx) {
      if (seenTxCoins[coin.mintTxid] && seenTxCoins[coin.mintTxid][coin.mintIndex]) {
        success = false;
        const error = { model: 'coin', err: true, type: 'DUPE_COIN', payload: { coin, blockNum } };
        errors.push(error);
        if (log) {
          console.log(JSON.stringify(error));
        }
      } else {
        seenTxCoins[coin.mintTxid] = seenTxCoins[coin.mintTxid] || {};
        seenTxCoins[coin.mintTxid][coin.mintIndex] = coin;
      }
    }

    const mintHeights = _.uniq(coinsForTx.map(c => c.mintHeight));
    if (mintHeights.length > 1) {
      success = false;
      const error = { model: 'coin', err: true, type: 'COIN_HEIGHT_MISMATCH', payload: { blockNum } };
      errors.push(error);
      if (log) {
        console.log(JSON.stringify(error));
      }
    }

    for (let txid of Object.keys(seenTxs)) {
      const coins = seenTxCoins[txid];
      if (!coins) {
        success = false;
        const error = { model: 'coin', err: true, type: 'MISSING_COIN_FOR_TXID', payload: { txid, blockNum } };
        errors.push(error);
        if (log) {
          console.log(JSON.stringify(error));
        }
      }
    }

    for (let txid of Object.keys(seenTxCoins)) {
      const tx = seenTxs[txid];
      const coins = seenTxCoins[txid];
      if (!tx) {
        success = false;
        const error = { model: 'transaction', err: true, type: 'MISSING_TX', payload: { txid, blockNum } };
        errors.push(error);
        if (log) {
          console.log(JSON.stringify(error));
        }
      } else {
        const sum = Object.values(coins).reduce((prev, cur) => prev + cur.value, 0);
        if (sum != tx.value) {
          success = false;
          const error = {
            model: 'coin+transactions',
            err: true,
            type: 'VALUE_MISMATCH',
            payload: { tx, coins, blockNum }
          };
          errors.push(error);
          if (log) {
            console.log(JSON.stringify(error));
          }
        }
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
