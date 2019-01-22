#!/usr/bin/env node

import { BlockStorage } from '../../src/models/block';
import { CoinStorage, ICoin } from '../../src/models/coin';
import { TransactionStorage, ITransaction } from '../../src/models/transaction';

(async () => {
  const { CHAIN, NETWORK } = process.env;
  const chain = CHAIN;
  const network = NETWORK;
  const tip = await BlockStorage.getLocalTip({ chain, network });

  async function validateDataForBlock(blockNum: number) {
    let allGood = true;
    const blockTxs = await TransactionStorage.collection.find({ chain, network, blockHeight: blockNum }).toArray();
    const seenTxs = {} as { [txid: string]: ITransaction };

    for (let tx of blockTxs) {
      if (tx.fee < 0) {
        allGood = false;
        const error = { model: 'transaction', err: false, type: 'NEG_FEE', payload: tx };
        console.error(error);
      }
      seenTxs[tx.txid] = tx;
    }

    const coinsForBlock = await CoinStorage.collection.find({ chain, network, mintHeight: blockNum }).toArray();
    const seenCoins = {} as { [txid: string]: ICoin[] };
    for (let coin of coinsForBlock) {
      if (seenCoins[coin.mintTxid][coin.mintIndex]) {
        allGood = false;
        const error = { model: 'coin', err: false, type: 'DUPE_COIN', payload: coin };
        console.error(error);
      } else {
        seenCoins[coin.mintTxid] = seenCoins[coin.mintTxid] || {};
        seenCoins[coin.mintTxid][coin.mintIndex] = coin;
      }
    }

    for (let txid of Object.keys(seenTxs)) {
      const coins = seenCoins[txid];
      if (!coins) {
        allGood = false;
        const error = { model: 'coin', err: false, type: 'MISSING_COIN_FOR_TXID', payload: txid };
        console.error(error);
      }
    }

    for (let txid of Object.keys(seenCoins)) {
      const tx = seenTxs[txid];
      const coins = seenCoins[txid];
      if (!tx) {
        allGood = false;
        const error = { model: 'transaction', err: false, type: 'MISSING_TX', payload: tx };
        console.error(error);
      } else {
        const sum = Object.values(coins).reduce((prev, cur) => prev + cur.value, 0);
        if (sum + tx.fee != tx.value) {
          allGood = false;
          const error = { model: 'coin+transactions', err: false, type: 'VALUE_MISMATCH', payload: { tx, coins } };
          console.error(error);
        }
      }
    }
    return allGood;
  }

  if (tip) {
    for (let i = 1; i < tip.height; i++) {
      const success = await validateDataForBlock(i);
      console.log({ block: i, success });
    }
  }
})();
