import express = require('express');
const router = express.Router({ mergeParams: true });
import { ChainStateProvider } from '../../providers/chain-state';
import { CoinStorage } from '../../models/coin';
import { Storage } from '../../services/storage';

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

router.get('/:address/coins', async function(req, res) {
  let { address, chain, network } = req.params;

  try {
    const { query, options } = Storage.getFindOptions(CoinStorage, req.query);

    let coins = await CoinStorage.collection.find({ ...query, address, chain, network }, options).toArray();

    let spentTxids = coins.filter(tx => tx.spentTxid).map(tx => tx.spentTxid);
    let mintedTxids = coins.filter(tx => tx.mintTxid).map(tx => tx.mintTxid);

    let [fundingTxInputs, fundingTxOutputs, spendingTxInputs, spendingTxOutputs] = await Promise.all([
      CoinStorage.collection.find({ chain, network, spentTxid: { $in: mintedTxids } }).toArray(),
      CoinStorage.collection.find({ chain, network, mintTxid: { $in: mintedTxids } }).toArray(),
      CoinStorage.collection.find({ chain, network, spentTxid: { $in: spentTxids } }).toArray(),
      CoinStorage.collection.find({ chain, network, mintTxid: { $in: spentTxids } }).toArray()
    ]);
    return res.json({
      coins,
      mintedTxids,
      fundingTxInputs,
      fundingTxOutputs,
      spentTxids,
      spendingTxInputs,
      spendingTxOutputs
    });
  } catch (err) {
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
