'use strict';

import { singleton } from 'preconditions';
import { API } from './api';
import { Utils } from './common';
import { Request } from './request';

const $ = singleton();

export class BulkClient extends Request {
  /**
   * BulkClient constructor
   * @param {String} url base URL for client
   * @param {Object} opts configuration values
   * @constructor
   */
  constructor(url?, opts?) {
    super(url, opts);
  }

  /**
   * Override the existing method to use multiple credentials
   * @override
   */
  _populateAuth(
    headers: any,
    signingParams: { method: string; url: string; args: any }
  ) {
    if (this.credentials && this.credentials.length) {
      headers['x-identities'] = this.credentials
        .map(cred => cred.copayerId)
        .join(',');
      headers['x-signature'] = this._signRequest({
        ...signingParams,
        privKey: this.credentials[0].requestPrivKey
      });
    }
  }

  checkStateOfMultipleCredentials(failureMessage, opts) {
    if (!opts) opts = {};
    if (this.credentials && this.credentials.length > 0) {
      $.checkState(
        this.credentials.every(cred => {
          return (
            cred &&
            (opts.ignoreIncomplete || cred.isComplete()) &&
            cred.requestPrivKey == this.credentials[0].requestPrivKey
          );
        }),
        failureMessage || 'All credentials must be complete'
      );
    }
  }

  /**
   * Get wallet balance for all wallets
   * @param {Credentials} credentials { requestPrivKey: string, copayerIds: string[] }
   * @param {Object} opts
   * @param {boolean} [opts.includeExtendedInfo]
   * @param {boolean} [opts.twoStep]
   * @param {boolean} [opts.silentFailure]
   * @param {Object} [opts.wallets]
   * @param {string} [opts.wallets.copayerId]
   * @param {string} [opts.wallets.copayerId.tokenAddress]
   * @param {string} [opts.wallets.copayerId.multisigContractAddress]
   * @param {function} cb Callback function in the standard form (err, results)
   * @returns
   */
  getStatusAll(credentials, opts, cb) {
    if (!cb) {
      cb = opts;
      opts = {};
    }

    this.setCredentials(credentials);

    var qs = [];
    qs.push('includeExtendedInfo=' + (opts.includeExtendedInfo ? '1' : '0'));
    qs.push('twoStep=' + (opts.twoStep ? '1' : '0'));
    qs.push('serverMessageArray=1');
    qs.push('silentFailure=' + (opts.silentFailure ? '1' : '0'));

    let wallets = opts.wallets;
    if (wallets) {
      Object.keys(wallets).forEach(copayerId => {
        if (wallets[copayerId].tokenAddresses) {
          wallets[copayerId].tokenAddresses.forEach(address => {
            qs.push(`${copayerId}:tokenAddress=` + address);
          });
        }

        if (wallets[copayerId].multisigContractAddress) {
          qs.push(
            `${copayerId}:multisigContractAddress=` +
              wallets[copayerId].multisigContractAddress
          );
          qs.push(
            `${copayerId}:network=` +
              this.credentials.find(cred => cred.copayerId == copayerId).network
          );
        }
      });
    }

    this.checkStateOfMultipleCredentials('Failed state: this.credentials at <getStatusAll()>', { ignoreIncomplete: opts.ignoreIncomplete });

    return this.get('/v1/wallets/all/?' + qs.join('&'), (err, results) => {
      if (err || !results) return cb(err, results);

      [].concat(results).forEach(result => {
        if (result.success) {
          var status = result.status;
          var walletId = result.walletId;
          var c = this.credentials.find(cred => cred.walletId == walletId);
          if (c && status.wallet.status == 'pending') {
            result.wallet.secret = API._buildSecret(
              c.walletId,
              c.walletPrivKey,
              c.coin,
              c.network
            );
          }
          if (c) this._processStatus(status, c);
        }
      });
      return cb(null, results);
    });
  }

  _processStatus(status, c) {
    var processCustomData = (data, c) => {
      const copayers = data.wallet.copayers;
      if (!copayers) return;

      const me = copayers.find(copayer => copayer.id == c.copayerId);
      if (!me || !me.customData) return;

      var customData;
      try {
        customData = JSON.parse(
          Utils.decryptMessage(me.customData, c.personalEncryptingKey)
        );
      } catch (e) {}
      if (!customData) return;

      // Add it to result
      data.customData = customData;

      // Update walletPrivateKey
      if (!c.walletPrivKey && customData.walletPrivKey)
        c.addWalletPrivateKey(customData.walletPrivKey);
    };

    processCustomData(status, c);
    this._processWallet(status.wallet, c);
    this._processTxps(status.pendingTxps, c);
  }

  _processWallet(wallet, c) {
    var encryptingKey = c.sharedEncryptingKey;

    var name = Utils.decryptMessageNoThrow(wallet.name, encryptingKey);
    if (name != wallet.name) {
      wallet.encryptedName = wallet.name;
    }
    wallet.name = name;
    for (const copayer of wallet.copayers || []) {
      var name = Utils.decryptMessageNoThrow(copayer.name, encryptingKey);
      if (name != copayer.name) {
        copayer.encryptedName = copayer.name;
      }
      copayer.name = name;
      for (const access of copayer.requestPubKeys || []) {
        if (!access.name) return;

        var name = Utils.decryptMessageNoThrow(access.name, encryptingKey);
        if (name != access.name) {
          access.encryptedName = access.name;
        }
        access.name = name;
      }
    }
  }

  _processTxps(txps, c) {
    if (!txps) return;

    const encryptingKey = c.sharedEncryptingKey;
    for (const txp of [].concat(txps)) {
      txp.encryptedMessage = txp.message;
      txp.message =
        Utils.decryptMessageNoThrow(txp.message, encryptingKey) || null;
      txp.creatorName = Utils.decryptMessageNoThrow(
        txp.creatorName,
        encryptingKey
      );

      for (const action of txp.actions || []) {
        // CopayerName encryption is optional (not available in older wallets)
        action.copayerName = Utils.decryptMessageNoThrow(
          action.copayerName,
          encryptingKey
        );

        action.comment = Utils.decryptMessageNoThrow(
          action.comment,
          encryptingKey
        );
        // TODO get copayerName from Credentials -> copayerId to copayerName
        // action.copayerName = null;
      }
      for (const output of txp.outputs || []) {
        output.encryptedMessage = output.message;
        output.message =
          Utils.decryptMessageNoThrow(output.message, encryptingKey) || null;
      }
      txp.hasUnconfirmedInputs = (txp.inputs || []).some(input => input.confirmations == 0);
      this._processTxNotes(txp.note, c);
    }
  }

  _processTxNotes(notes, c) {
    if (!notes) return;

    var encryptingKey = c.sharedEncryptingKey;
    for (const note of [].concat(notes)) {
      note.encryptedBody = note.body;
      note.body = Utils.decryptMessageNoThrow(note.body, encryptingKey);
      note.encryptedEditedByName = note.editedByName;
      note.editedByName = Utils.decryptMessageNoThrow(
        note.editedByName,
        encryptingKey
      );
    }
  }
}
