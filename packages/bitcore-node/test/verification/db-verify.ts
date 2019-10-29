#!/usr/bin/env node

import { BitcoinBlockStorage } from '../../src/models/block';
import { CoinStorage, ICoin } from '../../src/models/coin';
import { TransactionStorage, ITransaction } from '../../src/models/transaction';
import { Storage } from '../../src/services/storage';
import * as _ from 'lodash';
import { Config } from '../../src/services/config';
import { ChainStateProvider } from '../../src/providers/chain-state';
import { BitcoinP2PWorker } from '../../src/modules/bitcoin/p2p';

const { CHAIN, NETWORK, HEIGHT } = process.env;
const resumeHeight = Number(HEIGHT) || 1;
const chain = CHAIN || '';
const network = NETWORK || '';

const chainConfig = Config.chainConfig({ chain, network });
const worker = new BitcoinP2PWorker({ chain, network, chainConfig });
worker.connect();

type ErrorType = {
  model: string;
  err: boolean;
  type: string;
  payload: any;
};

async function getBlock(currentHeight: number) {
  worker.isSyncing = true;
  worker.isSyncingNode = true;

  const locatorHashes = await ChainStateProvider.getLocatorHashes({
    chain,
    network,
    startHeight: Math.max(1, currentHeight - 30),
    endHeight: currentHeight
  });
  const headers = await worker.getHeaders(locatorHashes);
  return worker.getBlock(headers[0].hash);
}

export async function validateDataForBlock(blockNum: number, log = false) {
  let success = true;
  const [block, blockTxs, blocksForHeight] = await Promise.all([
    BitcoinBlockStorage.collection.findOne({ chain, network, height: blockNum, processed: true }),
    TransactionStorage.collection.find({ chain, network, blockHeight: blockNum }).toArray(),
    BitcoinBlockStorage.collection.countDocuments({
      chain,
      network,
      height: blockNum,
      processed: true
    })
  ]);
  const blockTxids = blockTxs.map(t => t.txid);
  const firstHash = blockTxs[0] ? blockTxs[0].blockHash : block!.hash;
  const [coinsForTx, mempoolTxs, blocksForHash] = await Promise.all([
    CoinStorage.collection.find({ chain, network, mintTxid: { $in: blockTxids } }).toArray(),
    TransactionStorage.collection.find({ chain, network, blockHeight: -1, txid: { $in: blockTxids } }).toArray(),
    BitcoinBlockStorage.collection.countDocuments({ chain, network, hash: firstHash })
  ]);

  const seenTxs = {} as { [txid: string]: ITransaction };
  const errors = new Array<ErrorType>();

  if (!block || block.transactionCount != blockTxs.length) {
    success = false;
    const error = {
      model: 'block',
      err: true,
      type: 'CORRUPTED_BLOCK',
      payload: { blockNum }
    };

    errors.push(error);

    if (log) {
      console.log(JSON.stringify(error));
    }
  }

  if (block) {
    const p2pBlock = await getBlock(blockNum);
    const txs = p2pBlock.transactions ? p2pBlock.transactions.slice(1) : [];
    const spends = _.chain(txs)
      .map(tx => tx.inputs)
      .flatten()
      .map(input => input.toObject())
      .value();

    const coins = await CoinStorage.collection
      .find({ chain, network, mintTxid: { $in: spends.map(tx => tx.prevTxId) } })
      .toArray();
    for (let spend of spends) {
      const found = coins.find(c => c.mintTxid === spend.prevTxId && c.mintIndex === spend.outputIndex);
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
            console.log(coins.filter(c => c.mintTxid === spend.prevTxId));
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
  //blocks with same hash
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

if (require.main === module) {
  (async () => {
    await Storage.start();
    if (!chain || !network) {
      console.log('Please provide a CHAIN and NETWORK environment variable');
      process.exit(1);
    }
    const tip = await BitcoinBlockStorage.getLocalTip({ chain, network });

    if (tip) {
      for (let i = resumeHeight; i <= tip.height; i++) {
        const { success } = await validateDataForBlock(i, true);
        console.log({ block: i, success });
      }
    }
    process.exit(0);
  })();
}
