var $ = require('preconditions').singleton();
var _ = require('lodash');
var log = require('npmlog');

var Bitcore = require('bitcore');
var WalletUtils = require('../walletutils')

/* 
 * Checks data given by the server
 */

function Verifier(opts) {};

Verifier.checkAddress = function(data, address) {
  var local = WalletUtils.deriveAddress(data.publicKeyRing, address.path, data.m, data.network);
  return (local.address == address.address && JSON.stringify(local.publicKeys) == JSON.stringify(address.publicKeys));
};

Verifier.checkCopayers = function(copayers, walletPrivKey, myXPrivKey, n) {
  $.checkArgument(walletPrivKey);
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
    if (!copayer.xPubKey ||  !copayer.xPubKeySignature ||
        !WalletUtils.verifyMessage(copayer.xPubKey, copayer.xPubKeySignature, walletPubKey)) {
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
  var creatorXPubKey = _.find(data.publicKeyRing, function(xPubKey) {
    if (WalletUtils.xPubToCopayerId(xPubKey) === txp.creatorId) return true;
  });
  if (!creatorXPubKey) return false;

  var creatorSigningPubKey = (new Bitcore.HDPublicKey(creatorXPubKey)).derive('m/1/0').publicKey.toString();

  var hash = WalletUtils.getProposalHash(txp.toAddress, txp.amount, txp.message);
  log.debug('Regenerating & verifying tx proposal hash -> Hash: ', hash, ' Signature: ', txp.proposalSignature);
  if (!WalletUtils.verifyMessage(hash, txp.proposalSignature, creatorSigningPubKey)) return false;

  return Verifier.checkAddress(data, txp.changeAddress);
};

module.exports = Verifier;
