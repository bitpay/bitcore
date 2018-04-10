const util = require('util');
const {Transform} = require('stream');
const router = require('express').Router({mergeParams: true});
const _ = require('underscore');

const logger = require('../logger');
const ChainStateProvider = require('../providers/chain-state');

// create wallet
router.post('/', async function(req, res) {
  let {chain, network} = req.params;
  let {name, pubKey, path} = req.body;
  try {
    let result = await ChainStateProvider.createWallet(chain, network, name, pubKey, {path});
    res.send(result);
  }
  catch(err) {
    res.status(500).send(err);
  }
});

router.get('/:walletId', async function(req, res) {
  try {
    let {chain, network, walletId} = req.params;
    let wallet = await ChainStateProvider.getWallet(chain, network, walletId);
    if (!wallet) {
      return res.status(404).send(new Error('Wallet not found'));
    }
    res.send(wallet);
  } catch (err){
    return res.status(500).send(err);
  }
});

router.get('/:walletId/addresses', async function(req, res) {
  try {
    let {chain, network, walletId} = req.params;
    let wallet = await ChainStateProvider.getWallet(chain, network, walletId);
    if (!wallet) {
      return res.status(404).send(new Error('Wallet not found'));
    }
    ChainStateProvider.streamWalletAddresses(chain, network, walletId, res);
  } catch (err) {
    return res.status(500).send(err);
  }
});

// update wallet
router.post('/:walletId', async (req, res) => {
  let {chain, network, walletId} = req.params;
  try {
    let wallet = await ChainStateProvider.getWallet(chain, network, walletId);
    if (!wallet) {
      return res.status(404).send(new Error('Wallet not found'));
    }

    let addresses = req.body.toString().split('\n')
      .filter((json) => json!= '')
      .map(JSON.parse)
      .map((line) => line.address)
      .filter((address) => address != null);

    await ChainStateProvider.updateWallet(chain, network, wallet, addresses);
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
  let {walletId, chain, network} = req.params; 
  try {
    let wallet = await ChainStateProvider.getWallet(chain, network, walletId);
    if (!wallet) {
      return res.status(404).send(new Error('Wallet not found'));
    }
    await ChainStateProvider.streamWalletTransactions(chain, network, wallet, res, req.query);
  } catch(err) {
    return res.status(500).send(err);
  }
});

router.get('/:walletId/balance', async (req, res) => {
  let {chain, network, walletId} = req.params;
  try{
    let wallet = await ChainStateProvider.getWallet(chain, network, walletId);
    if (!wallet) {
      return res.status(404).send(new Error('Wallet not found'));
    }
    let result = await ChainStateProvider.getWalletBalance(chain, network, walletId);
    res.send(result && result[0] || { balance: 0 });
  } catch (err){
    return res.status(500).send(err);
  }
});

router.get('/:walletId/utxos', async (req, res) => {
  let {chain, network, walletId} = req.params;
  try{
    let wallet = await ChainStateProvider.getWallet(chain, network, walletId);
    if (!wallet) {
      return res.status(404).send(new Error('Wallet not found'));
    }
    ChainStateProvider.streamWalletUtxos(chain, network, walletId, res, req.params);
  }catch (err){
    return res.status(500).send(err);
  }
});

module.exports = {
  router: router,
  path: '/wallet'
};
