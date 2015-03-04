/** @namespace Verifier */

var $ = require('preconditions').singleton();
var _ = require('lodash');
var log = require('npmlog');

var Bitcore = require('bitcore');
var WalletUtils = require('bitcore-wallet-utils');

/**
 * @desc Verifier constructor. Checks data given by the server
 *
 * @constructor
 */
function Verifier(opts) {};

/**
 * Check address
 *
 * @param {Function} credentials
 * @param {String} address
 * @returns {Boolean} true or false
 */
Verifier.checkAddress = function(credentials, address) {
  $.checkState(credentials.isComplete());
  var local = WalletUtils.deriveAddress(credentials.publicKeyRing, address.path, credentials.m, credentials.network);
  return (local.address == address.address && JSON.stringify(local.publicKeys) == JSON.stringify(address.publicKeys));
};

/**
 * Check copayers
 *
 * @param {Function} credentials
 * @param {Array} copayers
 * @returns {Boolean} true or false
 */
Verifier.checkCopayers = function(credentials, copayers) {
  $.checkState(credentials.walletPrivKey);
  var walletPubKey = Bitcore.PrivateKey.fromString(credentials.walletPrivKey).toPublicKey().toString();

  if (copayers.length != credentials.n) {
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
    if (!copayer.xPubKey || !copayer.xPubKeySignature ||
      !WalletUtils.verifyMessage(copayer.xPubKey, copayer.xPubKeySignature, walletPubKey)) {
      log.error('Invalid signatures in server response');
      error = true;
    }
  });
  if (error)
    return false;

  if (!_.contains(_.pluck(copayers, 'xPubKey'), credentials.xPubKey)) {
    log.error('Server response does not contains our public keys')
    return false;
  }
  return true;
};

/**
 * Check transaction proposal
 *
 * @param {Function} credentials
 * @param {Object} txp
 * @returns {Boolean} true or false
 */
Verifier.checkTxProposal = function(credentials, txp) {
  $.checkArgument(txp.creatorId);
  $.checkState(credentials.isComplete());

  var creatorXPubKey = _.find(credentials.publicKeyRing, function(xPubKey) {
    if (WalletUtils.xPubToCopayerId(xPubKey) === txp.creatorId) return true;
  });

  if (!creatorXPubKey) return false;

  var creatorSigningPubKey = (new Bitcore.HDPublicKey(creatorXPubKey)).derive('m/1/1').publicKey.toString();

  var hash = WalletUtils.getProposalHash(txp.toAddress, txp.amount, txp.encryptedMessage || txp.message);
  log.debug('Regenerating & verifying tx proposal hash -> Hash: ', hash, ' Signature: ', txp.proposalSignature);


  if (!WalletUtils.verifyMessage(hash, txp.proposalSignature, creatorSigningPubKey))
    return false;

  return Verifier.checkAddress(credentials, txp.changeAddress);
};

module.exports = Verifier;
