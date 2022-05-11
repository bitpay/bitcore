'use strict';

import { Request } from './request';

const $ = require('preconditions').singleton();

export class BulkClient extends Request {
  /**
   * @description BulkClient constructor
   * @param {String} url base URL for client
   * @param {Object} opts configuration values
   * @constructor
   */
  constructor(url?, opts?) {
    super(url, opts);
  }

  /**
   * @description Override the existing method to use multiple credentials
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

  checkStateOfMultipleCredentials(failureMessage) {
    if (this.credentials && this.credentials.length > 0) {
      $.checkState(
        this.credentials.every(cred => {
          return (
            cred &&
            cred.isComplete() &&
            cred.requestPrivKey == this.credentials[0].requestPrivKey
          );
        }),
        failureMessage || 'All credentials must be complete'
      );
    }
  }

  // /**
  // * Get wallet balance for all wallets
  // *
  // * @param {credentials} { requestPrivKey: string, copayerIds: string[] }
  // * @param {Object} opts { includeExtendedInfo: boolean, twoStep: boolean, wallets: { :copayerId: { tokenAddress: string, multisigContractAddress: string} } }
  // * @param {Callback} cb
  // */
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

    let wallets = opts.wallets;
    if (wallets) {
      Object.keys(wallets).forEach(copayerId => {
        if (wallets[copayerId].tokenAddresses) {
          wallets[copayerId].tokenAddresses.forEach(address => {
            qs.push(`${copayerId}[tokenAddress]=` + address);
          });
        }

        if (wallets[copayerId].multisigContractAddress) {
          qs.push(
            `${copayerId}[multisigContractAddress]=` +
              wallets[copayerId].multisigContractAddress
          );
          qs.push(
            `${copayerId}[network]=` +
              this.credentials.find(cred => cred.copayerId == copayerId).network
          );
        }
      });
    }

    this.checkStateOfMultipleCredentials(
      'Failed state: this.credentials at <getStatusAll()>'
    );

    return this.get('/v1/wallets/all/?' + qs.join('&'), cb);
  }
}
