import * as _ from 'lodash';
var $ = require('preconditions').singleton();

var Bitcore = require('bitcore-lib');
var BCHAddress = require('bitcore-lib-cash').Address;

import { Utils } from './common/utils';
var utils;

import { Logger } from './log';
var log;

/**
 * @desc Verifier constructor. Checks data given by the server
 *
 * @constructor
 */
export class Verifier {
  constructor() {
    utils = new Utils();
    log = new Logger();
  }

  /**
   * Check address
   *
   * @param {Function} credentials
   * @param {String} address
   * @returns {Boolean} true or false
   */
  checkAddress(credentials, address) {
    $.checkState(credentials.isComplete());

    var local = utils.deriveAddress(address.type || credentials.addressType, credentials.publicKeyRing, address.path, credentials.m, credentials.network, credentials.coin);
    return (local.address == address.address &&
      _.difference(local.publicKeys, address.publicKeys).length === 0);
  }

  /**
   * Check copayers
   *
   * @param {Function} credentials
   * @param {Array} copayers
   * @returns {Boolean} true or false
   */
  checkCopayers(credentials, copayers) {
    $.checkState(credentials.walletPrivKey);
    var walletPubKey = Bitcore.PrivateKey.fromString(credentials.walletPrivKey).toPublicKey().toString();

    if (copayers.length != credentials.n) {
      log.error('Missing public keys in server response');
      return false;
    }

    // Repeated xpub kes?
    var uniq = [];
    var error;
    _.each(copayers, (copayer) => {
      if (error) return;

      if (uniq[copayers.xPubKey]++) {
        log.error('Repeated public keys in server response');
        error = true;
      }

      // Not signed pub keys
      if (!(copayer.encryptedName || copayer.name) || !copayer.xPubKey || !copayer.requestPubKey || !copayer.signature) {
        log.error('Missing copayer fields in server response');
        error = true;
      } else {
        var hash = utils.getCopayerHash(copayer.encryptedName || copayer.name, copayer.xPubKey, copayer.requestPubKey);
        if (!utils.verifyMessage(hash, copayer.signature, walletPubKey)) {
          log.error('Invalid signatures in server response');
          error = true;
        }
      }
    });

    if (error) return false;

    if (!_.includes(_.map(copayers, 'xPubKey'), credentials.xPubKey)) {
      log.error('Server response does not contains our public keys');
      return false;
    }
    return true;
  }

  checkProposalCreation(args, txp, encryptingKey) {

    if (txp.outputs.length != args.outputs.length) return false;

    for (var i = 0; i < txp.outputs.length; i++) {
      var o1 = txp.outputs[i];
      var o2 = args.outputs[i];
      if (!this.strEqual(o1.toAddress, o2.toAddress)) return false;
      if (!this.strEqual(o1.script, o2.script)) return false;
      if (o1.amount != o2.amount) return false;
      var decryptedMessage = null;
      try {
        decryptedMessage = utils.decryptMessage(o2.message, encryptingKey);
      } catch (e) {
        return false;
      }
      if (!this.strEqual(o1.message, decryptedMessage)) return false;
    }

    var changeAddress;
    if (txp.changeAddress) {
      changeAddress = txp.changeAddress.address;
    }
    if (args.changeAddress && !this.strEqual(changeAddress, args.changeAddress)) return false;
    if (_.isNumber(args.feePerKb) && (txp.feePerKb != args.feePerKb)) return false;
    if (!this.strEqual(txp.payProUrl, args.payProUrl)) return false;

    var decryptedMessage = null;
    try {
      decryptedMessage = utils.decryptMessage(args.message, encryptingKey);
    } catch (e) {
      return false;
    }
    if (!this.strEqual(txp.message, decryptedMessage)) return false;
    if ((args.customData || txp.customData) && !_.isEqual(txp.customData, args.customData)) return false;

    return true;
  }

  strEqual(str1, str2) {
    return ((!str1 && !str2) || (str1 === str2));
  }
  checkTxProposalSignature(credentials, txp) {
    $.checkArgument(txp.creatorId);
    $.checkState(credentials.isComplete());

    var creatorKeys = _.find(credentials.publicKeyRing, (item) => {
      if (utils.xPubToCopayerId(txp.coin || 'btc', item.xPubKey) === txp.creatorId) return true;
    });

    if (!creatorKeys) return false;
    var creatorSigningPubKey;

    // If the txp using a selfsigned pub key?
    if (txp.proposalSignaturePubKey) {

      // Verify it...
      if (!utils.verifyRequestPubKey(txp.proposalSignaturePubKey, txp.proposalSignaturePubKeySig, creatorKeys.xPubKey))
        return false;

      creatorSigningPubKey = txp.proposalSignaturePubKey;
    } else {
      creatorSigningPubKey = creatorKeys.requestPubKey;
    }
    if (!creatorSigningPubKey) return false;

    var hash;
    if (parseInt(txp.version) >= 3) {
      var t = utils.buildTx(txp);
      hash = t.uncheckedSerialize();
    } else {
      throw new Error('Transaction proposal not supported');
    }

    log.debug('Regenerating & verifying tx proposal hash -> Hash: ', hash, ' Signature: ', txp.proposalSignature);
    if (!utils.verifyMessage(hash, txp.proposalSignature, creatorSigningPubKey))
      return false;

    if (!this.checkAddress(credentials, txp.changeAddress))
      return false;

    return true;
  }

  checkPaypro(txp, payproOpts) {
    var toAddress, amount, feeRate;

    if (parseInt(txp.version) >= 3) {
      toAddress = txp.outputs[0].toAddress;
      amount = txp.amount;
      if (txp.feePerKb) {
        feeRate = txp.feePerKb / 1024;
      }
    } else {
      toAddress = txp.toAddress;
      amount = txp.amount;
    }

    if (amount != payproOpts.amount)
      return false;

    if (txp.coin == 'btc' && toAddress != payproOpts.toAddress)
      return false;

    // Workaround for cashaddr/legacy address problems...
    if (txp.coin == 'bch' && (new BCHAddress(toAddress).toString()) != (new BCHAddress(payproOpts.toAddress).toString()))
      return false;

    // this generates problems...
    //  if (feeRate && payproOpts.requiredFeeRate &&
    //      feeRate < payproOpts.requiredFeeRate)
    //  return false;

    return true;
  }

  /**
   * Check transaction proposal
   *
   * @param {Function} credentials
   * @param {Object} txp
   * @param {Object} Optional: paypro
   * @param {Boolean} isLegit
   */
  checkTxProposal(credentials, txp, opts) {
    opts = opts || {};

    if (!this.checkTxProposalSignature(credentials, txp))
      return false;

    if (opts.paypro && !this.checkPaypro(txp, opts.paypro))
      return false;

    return true;
  }
}