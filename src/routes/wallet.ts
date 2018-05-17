const router = require('express').Router({mergeParams: true});
const secp256k1 = require('secp256k1');

const ChainStateProvider = require('../providers/chain-state');
const bitcoreLib = require('bitcore-lib');

const verifyRequestSignature = (params) => {
  const { message, pubKey, signature} = params;
  const pub = (new bitcoreLib.HDPublicKey(pubKey)).deriveChild('m/2').publicKey.toBuffer();
  const messageHash = bitcoreLib.crypto.Hash.sha256sha256(Buffer.from(message));
  return secp256k1.verify(messageHash, Buffer.from(signature, 'hex'), pub);
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

router.get('/:pubKey', authenticate, async function(req, res) {
  try {
    let wallet = req.wallet;
    res.send(wallet);
  } catch (err){
    return res.status(500).send(err);
  }
});

router.get('/:pubKey/addresses', authenticate, async function(req, res) {
  try {
    let {chain, network, pubKey} = req.params;
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

router.get('/:pubKey/transactions', authenticate,  async (req, res) => {
  let {chain, network } = req.params; 
  try {
    await ChainStateProvider.streamWalletTransactions(chain, network, req.wallet, res, req.query);
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
