/**
 * The official client library for bitcore-wallet-service.
 * @module Client
 */

/**
 * Client API.
 * @alias module:Client.API
 */
/**
 * Verifier module.
 * @alias module:Client.Verifier
 */
var sjcl = require('sjcl');

// Expose bitcore
var Bitcore = require('bitcore-lib');
var BitcoreCash = require('bitcore-lib-cash');
// client.Core = require('crypto-wallet-core');

import { API } from './api';
import { Utils } from './common/utils';
import { Credentials } from './credentials';
import { Key } from './key';
import { PayPro } from './paypro';
import { Request } from './request';
import { Verifier } from './verifier';

const Client = {
  API,
  Verifier,
  Key,
  Utils,
  sjcl,
  Bitcore,
  BitcoreCash,
  Credentials,
  Request,
  PayPro
};

module.exports = Client;
