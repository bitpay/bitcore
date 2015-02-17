var $ = require('preconditions').singleton();
var _ = require('lodash');
var log = require('npmlog');

var Bitcore = require('bitcore');
var WalletUtils = require('../walletutils')
var SignUtils = require('../signutils');

/* 
 * Checks data given by the server
 */

function Verifier(opts) {};

Verifier.checkAddress = function(data, address) {
  var local = WalletUtils.deriveAddress(data.publicKeyRing, address.path, data.m, data.network);
  return (local.address == address.address && JSON.stringify(local.publicKeys) == JSON.stringify(address.publicKeys));
};

Verifier.checkCopayers = function(copayers, walletPrivKey, myXPrivKey, n) {

  var walletPubKey = Bitcore.PrivateKey.fromString(walletPrivKey).toPublicKey().toString();

  if (copayers.length != n) {
    log.error('Missing public keys in server response');
    return false;
  }

  // Repeated xpub kes?
  var uniq = [];
  var error;
  _.each(copayers, function(copayer) {
    if (uniq[copayers.xPubKey]++) {
      log.error('Repeated public keys in server response');
      error = true;
    }

    // Not signed pub keys
    if (!SignUtils.verify(copayer.xPubKey, copayer.xPubKeySignature, walletPubKey)) {
      log.error('Invalid signatures in server response');
      error = true;
    }
  });
  if (error)
    return false;

  var myXPubKey = new Bitcore.HDPublicKey(myXPrivKey).toString();
  if (!_.contains(_.pluck(copayers, 'xPubKey'), myXPubKey)) {
    log.error('Server response does not contains our public keys')
    return false;
  }
  return true;
};


Verifier.checkTxProposal = function(data, txp) {
  var hash = WalletUtils.getProposalHash(txp.toAddress, txp.amount, txp.message);
  var signingPubKey = Bitcore.PrivateKey.fromString(data.signingPrivKey).toPublicKey().toString();
  if (!SignUtils.verify(hash, txp.proposalSignature, signingPubKey)) return false;

  return Verifier.checkAddress(data, txp.changeAddress);
};

module.exports = Verifier;
