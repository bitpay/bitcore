const util = require('util');
const {Transform} = require('stream');
const router = require('express').Router({mergeParams: true});
const _ = require('underscore');
const secp256k1 = require('secp256k1');

const logger = require('../logger');
const ChainStateProvider = require('../providers/chain-state');
const bitcoreLib = require('bitcore-lib');

const verifyRequestSignature = (params) => {
  const { message, pubKey, signature} = params;
  const pub = (new bitcoreLib.HDPublicKey(pubKey)).deriveChild('m/2').publicKey.toString('hex');
  const messageHash = bitcoreLib.crypto.Hash.sha256sha256(Buffer.from(message)).toString('hex');
  return secp256k1.verify(Buffer.from(messageHash, 'hex'), Buffer.from(signature, 'hex'), Buffer.from(pub, 'hex'));
};

const authenticate = async (req, res, next) => {
  const { chain, network, pubKey } = req.params;
  const wallet = await ChainStateProvider.getWallet({ chain, network, pubKey });
  if (!wallet) {
    return res.status(404).send(new Error('Wallet not found'));
  }
  req.wallet = wallet;
  try {
    const validRequestSignature = verifyRequestSignature({
      message: [req.method, req.originalUrl, JSON.stringify(req.body)].join('|'),
      pubKey: wallet.pubKey,
      signature: req.headers['x-signature']
    });
    if (!validRequestSignature) {
      return res.status(401).send(new Error('Authentication failed'));
    }
    next();
  } catch (e) {
    return res.status(401).send(new Error('Authentication failed'));
  }
};

// create wallet
router.post('/', async function(req, res) {
  let {chain, network} = req.params;
  let {name, pubKey, path} = req.body;
  try {
    const existingWallet = await ChainStateProvider.getWallet({chain,network,pubKey});
    if (existingWallet) {
      return res.status(200).send('Wallet already exists');
    }
    let result = await ChainStateProvider.createWallet({chain, network, name, pubKey, path});
    res.send(result);
  }
  catch(err) {
    res.status(500).send(err);
  }
});

router.get('/:walletId', authenticate, async function(req, res) {
  try {
    let {chain, network, pubKey} = req.params;
    let wallet = await ChainStateProvider.getWallet({ chain, network, pubKey });
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
    let {chain, network, pubKey} = req.params;
    let wallet = await ChainStateProvider.getWallet({ chain, network, pubKey });
    if (!wallet) {
      return res.status(404).send(new Error('Wallet not found'));
    }
    ChainStateProvider.streamWalletAddresses(chain, network, pubKey, res);
  } catch (err) {
    return res.status(500).send(err);
  }
});

// update wallet
router.post('/:pubKey', authenticate, async (req, res) => {
  let {chain, network} = req.params;
  try {
    let addresses = req.body.map(address => address.address);
    await ChainStateProvider.updateWallet({chain, network, wallet: req.wallet, addresses});
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

router.get('/:pubKey/transactions', async (req, res) => {
  let {chain, network, pubKey} = req.params; 
  try {
    let wallet = await ChainStateProvider.getWallet({ chain, network, pubKey });
    if (!wallet) {
      return res.status(404).send(new Error('Wallet not found'));
    }
    await ChainStateProvider.streamWalletTransactions(chain, network, wallet, res, req.query);
  } catch(err) {
    return res.status(500).send(err);
  }
});

router.get('/:pubKey/balance', authenticate, async (req, res) => {
  let {chain, network } = req.params;
  try{
    const result = await ChainStateProvider.getWalletBalance({chain, network, wallet: req.wallet});
    res.send(result && result[0] || { balance: 0 });
  } catch (err){
    return res.status(500).json(err);
  }
});

router.get('/:pubKey/utxos', authenticate, async (req, res) => {
  let {chain, network } = req.params;
  try{
    ChainStateProvider.streamWalletUtxos({chain, network, wallet: req.wallet, stream: res, args: req.query});
  }catch (err){
    return res.status(500).send(err);
  }
});

module.exports = {
  router: router,
  path: '/wallet'
};
