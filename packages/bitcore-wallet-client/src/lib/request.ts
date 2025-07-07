import request from 'superagent';
import util from 'util';
import Package from '../../package.json';
import { Utils } from './common';
import { Credentials } from './credentials';
import { Errors } from './errors';
import log from './log';

interface Headers {
  'x-client-version': string;
  'x-wallet-id'?: string;
  'x-identity'?: string;
  'x-session'?: string;
  'x-signature'?: string;
};

type RequestCallback = (err: any, body?: any, header?: any) => void;

export interface RequestResponse<ResponseBody = any, ResponseHeader = any> {
  body: ResponseBody;
  header: ResponseHeader;
};

export class Request<CredT = Credentials> {
  baseUrl: string;
  session: any;
  r: Request;
  credentials: CredT;
  supportStaffWalletId: string;
  timeout: number;

  constructor(url?, opts?) {
    opts = opts || {};
    this.baseUrl = url;

    this.r = opts.r || request;
    this.supportStaffWalletId = opts.supportStaffWalletId;

    this.session = null;
    this.credentials = null;
  }

  setCredentials(credentials: CredT) {
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
      headers['x-identity'] = (this.credentials as Credentials).copayerId;

      if (useSession && this.session) {
        headers['x-session'] = this.session;
      } else {
        const { _requestPrivKey, ...params } = signingParams;
        const privKey = _requestPrivKey || (this.credentials as Credentials).requestPrivKey;
        if (privKey) {
          headers['x-signature'] = this._signRequest({ ...params, privKey });
        }
      }
    }
  }

  /**
   * @description sign an HTTP request
   * @private
   * @param {object} params
   * @param {string} params.method the HTTP method
   * @param {string} params.url the URL for the request
   * @param {string} params.privKey private key to sign the request
   * @param {object} [params.args] a POST/PUT request's body, or a GET request's query(ies)
   */
  _signRequest({ method, url, args, privKey }) {
    var message = `${method.toLowerCase()}|${url}|${JSON.stringify(args)}`;
    return Utils.signMessage(message, privKey);
  }

  /**
   * Base request function
   * @param {string} method HTTP method
   * @param {string} url the URL for the request
   * @param {object} [args] a POST/PUT request's body, or a GET request's query(ies)
   * @param {boolean} [useSession] 
   * @param {RequestCallback} [cb] callback function
   * @returns
   */
  async doRequest<ReqBodyT, ResBodyT>(method: string, url: string, args: ReqBodyT, useSession?: boolean, cb?: RequestCallback): Promise<RequestResponse<ResBodyT>> {
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
      const retval = await new Promise<RequestResponse<ResBodyT>>((resolve, reject) => {
        r.end((err, res) => {
          if (!res) {
            return reject(new Errors.CONNECTION_ERROR());
          }

          if (res.body)
            log.debug(util.inspect(res.body, { depth: 10 }));

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
      if (cb) cb(null, retval.body, retval.header);
      return retval;
    } catch (err) {
      if (cb) { cb(err); return {} as RequestResponse; }
      throw err;
    }
  }

  /**
   * Parse errors
   * @private
   * @param {object} body 
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
   * @param {object} [body] 
   * @param {RequestCallback} [cb] callback function
   * @returns 
   */
  async post<ReqBodyT = object, ResBodyT = any>(url: string, body?: ReqBodyT, cb?: RequestCallback) {
    body = body || {} as ReqBodyT;
    return this.doRequest<ReqBodyT, ResBodyT>('post', url, body, false, cb);
  }

  /**
   * Do a PUT request
   * @param {string} url 
   * @param {object} [body] 
   * @param {RequestCallback} [cb] callback function
   * @returns 
   */
  async put<ReqBodyT = object, ResBodyT = any>(url: string, body?: ReqBodyT, cb?: RequestCallback) {
    body = body || {} as ReqBodyT;
    return this.doRequest<ReqBodyT, ResBodyT>('put', url, body, false, cb);
  }

  /**
   * Do a GET request
   * @param {string} url 
   * @param {RequestCallback} [cb] callback function
   * @returns 
   */
  async get<ResBodyT = any>(url: string, cb?: RequestCallback) {
    url += url.indexOf('?') > 0 ? '&' : '?';
    url += 'r=' + Math.round(Math.random() * 100000);

    return this.doRequest<object, ResBodyT>('get', url, {}, false, cb);
  }

  /**
   * Do a DELETE request
   * @param {string} url URL to request
   * @param {RequestCallback} [cb] callback function
   * @returns 
   */
  async delete<ResBodyT = any>(url: string, cb?: RequestCallback) {
    return this.doRequest<object, ResBodyT>('delete', url, {}, false, cb);
  }

  getWithLogin(url: string, cb?: RequestCallback) {
    url += url.indexOf('?') > 0 ? '&' : '?';
    url += 'r=' + Math.round(Math.random() * 100000);
    return this.doRequestWithLogin('get', url, {}, cb);
  }

  async _login(cb?: RequestCallback) {
    return this.post('/v1/login', {}, cb);
  }

  async logout(cb?: RequestCallback) {
    return this.post('/v1/logout', {}, cb);
  }

  /**
   * Do an HTTP request
   * @param {string} method HTTP method
   * @param {string} url URL to request
   * @param {object} [body] a POST/PUT request's body
   * @param {RequestCallback} [cb] callback function
   * @param {boolean} [_retry] Retry if auth fails. Only used internally - do not set this parameter
   */
  async doRequestWithLogin<ReqBodyT = object, ResBodyT = any>(method: string, url: string, body: ReqBodyT, cb?: RequestCallback, _retry = true): Promise<RequestResponse<ResBodyT>> {
    try {
      if (!this.session) {
        await this.doLogin();
      }
      const result = await this.doRequest<ReqBodyT, ResBodyT>(method, url, body, true) as RequestResponse;
      if (cb) { cb(null, result.body, result.header); }
      return result;
    } catch (err) {
      if (err instanceof Errors.NOT_AUTHORIZED && _retry) {
        this.session = null;
        return this.doRequestWithLogin<ReqBodyT, ResBodyT>(method, url, body, cb, false);
      }
      if (cb) cb(err);
      else throw err; 
    }
  }

  async doLogin(cb?: (err?: Error) => void) {
    try {
      const s = await this._login() as RequestResponse;
      if (!s?.body) throw new Errors.NOT_AUTHORIZED();
      this.session = s.body;
      if (cb) return cb();
    } catch (err) {
      if (!cb) throw err;
      return cb(err);
    }
  }
}
