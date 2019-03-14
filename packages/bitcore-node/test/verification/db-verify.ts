#!/usr/bin/env node

import { BlockStorage } from '../../src/models/block';
import { CoinStorage, ICoin } from '../../src/models/coin';
import { TransactionStorage, ITransaction } from '../../src/models/transaction';
import { Storage } from '../../src/services/storage';
import * as _ from 'lodash';

const { CHAIN, NETWORK, HEIGHT } = process.env;
const resumeHeight = Number(HEIGHT) || 1;
const chain = CHAIN;
const network = NETWORK;

type ErrorType = {
  model: string;
  err: boolean;
  type: string;
  payload: any;
};

export async function validateDataForBlock(blockNum: number, log = false) {
  let success = true;
  const blockTxs = await TransactionStorage.collection.find({ chain, network, blockHeight: blockNum }).toArray();
  const blockTxids = blockTxs.map(t => t.txid);
  const coinsForTx = await CoinStorage.collection.find({ chain, network, mintTxid: { $in: blockTxids } }).toArray();
  const mempoolTxs = await TransactionStorage.collection
    .find({ chain, network, blockHeight: -1, txid: { $in: blockTxids } })
    .toArray();

  const seenTxs = {} as { [txid: string]: ITransaction };
  const errors = new Array<ErrorType>();

  for (const tx of mempoolTxs) {
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

  const blocksForHeight = await BlockStorage.collection.countDocuments({
    chain,
    network,
    height: blockNum,
    processed: true
  });
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
    const blocksForHash = await BlockStorage.collection.countDocuments({ chain, network, hash: hashFromTx });
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
    const tip = await BlockStorage.getLocalTip({ chain, network });

    if (tip) {
      for (let i = resumeHeight; i <= tip.height; i++) {
        const { success } = await validateDataForBlock(i, true);
        console.log({ block: i, success });
      }
    }
    process.exit(0);
  })();
}
