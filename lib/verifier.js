/** @namespace Verifier */

var $ = require('preconditions').singleton();
var _ = require('lodash');

var Bitcore = require('bitcore');
var WalletUtils = require('bitcore-wallet-utils');

var log = require('./log');

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
    if (!copayer.name || !copayer.xPubKey || !copayer.requestPubKey || !copayer.signature) {
      log.error('Missing copayer fields in server response');
      error = true;
    } else {
      var hash = WalletUtils.getCopayerHash(copayer.name, copayer.xPubKey, copayer.requestPubKey);
      if (!WalletUtils.verifyMessage(hash, copayer.signature, walletPubKey)) {
        log.error('Invalid signatures in server response');
        error = true;
      }
    }
  });

  if (error) return false;

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

  var creatorKeys = _.find(credentials.publicKeyRing, function(item) {
    if (WalletUtils.xPubToCopayerId(item.xPubKey) === txp.creatorId) return true;
  });

  if (!creatorKeys) return false;

  // TODO: this should be an independent key
  var creatorSigningPubKey = creatorKeys.requestPubKey;

  var hash = WalletUtils.getProposalHash(txp.toAddress, txp.amount, txp.encryptedMessage || txp.message);
  log.debug('Regenerating & verifying tx proposal hash -> Hash: ', hash, ' Signature: ', txp.proposalSignature);


  if (!WalletUtils.verifyMessage(hash, txp.proposalSignature, creatorSigningPubKey))
    return false;

  return Verifier.checkAddress(credentials, txp.changeAddress);
};

module.exports = Verifier;
