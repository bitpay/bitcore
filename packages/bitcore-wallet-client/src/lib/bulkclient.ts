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
      headers['x-identities'] = this.credentials.map(cred => cred.copayerId).join(',');
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
          return cred && cred.isComplete() && cred.requestPrivKey == this.credentials[0].requestPrivKey;
        }),
        failureMessage || 'All credentials must be complete'
      );
    }
  }

  // /**
  // * Get wallet balance for all wallets
  // *
  // * @param {credentials} { requestPrivKey: string, copayerIds: string[] }
  // * @param {Callback} cb
  // */
  getBalanceAll(credentials, cb) {
    // parse out all of the credentials from each of the clients
    this.setCredentials(credentials);

    this.checkStateOfMultipleCredentials(
      'Failed state: this.credentials at <getBalanceAll()>'
    );

    return this.get('/v1/balance/all/', cb);
  }
}
