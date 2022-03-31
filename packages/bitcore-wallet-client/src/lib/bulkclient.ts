'use strict';

import _ from 'lodash';
import { Utils } from './common';

const request = require('superagent');
var log = require('./log');
var $ = require('preconditions').singleton();
const util = require('util');
var Errors = require('./errors');
const Package = require('../../package.json');

// /**
// * @desc BulkClient constructor.
// *
// * @param {Object} opts
// * @constructor
// */
export class BulkClient {
    baseUrl: any;
    session: any;
    r: any;
    supportStaffWalletId: any;
    timeout: any;
    credentials: any[];

    constructor(url?, opts?) {
        this.baseUrl = url;

        this.r = opts.r || request;
        this.supportStaffWalletId = opts.supportStaffWalletId;

        this.session = null;
        this.credentials = null;
    }

    setCredentials(credentials: any[]) {
        this.credentials = credentials;
    }

    getHeaders(method, url, args) {
        var headers = {
            'x-client-version': 'bwc-' + Package.version
        };
        if (this.supportStaffWalletId) {
            headers['x-wallet-id'] = this.supportStaffWalletId;
        }

        return headers;
    }

    // /**
    // * Get wallet balance for all wallets
    // *
    // * @param {Clients} clients - an array of client instances
    // * @param {String} opts.multisigContractAddress optional: MULTISIG ETH Contract Address
    // * @param {Callback} cb
    // */
    getBalanceAll(clients, cb) {
        //parse out all of the credentials from each of the clients
        var credentials = _.map(clients, 'credentials');
        this.setCredentials(credentials);

        this.checkStateOfMultipleCredentials('Failed state: this.credentials at <getBalanceAll()>');

        var url = '/v1/balance/all/';
        return this.getWithMultipleCredentials(url, cb);
    }

    getWithMultipleCredentials(url, cb) {
        url += url.indexOf('?') > 0 ? '&' : '?';
        url += 'r=' + _.random(10000, 99999);

        return this.doRequestWithMultipleCredentials('get', url, {}, cb);
    }

    checkStateOfMultipleCredentials(failureMessage) {
        if (this.credentials && this.credentials.length > 0) {
            this.credentials.forEach(cred => {
                $.checkState(
                    cred && cred.isComplete(),
                    failureMessage || 'All credentials must be complete'
                );
            });
        }
    }

    //  Sign an HTTP request
    //  @private
    //  @static
    //  @memberof BulkClient
    //  @param {String} method - The HTTP method
    //  @param {String} url - The URL for the request
    //  @param {Object} args - The arguments in case this is a POST/PUT request
    //  @param {String} privKey - Private key to sign the request
    static _signRequest(method, url, args, privKey) {
        var message = [method.toLowerCase(), url, JSON.stringify(args)].join('|');
        return Utils.signMessage(message, privKey);
    }

    //  Do an HTTP request with multiple credentials
    //  @private
    //
    //  @param {Object} method
    //  @param {String} url
    //  @param {Object} args
    //  @param {Callback} cb
    doRequestWithMultipleCredentials(method, url, args, cb) {
        var headers = this.getHeaders(method, url, args);

        if (this.credentials && this.credentials.length > 0) {
            headers['x-multi-credentials'] = JSON.stringify(this.credentials.map(cred => {
                return {
                    'x-identity': cred.copayerId,
                    'x-signature': BulkClient._signRequest(method, url, args, cred.requestPrivKey)
                }
            }));
        }

        var r = this.r[method](this.baseUrl + url);
        r.accept('json');

        _.each(headers, (v, k) => {
            if (v) r.set(k, v);
        });

        if (args) {
            if (method == 'post' || method == 'put') {
                r.send(args);
            } else {
                r.query(args);
            }
        }

        r.timeout(this.timeout);

        r.end((err, res) => {
            if (!res) {
                return cb(new Errors.CONNECTION_ERROR());
            }

            if (res.body)
                log.debug(
                    util.inspect(res.body, {
                        depth: 10
                    })
                );

            if (res.status !== 200) {
                if (res.status === 503) return cb(new Errors.MAINTENANCE_ERROR());
                if (res.status === 404) return cb(new Errors.NOT_FOUND());

                if (!res.status) return cb(new Errors.CONNECTION_ERROR());

                log.error('HTTP Error:' + res.status);

                if (!res.body) return cb(new Error(res.status));
                return cb(BulkClient._parseError(res.body));
            }

            if (res.body === '{"error":"read ECONNRESET"}')
                return cb(new Errors.ECONNRESET_ERROR(JSON.parse(res.body)));

            return cb(null, res.body, res.header);
        });
    }

    //  Parse errors
    //  @private
    //  @static
    //  @memberof Client.API
    //  @param {Object} body
    static _parseError(body) {
        if (!body) return;

        if (_.isString(body)) {
            try {
                body = JSON.parse(body);
            } catch (e) {
                body = {
                    error: body
                };
            }
        }
        var ret;
        if (body.code) {
            if (Errors[body.code]) {
                ret = new Errors[body.code]();
                if (body.message) ret.message = body.message;
                if (body.messageData) ret.messageData = body.messageData;
            } else {
                ret = new Error(
                    body.code +
                    ': ' +
                    (_.isObject(body.message)
                        ? JSON.stringify(body.message)
                        : body.message)
                );
            }
        } else {
            ret = new Error(body.error || JSON.stringify(body));
        }
        log.error(ret);
        return ret;
    }
}