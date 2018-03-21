const util = require('util');
const {Transform} = require('stream');

const router = require('express').Router();
const _ = require('underscore');
const mongoose = require('mongoose');

const logger = require('../logger');
const ChainStateProvider = require('../providers/chain-state');
const Storage = require('../services/storage');
const Wallet = mongoose.model('Wallet');
const WalletAddress = mongoose.model('WalletAddress');
const Transaction = mongoose.model('Transaction');
const Coin = mongoose.model('Coin');

// create wallet
router.post('/', function(req, res) {
  let {chain, network, name, pubKey, path} = req.body;
  if (typeof name !== 'string' || !chain || !network) {
    return res.status(400).send('Missing required param');
  }
  Wallet.create({
    chain,
    network,
    name,
    pubKey,
    path
  }, function(err, result) {
    if(err) {
      res.status(500).send(err);
    }
    res.send(result);
  });
});

router.get('/:walletId', async function(req, res) {
  try {
    let {walletId} = req.params;
    let {chain, network} = req.query;
    let wallet = await ChainStateProvider.getWallet(chain, network, walletId);
    if (!wallet) {
      return res.status(404).send(new Error('Wallet not found'));
    }
    res.send(wallet);
  } catch (err){
    console.error(err);
    return res.status(500).send(err);
  }
});

router.get('/:walletId/addresses', async function(req, res) {
  try {
    let wallet = await Wallet.findOne({ _id: req.params.walletId }).exec();
    if (!wallet) {
      return res.status(404).send(new Error('Wallet not found'));
    }
    let query = { wallet: wallet._id };
    Storage.apiStreamingFind(WalletAddress, query, req.query, res);
  } catch (err) {
    return res.status(500).send(err);
  }
});

// update wallet
router.post('/:walletId', async (req, res) => {
  let wallet = await Wallet.findOne({ _id: req.params.walletId }).exec();
  if (!wallet) {
    return res.status(404).send(new Error('Wallet not found'));
  }

  let addresses = req.body.toString().split('\n')
    .filter((json) => json!= '')
    .map(JSON.parse)
    .map((line) => line.address)
    .filter((address) => address != null);

  try {
    await WalletAddress.updateCoins(wallet, addresses);
    return res.send({ success: true });
  } catch (err) {
    return res.status(500).send(err);
  }
});

function ListTransactionsStream(walletId) {
  this.walletId = walletId;
  Transform.call(this, {objectMode: true});
}

util.inherits(ListTransactionsStream, Transform);

ListTransactionsStream.prototype._transform = function(transaction, enc, done) {
  var self = this;
  var wallet = this.walletId.toString();
  var totalInputs = transaction.inputs.reduce((total, input) => { return total + input.value; }, 0);
  var totalOutputs = transaction.outputs.reduce((total, output) => { return total + output.value; }, 0);
  var fee = totalInputs - totalOutputs;
  var sending = _.some(transaction.inputs, function(input) {
    var contains = false;
    _.each(input.wallets, function(inputWallet) {
      if(inputWallet.equals(wallet)) {
        contains = true;
      }
    });
    return contains;
  });

  if(sending) {
    var recipients = 0;
    _.each(transaction.outputs, function(output) {
      var contains = false;
      _.each(output.wallets, function(outputWallet) {
        if(outputWallet.equals(wallet)) {
          contains = true;
        }
      });
      if(!contains) {
        recipients++;
        self.push(JSON.stringify({
          txid: transaction.txid,
          category: 'send',
          satoshis: -output.value,
          height: transaction.blockHeight,
          address: output.address,
          outputIndex: output.vout,
          blockTime: transaction.blockTimeNormalized
        }) + '\n');
      }
    });
    if (recipients > 1){
      logger.warn('probably missing a change address', {txid: transaction.txid});
    }
    if(fee > 0) {
      self.push(JSON.stringify({
        txid: transaction.txid,
        category: 'fee',
        satoshis: -fee,
        height: transaction.blockHeight,
        blockTime: transaction.blockTimeNormalized
      }) + '\n');
    }
    return done();
  }

  _.each(transaction.outputs, function(output) {
    var contains = false;
    _.each(output.wallets, function(outputWallet) {
      if(outputWallet.equals(wallet)) {
        contains = true;
      }
    });
    if(contains) {
      self.push(JSON.stringify({
        txid: transaction.txid,
        category: 'receive',
        satoshis: output.value,
        height: transaction.blockHeight,
        address: output.address,
        outputIndex: output.vout,
        blockTime: transaction.blockTimeNormalized
      }) + '\n');
    }
  });

  done();
};

router.get('/:walletId/transactions', async (req, res) => {
  let wallet = await Wallet.findOne({ _id: req.params.walletId }).exec();
  if (!wallet) {
    return res.status(404).send(new Error('Wallet not found'));
  }
  var query = {
    wallets: wallet._id
  };
  if (req.query.startBlock) {
    query.blockHeight = { $gte: parseInt(req.query.startBlock) };
  }
  if (req.query.endBlock) {
    query.blockHeight = query.blockHeight || {};
    query.blockHeight.$lte = parseInt(req.query.endBlock);
  }
  if (req.query.startDate) {
    query.blockTimeNormalized = { $gte: new Date(req.query.startDate) };
  }
  if (req.query.endDate) {
    query.blockTimeNormalized = query.blockTimeNormalized || {};
    query.blockTimeNormalized.$lt = new Date(req.query.endDate);
  }
  var transactionStream = Transaction.getTransactions({query});
  var listTransactionsStream = new ListTransactionsStream(wallet._id);
  transactionStream.pipe(listTransactionsStream).pipe(res);
});

router.get('/:walletId/balance', async (req, res) => {
  let wallet = await Wallet.findOne({ _id: req.params.walletId }).exec();
  if (!wallet) {
    return res.status(404).send(new Error('Wallet not found'));
  }
  let query = { wallets: wallet._id };
  let balance = Coin.getBalance({query});
  try {
    let result = await balance.exec();
    res.send(result && result[0] || { balance: 0 });
  } catch (err){
    return res.status(500).send(err);
  }
});

router.get('/:walletId/utxos', async (req, res) => {
  let wallet = await Wallet.findOne({ _id: req.params.walletId }).exec();
  if (!wallet) {
    return res.status(404).send(new Error('Wallet not found'));
  }
  let query = { wallets: wallet._id, spentHeight: {$lt: 0} };
  if (req.params.spent){
    query.spentHeight = { $gt: 0 };
  }
  Storage.apiStreamingFind(Coin, query, req.query, res);
});

module.exports = {
  router: router,
  path: '/wallet'
};
