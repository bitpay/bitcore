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
      headers['x-multi-credentials'] = JSON.stringify(
        this.credentials.map(cred => ({
          'x-identity': cred.copayerId,
          'x-signature': this._signRequest({
            ...signingParams,
            privKey: cred.requestPrivKey
          })
        }))
      );
    }
  }

  checkStateOfMultipleCredentials(failureMessage) {
    if (this.credentials && this.credentials.length > 0) {
      $.checkState(
        this.credentials.every(cred => cred && cred.isComplete()),
        failureMessage || 'All credentials must be complete'
      );
    }
  }

  // /**
  // * Get wallet balance for all wallets
  // *
  // * @param {Clients} clients - an array of client instances
  // * @param {String} opts.multisigContractAddress optional: MULTISIG ETH Contract Address
  // * @param {Callback} cb
  // */
  getBalanceAll(clients, cb) {
    // parse out all of the credentials from each of the clients
    const credentials = clients.map(({ credentials }) => credentials);
    this.setCredentials(credentials);

    this.checkStateOfMultipleCredentials(
      'Failed state: this.credentials at <getBalanceAll()>'
    );

    return this.get('/v1/balance/all/', cb);
  }
}
