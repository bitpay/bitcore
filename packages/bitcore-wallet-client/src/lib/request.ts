import * as _ from 'lodash';
import { Utils } from './common';

const request = require('superagent');
const async = require('async');
const Package = require('../../package.json');
var log = require('./log');

const util = require('util');
var Errors = require('./errors');

export class Request {
  baseUrl: any;
  session: any;
  r: any;
  credentials: any;
  supportStaffWalletId: any;
  timeout: any;

  constructor(url?, opts?) {
    this.baseUrl = url;

    // request can be overload only for testing
    this.r = opts.r || request;
    this.supportStaffWalletId = opts.supportStaffWalletId;

    this.session = null;
    this.credentials = null;
  }

  setCredentials(credentials) {
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

  //  Sign an HTTP request
  //  @private
  //  @static
  //  @memberof Client.API
  //  @param {String} method - The HTTP method
  //  @param {String} url - The URL for the request
  //  @param {Object} args - The arguments in case this is a POST/PUT request
  //  @param {String} privKey - Private key to sign the request
  static _signRequest(method, url, args, privKey) {
    var message = [method.toLowerCase(), url, JSON.stringify(args)].join('|');
    return Utils.signMessage(message, privKey);
  }

  //  Do an HTTP request
  //  @private
  //
  //  @param {Object} method
  //  @param {String} url
  //  @param {Object} args
  //  @param {Callback} cb
  doRequest(method, url, args, useSession, cb) {
    var headers = this.getHeaders(method, url, args);

    if (this.credentials) {
      headers['x-identity'] = this.credentials.copayerId;

      if (useSession && this.session) {
        headers['x-session'] = this.session;
      } else {
        var reqSignature;
        var key = args._requestPrivKey || this.credentials.requestPrivKey;
        if (key) {
          delete args['_requestPrivKey'];
          reqSignature = Request._signRequest(method, url, args, key);
        }
        headers['x-signature'] = reqSignature;
      }
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
        return cb(Request._parseError(res.body));
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

  //  Do a POST request
  //  @private
  //
  //  @param {String} url
  //  @param {Object} args
  //  @param {Callback} cb
  post(url, args, cb) {
    return this.doRequest('post', url, args, false, cb);
  }

  put(url, args, cb) {
    return this.doRequest('put', url, args, false, cb);
  }

  //  Do a GET request
  //  @private
  //
  //  @param {String} url
  //  @param {Callback} cb
  get(url, cb) {
    url += url.indexOf('?') > 0 ? '&' : '?';
    url += 'r=' + _.random(10000, 99999);
    return this.doRequest('get', url, {}, false, cb);
  }

  getWithLogin(url, cb) {
    url += url.indexOf('?') > 0 ? '&' : '?';
    url += 'r=' + _.random(10000, 99999);
    return this.doRequestWithLogin('get', url, {}, cb);
  }

  _login(cb) {
    this.post('/v1/login', {}, cb);
  }

  logout(cb) {
    this.post('/v1/logout', {}, cb);
  }

  //  Do an HTTP request
  //  @private
  //
  //  @param {Object} method
  //  @param {String} url
  //  @param {Object} args
  //  @param {Callback} cb
  doRequestWithLogin(method, url, args, cb) {
    async.waterfall(
      [
        next => {
          if (this.session) return next();
          this.doLogin(next);
        },
        next => {
          this.doRequest(method, url, args, true, (err, body, header) => {
            if (err && err instanceof Errors.NOT_AUTHORIZED) {
              this.doLogin(err => {
                if (err) return next(err);
                return this.doRequest(method, url, args, true, next);
              });
            }
            next(null, body, header);
          });
        }
      ],
      cb
    );
  }

  doLogin(cb) {
    this._login((err, s) => {
      if (err) return cb(err);
      if (!s) return cb(new Errors.NOT_AUTHORIZED());
      this.session = s;
      cb();
    });
  }

  // Do a DELETE request
  // @private
  //
  // @param {String} url
  // @param {Callback} cb

  delete(url, cb) {
    return this.doRequest('delete', url, {}, false, cb);
  }
}
