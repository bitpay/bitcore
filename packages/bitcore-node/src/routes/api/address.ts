import express = require('express');
const router = express.Router({ mergeParams: true });
import { ChainStateProvider } from '../../providers/chain-state';
import { CoinStorage } from '../../models/coin';

router.get('/:address/txs', function(req, res) {
  let { address, chain, network } = req.params;
  let { unspent, limit = 10, since } = req.query;
  let payload = {
    chain,
    network,
    address,
    req,
    res,
    args: { ...req.query, unspent, limit, since }
  };
  ChainStateProvider.streamAddressTransactions(payload);
});

router.get('/:address', function(req, res) {
  let { address, chain, network } = req.params;
  let { unspent, limit = 10, since } = req.query;
  let payload = {
    chain,
    network,
    address,
    req,
    res,
    args: { unspent, limit, since }
  };
  ChainStateProvider.streamAddressUtxos(payload);
});

router.get('/:address/coins', async function (req, res) {
  let { address, chain, network } = req.params;
  // let { unspent, limit = 10, since } = req.query;
  try {
    let coins = await CoinStorage.collection.find({address, chain, network}).toArray();

    const mintTxids : string[] = [];
    const spentTxids : string[] = [];
    const mintTxidIndexes = {};
    const spentTxidIndexes = {};

    coins.forEach((coin) => {
      if(coin.mintTxid) {
        mintTxids.push(coin.mintTxid);
      } 
      
      if(coin.spentTxid) {
        spentTxids.push(coin.spentTxid);
      }

    });

    const mintTxidCoinPromises = mintTxids.map(function (txid, index) {
      mintTxidIndexes[index] = txid;
      return ChainStateProvider.getCoinsForTx({ chain, network, txid });
    });

    const spentTxidCoinPromises = spentTxids.map(function (txid, index) {
      spentTxidIndexes[index] = txid;
      return ChainStateProvider.getCoinsForTx({ chain, network, txid });
    });

    let mintTxidCoins = await Promise.all(mintTxidCoinPromises).then(
      (data) => {
        let response: any = {};
        data.forEach((coin, index) => {
          let txid: string = mintTxidIndexes[index];
          response[txid] = coin;
        });
        return response;
      }
    );

    let spentTxidCoins = await Promise.all(spentTxidCoinPromises).then(
      (data) => {
        let response: any = {};
        data.forEach((coin, index) => {
          let txid: string = spentTxidIndexes[index];
          response[txid] = coin;
        });
        return response;
      }
    );
    return res.json({mintTxidCoins, spentTxidCoins});
  } catch(err) {
    return res.status(500).send(err);
  }
  
});

router.get('/:address/balance', async function(req, res) {
  let { address, chain, network } = req.params;
  try {
    let result = await ChainStateProvider.getBalanceForAddress({
      chain,
      network,
      address,
      args: req.query
    });
    return res.send(result || { confirmed: 0, unconfirmed: 0, balance: 0 });
  } catch (err) {
    return res.status(500).send(err);
  }
});

module.exports = {
  router: router,
  path: '/address'
};
