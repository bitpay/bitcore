import request from 'superagent';
import util from 'util';
import { Utils } from './common';
import { Errors } from './errors';
import log from './log';

const Package = require('../../package.json');
interface Headers {
  'x-client-version': string;
  'x-wallet-id'?: string;
  'x-identity'?: string;
  'x-session'?: string;
  'x-signature'?: string;
};

export class Request {
  baseUrl: any;
  session: any;
  r: any;
  credentials: any;
  supportStaffWalletId: any;
  timeout: any;

  constructor(url?, opts?) {
    this.baseUrl = url;

    this.r = opts.r || request;
    this.supportStaffWalletId = opts.supportStaffWalletId;

    this.session = null;
    this.credentials = null;
  }

  setCredentials(credentials) {
    this.credentials = credentials;
  }

  getHeaders(method: string, url: string, args: any, useSession?: boolean): Headers {
    var headers = {
      'x-client-version': 'bwc-' + Package.version
    };
    if (this.supportStaffWalletId) {
      headers['x-wallet-id'] = this.supportStaffWalletId;
    }

    this._populateAuth(headers, { method, url, args }, useSession);

    return headers;
  }

  _populateAuth(
    headers: any,
    signingParams: {
      method: string;
      url: string;
      args: any;
      _requestPrivKey?: string;
    },
    useSession?: boolean
  ) {
    if (this.credentials) {
      headers['x-identity'] = this.credentials.copayerId;

      if (useSession && this.session) {
        headers['x-session'] = this.session;
      } else {
        const { _requestPrivKey, ...params } = signingParams;
        const privKey = _requestPrivKey || this.credentials.requestPrivKey;
        if (privKey) {
          headers['x-signature'] = this._signRequest({ ...params, privKey });
        }
      }
    }
  }

  /**
   * @description sign an HTTP request
   * @private
   * @param {Object} params
   * @param {String} params.method the HTTP method
   * @param {String} params.url the URL for the request
   * @param {String} params.privKey private key to sign the request
   * @param {Object} [params.args] a POST/PUT request's body, or a GET request's query(ies)
   */
  _signRequest({ method, url, args, privKey }) {
    var message = `${method.toLowerCase()}|${url}|${JSON.stringify(args)}`;
    return Utils.signMessage(message, privKey);
  }

  /**
   * Base request function
   * @param {string} method HTTP method
   * @param {string} url the URL for the request
   * @param {Object} [args] a POST/PUT request's body, or a GET request's query(ies)
   * @param {boolean} [useSession] 
   * @param {function} [cb] callback function
   * @returns
   */
  async doRequest(method, url, args, useSession, cb?): Promise<{ body: any; header: any }> {
    var headers = this.getHeaders(method, url, args, useSession);

    var r = this.r[method](this.baseUrl + url);
    r.accept('json');

    for (const [k, v] of Object.entries(headers)) {
      if (v) r.set(k, v);
    }

    if (args) {
      if (method == 'post' || method == 'put') {
        r.send(args);
      } else {
        r.query(args);
      }
    }

    r.timeout(this.timeout);

    try {
      const retval = await new Promise<{ body: any; header: any; }>((resolve, reject) => {
        r.end((err, res) => {
          if (!res) {
            return reject(new Errors.CONNECTION_ERROR());
          }

          if (res.body)
            log.debug(
              util.inspect(res.body, {
                depth: 10
              })
            );

          if (res.status !== 200) {
            if (res.status === 503) return reject(new Errors.MAINTENANCE_ERROR());
            if (res.status === 404) return reject(new Errors.NOT_FOUND());
            if (res.status === 413) return reject(new Errors.PAYLOAD_TOO_LARGE());
            if (!res.status) return reject(new Errors.CONNECTION_ERROR());

            log.error('HTTP Error:' + res.status);

            if (!res.body || !Object.keys(res.body).length)
              return reject(new Error(res.status + `${err?.message ? ': ' + err.message : ''}`));
            return reject(Request._parseError(res.body));
          }

          if (res.body === '{"error":"read ECONNRESET"}')
            return reject(new Errors.ECONNRESET_ERROR(JSON.parse(res.body)));

          return resolve({ body: res.body, header: res.header });
        });
      });
      if (cb) return cb(null, retval.body, retval.header);
      return retval;
    } catch (err) {
      if (cb) return cb(err);
      throw err;
    }
  }

  /**
   * Parse errors
   * @private
   * @param {Object} body 
   * @returns 
   */
  static _parseError(body) {
    if (!body) return;

    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {
          error: body
        };
      }
    }
    let ret;
    if (body.code) {
      if (Errors[body.code]) {
        ret = new Errors[body.code]();
        if (body.message) ret.message = body.message;
        if (body.messageData) ret.messageData = body.messageData;
      } else {
        ret = new Error(
          body.code +
            ': ' +
            (body.message && typeof body.message === 'object'
              ? JSON.stringify(body.message)
              : body.message ?? 'Unknown BWC request error')
        );
      }
    } else {
      ret = new Error(body.error || JSON.stringify(body));
    }
    log.error(ret);
    return ret;
  }

  /**
   * Do a POST request
   * @private
   * @param {string} url 
   * @param {Object} [body] 
   * @param {function} [cb] callback function
   * @returns 
   */
  async post(url, body?, cb?) {
    body = body || {};
    return this.doRequest('post', url, body, false, cb);
  }

  /**
   * Do a PUT request
   * @param {string} url 
   * @param {Object} [body] 
   * @param {function} [cb] callback function
   * @returns 
   */
  async put(url, body?, cb?) {
    body = body || {};
    return this.doRequest('put', url, body, false, cb);
  }

  /**
   * Do a GET request
   * @param {string} url 
   * @param {function} [cb] callback function
   * @returns 
   */
  async get(url, cb?) {
    url += url.indexOf('?') > 0 ? '&' : '?';
    url += 'r=' + Math.round(Math.random() * 100000);

    return this.doRequest('get', url, {}, false, cb);
  }

  /**
   * Do a DELETE request
   * @param {string} url URL to request
   * @param {function} [cb]
   * @returns 
   */
  async delete(url, cb?) {
    return this.doRequest('delete', url, {}, false, cb);
  }

  getWithLogin(url, cb) {
    url += url.indexOf('?') > 0 ? '&' : '?';
    url += 'r=' + Math.round(Math.random() * 100000);
    return this.doRequestWithLogin('get', url, {}, cb);
  }

  async _login(cb?) {
    return this.post('/v1/login', {}, cb);
  }

  async logout(cb?) {
    return this.post('/v1/logout', {}, cb);
  }

  /**
   * Do an HTTP request
   * @param {string} method HTTP method
   * @param {string} url URL to request
   * @param {Object} [body] a POST/PUT request's body
   * @param {function} [cb]
   * @param {boolean} [retry] 
   */
  async doRequestWithLogin(method, url, body, cb?, retry = true) {
    try {
      if (!this.session) {
        await this.doLogin();
      }
      const result = await this.doRequest(method, url, body, true);
      if (cb) return cb(null, result.body, result.header);
      return result;
    } catch (err) {
      if (err instanceof Errors.NOT_AUTHORIZED && retry) {
        this.session = null;
        return this.doRequestWithLogin(method, url, body, cb, false);
      }
      if (!cb) throw err;
      return cb(err); 
    }
  }

  async doLogin(cb?) {
    try {
      const s = await this._login();
      if (!s?.body) throw new Errors.NOT_AUTHORIZED();
      this.session = s.body;
      if (cb) return cb();
    } catch (err) {
      if (!cb) throw err;
      return cb(err);
    }
  }
}
