const _ = require('lodash');
const request = require('superagent');
const async = require('async');
const Package = require('../package.json');
const log = require('./log');
const util = require('util');
const Errors = require('./errors');
const Common = require('./common');
const Utils = Common.Utils;

function Request(url, opts) {
  this.baseUrl = url;

  // request can be overload only for testing
  this.r =  opts.r || request;

  this.session = null;
  this.credentials = null;
};


Request.prototype.setCredentials = function(credentials) {
  this.credentials = credentials;
};

Request.prototype.getHeaders = function(method, url, args) {
  var headers = {
    'x-client-version': 'bwc-' + Package.version,
  };
  if (this.supportStaffWalletId) {
    headers['x-wallet-id'] = this.supportStaffWalletId;
  }

  return headers;
};

/**
 * Sign an HTTP request
 * @private
 * @static
 * @memberof Client.API
 * @param {String} method - The HTTP method
 * @param {String} url - The URL for the request
 * @param {Object} args - The arguments in case this is a POST/PUT request
 * @param {String} privKey - Private key to sign the request
 */
Request._signRequest = function(method, url, args, privKey) {
  var message = [method.toLowerCase(), url, JSON.stringify(args)].join('|');
  return Utils.signMessage(message, privKey);
};



/**
 * Do an HTTP request
 * @private
 *
 * @param {Object} method
 * @param {String} url
 * @param {Object} args
 * @param {Callback} cb
 */
Request.prototype.doRequest = function(method, url, args, useSession, cb) {
  var self = this;

  var headers = self.getHeaders(method, url, args);

  if (self.credentials) {
    headers['x-identity'] = self.credentials.copayerId;

    if (useSession && self.session) {
      headers['x-session'] = self.session;
    } else {
      var reqSignature;
      var key = args._requestPrivKey || self.credentials.requestPrivKey;
      if (key) {
        delete args['_requestPrivKey'];
        reqSignature = Request._signRequest(method, url, args, key);
      }
      headers['x-signature'] = reqSignature;
    }
  }

  var r = self.r[method](self.baseUrl + url);
  r.accept('json');

  _.each(headers, function(v, k) {
    if (v) r.set(k, v);
  });

  if (args) {
    if (method == 'post' || method == 'put') {
      r.send(args);

    } else {
      r.query(args);
    }
  }

  r.timeout(self.timeout);

  r.end(function(err, res) {
    if (!res) {
      return cb(new Errors.CONNECTION_ERROR);
    }

    if (res.body)

      log.debug(util.inspect(res.body, {
        depth: 10
      }));

    if (res.status !== 200) {
      if (res.status === 404)
        return cb(new Errors.NOT_FOUND);

      if (!res.status)
        return cb(new Errors.CONNECTION_ERROR);

      log.error('HTTP Error:' + res.status);

      if (!res.body)
        return cb(new Error(res.status));

      return cb(Request._parseError(res.body));
    }

    if (res.body === '{"error":"read ECONNRESET"}')
      return cb(new Errors.ECONNRESET_ERROR(JSON.parse(res.body)));

    return cb(null, res.body, res.header);
  });
};

/**
 * Parse errors
 * @private
 * @static
 * @memberof Client.API
 * @param {Object} body
 */
Request._parseError = function(body) {
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
      ret = new Errors[body.code];
      if (body.message) ret.message = body.message;
    } else {
      ret = new Error(body.code + ': ' + (_.isObject(body.message) ? JSON.stringify(body.message) : body.message) );
    }
  } else {
    ret = new Error(body.error || JSON.stringify(body));
  }
  log.error(ret);
  return ret;
};




/**
 * Do a POST request
 * @private
 *
 * @param {String} url
 * @param {Object} args
 * @param {Callback} cb
 */
Request.prototype.post = function(url, args, cb) {
  return this.doRequest('post', url, args, false, cb);
};

Request.prototype.put = function(url, args, cb) {
  return this.doRequest('put', url, args, false, cb);
};

/**
 * Do a GET request
 * @private
 *
 * @param {String} url
 * @param {Callback} cb
 */
Request.prototype.get = function(url, cb) {
  url += url.indexOf('?') > 0 ? '&' : '?';
  url += 'r=' + _.random(10000, 99999);
  return this.doRequest('get', url, {}, false, cb);
};

Request.prototype.getWithLogin = function(url, cb) {
  url += url.indexOf('?') > 0 ? '&' : '?';
  url += 'r=' + _.random(10000, 99999);
  return this.doRequestWithLogin('get', url, {}, cb);
};


Request.prototype._login = function(cb) {
  this.post('/v1/login', {}, cb);
};

Request.prototype.logout = function(cb) {
  this.post('/v1/logout', {}, cb);
};


/**
 * Do an HTTP request
 * @private
 *
 * @param {Object} method
 * @param {String} url
 * @param {Object} args
 * @param {Callback} cb
 */
Request.prototype.doRequestWithLogin = function(method, url, args, cb) {
  var self = this;

  function doLogin(cb) {
    self._login(function(err, s) {
      if (err) return cb(err);
      if (!s) return cb(new Errors.NOT_AUTHORIZED);
      self.session = s;
      cb();
    });
  };

  async.waterfall([

    function(next) {
      if (self.session) return next();
      doLogin(next);
    },
    function(next) {
      self.doRequest(method, url, args, true, function(err, body, header) {
        if (err && err instanceof Errors.NOT_AUTHORIZED) {
          doLogin(function(err) {
            if (err) return next(err);
            return self.doRequest(method, url, args, true, next);
          });
        }
        next(null, body, header);
      });
    },
  ], cb);
};
/**
 * Do a DELETE request
 * @private
 *
 * @param {String} url
 * @param {Callback} cb
 */
Request.prototype.delete = function(url, cb) {
  return this.doRequest('delete', url, {}, false, cb);
};




module.exports = Request;

