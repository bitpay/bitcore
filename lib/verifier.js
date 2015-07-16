/** @namespace Verifier */

var $ = require('preconditions').singleton();
var _ = require('lodash');

var WalletUtils = require('bitcore-wallet-utils');
var Bitcore = WalletUtils.Bitcore;

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
  return (local.address == address.address &&
    _.difference(local.publicKeys, address.publicKeys).length === 0);
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
    if (error) return;

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

Verifier.checkTxProposalBody = function(credentials, txp) {
  $.checkArgument(txp.creatorId);
  $.checkState(credentials.isComplete());

  var creatorKeys = _.find(credentials.publicKeyRing, function(item) {
    if (WalletUtils.xPubToCopayerId(item.xPubKey) === txp.creatorId) return true;
  });

  if (!creatorKeys) return false;

  var creatorSigningPubKey = creatorKeys.requestPubKey;
  var hash;
  if (txp.outputs) {
    var outputs = _.map(txp.outputs, function(o) {
      return {
        toAddress: o.toAddress,
        amount: o.amount,
        message: o.encryptedMessage || o.message || null
      };
    });
    var proposalHeader = {
      outputs: outputs,
      message: txp.encryptedMessage || txp.message || null,
      payProUrl: txp.payProUrl || undefined
    };
    hash = WalletUtils.getProposalHash(proposalHeader);
  } else {
    hash = WalletUtils.getProposalHash(txp.toAddress, txp.amount, txp.encryptedMessage || txp.message || null, txp.payProUrl);
  }
  log.debug('Regenerating & verifying tx proposal hash -> Hash: ', hash, ' Signature: ', txp.proposalSignature);

  if (!WalletUtils.verifyMessage(hash, txp.proposalSignature, creatorSigningPubKey))
    return false;

  if (!Verifier.checkAddress(credentials, txp.changeAddress))
    return false;

  return true;
};



/**
 * Check transaction proposal
 *
 * @param {Function} credentials
 * @param {Object} txp
 * @param {Object} Optional: paypro
 * @param {Boolean} isLegit
 */
Verifier.checkTxProposal = function(credentials, txp, opts) {
  opts = opts || {};

  if (!this.checkTxProposalBody(credentials, txp))
    return false;

  if (opts.paypro) {
    if (txp.toAddress != opts.paypro.toAddress || txp.amount != opts.paypro.amount) 
      return false;
  }

  return true;
};

module.exports = Verifier;
