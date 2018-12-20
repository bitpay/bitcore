'use strict';

var _ = require('lodash');
var async = require('async');
var log = require('npmlog');

var express = require('express');
var bodyParser = require('body-parser');
var compression = require('compression');
var RateLimit = require('express-rate-limit');

var Common = require('./common');
var Defaults = Common.Defaults;

var WalletService = require('./server');
var Stats = require('./stats');

log.disableColor();
log.debug = log.verbose;
log.level = 'verbose';

var ExpressApp = function() {
  this.app = express();
};

/**
 * start
 *
 * @param opts.WalletService options for WalletService class
 * @param opts.basePath
 * @param opts.disableLogs
 * @param {Callback} cb
 */
ExpressApp.prototype.start = function(opts, cb) {
  opts = opts || {};

  this.app.use(compression());

  this.app.use(function(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'x-signature,x-identity,x-session,x-client-version,x-wallet-id,X-Requested-With,Content-Type,Authorization');
    res.setHeader('x-service-version', WalletService.getServiceVersion());
    next();
  });
  var allowCORS = function(req, res, next) {
    if ('OPTIONS' == req.method) {
      res.sendStatus(200);
      res.end();
      return;
    }
    next();
  }
  this.app.use(allowCORS);
  this.app.enable('trust proxy');



  // handle `abort` https://nodejs.org/api/http.html#http_event_abort
  this.app.use(function(req, res, next) {
    req.on('abort', function() {
      log.warn('Request aborted by the client');
    });
    next();
  });

  var POST_LIMIT = 1024 * 100 /* Max POST 100 kb */ ;

  this.app.use(bodyParser.json({
    limit: POST_LIMIT
  }));

  if (opts.disableLogs) {
    log.level = 'silent';
  } else {
    var morgan = require('morgan');
    morgan.token('walletId', function getId(req) {
      return req.walletId ?  '<' + req.walletId + '>' :  '<>';
    });

    var logFormat = ':walletId :remote-addr :date[iso] ":method :url" :status :res[content-length] :response-time ":user-agent"  ';
    var logOpts = {
      skip: function(req, res) {
        if (res.statusCode != 200) return false;
        return req.path.indexOf('/notifications/') >= 0;
      }
    };
    this.app.use(morgan(logFormat, logOpts));
  }

  var router = express.Router();


  function returnError(err, res, req) {
    if (err instanceof WalletService.ClientError) {

      var status = (err.code == 'NOT_AUTHORIZED') ? 401 : 400;
      if (!opts.disableLogs)
        log.info('Client Err: ' + status + ' ' + req.url + ' ' + JSON.stringify(err));

      res.status(status).json({
        code: err.code,
        message: err.message,
      }).end();
    } else {

      var code = 500,
        message;
      if (_.isObject(err) && (_.isNumber(err.code) || _.isNumber(err.statusCode) ) ) {
        code = err.code || err.statusCode;
        message = err.message || err.body;
      }

      var m = message || err.toString();

      if (!opts.disableLogs)
        log.error(req.url + ' :' + code + ':' + m);

      res.status(code || 500).json({
        error: m,
      }).end();
    }
  };

  function logDeprecated(req) {
    log.warn('DEPRECATED', req.method, req.url, '(' + req.header('x-client-version') + ')');
  };

  function getCredentials(req) {
    var identity = req.header('x-identity');
    if (!identity) return;

    return {
      copayerId: identity,
      signature: req.header('x-signature'),
      session: req.header('x-session'),
    };
  };

  function getServer(req, res) {
    var opts = {
      clientVersion: req.header('x-client-version'),
      userAgent: req.header('user-agent'),
    };
    return WalletService.getInstance(opts);
  };

  function getServerWithAuth(req, res, opts, cb) {
    if (_.isFunction(opts)) {
      cb = opts;
      opts = {};
    }
    opts = opts || {};

    var credentials = getCredentials(req);
    if (!credentials)
      return returnError(new WalletService.ClientError({
        code: 'NOT_AUTHORIZED'
      }), res, req);

    var auth = {
      copayerId: credentials.copayerId,
      message: req.method.toLowerCase() + '|' + req.url + '|' + JSON.stringify(req.body),
      signature: credentials.signature,
      clientVersion: req.header('x-client-version'),
      userAgent: req.header('user-agent'),
      walletId: req.header('x-wallet-id'),
    };
    if (opts.allowSession) {
      auth.session = credentials.session;
    }
    WalletService.getInstanceWithAuth(auth, function(err, server) {
      if (err) return returnError(err, res, req);

      if (opts.onlySupportStaff && !server.copayerIsSupportStaff) {
        return returnError(new WalletService.ClientError({
          code: 'NOT_AUTHORIZED'
        }), res, req);
      }

      // For logging
      req.walletId = server.walletId;
      req.copayerId = server.copayerId;

      return cb(server);
    });
  };


  var createWalletLimiter;

  if (Defaults.RateLimit.createWallet && !opts.ignoreRateLimiter) {
    log.info('', 'Limiting wallet creation per IP: %d req/h', (Defaults.RateLimit.createWallet.max / Defaults.RateLimit.createWallet.windowMs * 60 * 60 * 1000).toFixed(2))
    createWalletLimiter = new RateLimit(Defaults.RateLimit.createWallet);
    // router.use(/\/v\d+\/wallets\/$/, createWalletLimiter)
  } else {
    createWalletLimiter = function(req, res, next) {
      next()
    };
  }

  // DEPRECATED
  router.post('/v1/wallets/', createWalletLimiter, function(req, res) {
    logDeprecated(req);
    var server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    req.body.supportBIP44AndP2PKH = false;
    server.createWallet(req.body, function(err, walletId) {
      if (err) return returnError(err, res, req);
      res.json({
        walletId: walletId,
      });
    });
  });

  router.post('/v2/wallets/', createWalletLimiter, function(req, res) {
    var server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.createWallet(req.body, function(err, walletId) {
      if (err) return returnError(err, res, req);
      res.json({
        walletId: walletId,
      });
    });
  });

  router.put('/v1/copayers/:id/', function(req, res) {
    req.body.copayerId = req.params['id'];
    var server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.addAccess(req.body, function(err, result) {
      if (err) return returnError(err, res, req);
      res.json(result);
    });
  });

  // DEPRECATED
  router.post('/v1/wallets/:id/copayers/', function(req, res) {
    logDeprecated(req);
    req.body.walletId = req.params['id'];
    req.body.supportBIP44AndP2PKH = false;
    var server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.joinWallet(req.body, function(err, result) {
      if (err) return returnError(err, res, req);

      res.json(result);
    });
  });

  router.post('/v2/wallets/:id/copayers/', function(req, res) {
    req.body.walletId = req.params['id'];
    var server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.joinWallet(req.body, function(err, result) {
      if (err) return returnError(err, res, req);

      res.json(result);
    });
  });

  // DEPRECATED
  router.get('/v1/wallets/', function(req, res) {
    logDeprecated(req);
    getServerWithAuth(req, res, function(server) {
      server.getStatus({
        includeExtendedInfo: true
      }, function(err, status) {
        if (err) return returnError(err, res, req);
        res.json(status);
      });
    });
  });

  router.get('/v2/wallets/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      var opts = {};
      if (req.query.includeExtendedInfo == '1') opts.includeExtendedInfo = true;
      if (req.query.twoStep == '1') opts.twoStep = true;

      server.getStatus(opts, function(err, status) {
        if (err) return returnError(err, res, req);
        res.json(status);
      });
    });
  });

  router.get('/v1/wallets/:identifier/', function(req, res) {
    getServerWithAuth(req, res, {
      onlySupportStaff: true
    }, function(server) {
      var opts = {
        identifier: req.params['identifier'],
      };
      server.getWalletFromIdentifier(opts, function(err, wallet) {
        if (err) return returnError(err, res, req);
        if (!wallet) return res.end();

        server.walletId = wallet.id;
        var opts = {};
        if (req.query.includeExtendedInfo == '1') opts.includeExtendedInfo = true;
        if (req.query.twoStep == '1') opts.twoStep = true;
        server.getStatus(opts, function(err, status) {
          if (err) return returnError(err, res, req);
          res.json(status);
        });
      });
    });
  });

  router.get('/v1/preferences/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      server.getPreferences({}, function(err, preferences) {
        if (err) return returnError(err, res, req);
        res.json(preferences);
      });
    });
  });

  router.put('/v1/preferences', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      server.savePreferences(req.body, function(err, result) {
        if (err) return returnError(err, res, req);
        res.json(result);
      });
    });
  });

  router.get('/v1/txproposals/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      server.getPendingTxs({}, function(err, pendings) {
        if (err) return returnError(err, res, req);
        res.json(pendings);
      });
    });
  });

  router.post('/v1/txproposals/', function(req, res) {
    var Errors = require('./errors/errordefinitions');
    var err = Errors.UPGRADE_NEEDED;
    return returnError(err, res, req);
  });

  router.post('/v2/txproposals/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      server.createTx(req.body, function(err, txp) {
        if (err) return returnError(err, res, req);
        res.json(txp);
      });
    });
  });

  // DEPRECATED
  router.post('/v1/addresses/', function(req, res) {
    logDeprecated(req);
    getServerWithAuth(req, res, function(server) {
      server.createAddress({
        ignoreMaxGap: true
      }, function(err, address) {
        if (err) return returnError(err, res, req);
        res.json(address);
      });
    });
  });

  // DEPRECATED
  router.post('/v2/addresses/', function(req, res) {
    logDeprecated(req);
    getServerWithAuth(req, res, function(server) {
      server.createAddress({
        ignoreMaxGap: true
      }, function(err, address) {
        if (err) return returnError(err, res, req);
        res.json(address);
      });
    });
  });

  router.post('/v3/addresses/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      server.createAddress(req.body, function(err, address) {
        if (err) return returnError(err, res, req);
        res.json(address);
      });
    });
  });

  router.get('/v1/addresses/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      var opts = {};
      if (req.query.limit) opts.limit = +req.query.limit;
      opts.reverse = (req.query.reverse == '1');

      server.getMainAddresses(opts, function(err, addresses) {
        if (err) return returnError(err, res, req);
        res.json(addresses);
      });
    });
  });

  router.get('/v1/balance/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      var opts = {};
      if (req.query.coin) opts.coin = req.query.coin;
      if (req.query.twoStep == '1') opts.twoStep = true;
      server.getBalance(opts, function(err, balance) {
        if (err) return returnError(err, res, req);
        res.json(balance);
      });
    });
  });

  var estimateFeeLimiter;

  if (Defaults.RateLimit.estimateFee && !opts.ignoreRateLimiter) {
    log.info('', 'Limiting estimate fee per IP: %d req/h', (Defaults.RateLimit.estimateFee.max / Defaults.RateLimit.estimateFee.windowMs * 60 * 60 * 1000).toFixed(2))
    estimateFeeLimiter = new RateLimit(Defaults.RateLimit.estimateFee);
    // router.use(/\/v\d+\/wallets\/$/, createWalletLimiter)
  } else {
    estimateFeeLimiter = function(req, res, next) {
      next()
    };
  }


  // DEPRECATED
  router.get('/v1/feelevels/', estimateFeeLimiter, function(req, res) {
    logDeprecated(req);
    var opts = {};
    if (req.query.network) opts.network = req.query.network;
    var server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.getFeeLevels(opts, function(err, feeLevels) {
      if (err) return returnError(err, res, req);
      _.each(feeLevels, function(feeLevel) {
        feeLevel.feePerKB = feeLevel.feePerKb;
        delete feeLevel.feePerKb;
      });
      res.json(feeLevels);
    });
  });

  router.get('/v2/feelevels/', estimateFeeLimiter, function(req, res) {
    var opts = {};
    if (req.query.coin) opts.coin = req.query.coin;
    if (req.query.network) opts.network = req.query.network;

    var server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.getFeeLevels(opts, function(err, feeLevels) {
      if (err) return returnError(err, res, req);
      res.json(feeLevels);
    });
  });

  router.get('/v1/sendmaxinfo/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      var q = req.query;
      var opts = {};
      if (q.feePerKb) opts.feePerKb = +q.feePerKb;
      if (q.feeLevel) opts.feeLevel = q.feeLevel;
      if (q.excludeUnconfirmedUtxos == '1') opts.excludeUnconfirmedUtxos = true;
      if (q.returnInputs == '1') opts.returnInputs = true;
      server.getSendMaxInfo(opts, function(err, info) {
        if (err) return returnError(err, res, req);
        res.json(info);
      });
    });
  });

  router.get('/v1/utxos/', function(req, res) {
    var opts = {};
    var addresses = req.query.addresses;
    if (addresses && _.isString(addresses)) opts.addresses = req.query.addresses.split(',');
    getServerWithAuth(req, res, function(server) {
      server.getUtxos(opts, function(err, utxos) {
        if (err) return returnError(err, res, req);
        res.json(utxos);
      });
    });
  });

  router.post('/v1/broadcast_raw/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      server.broadcastRawTx(req.body, function(err, txid) {
        if (err) return returnError(err, res, req);
        res.json(txid);
        res.end();
      });
    });
  });

  router.post('/v1/txproposals/:id/signatures/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      req.body.txProposalId = req.params['id'];
      server.signTx(req.body, function(err, txp) {
        if (err) return returnError(err, res, req);
        res.json(txp);
        res.end();
      });
    });
  });

  router.post('/v1/txproposals/:id/publish/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      req.body.txProposalId = req.params['id'];
      server.publishTx(req.body, function(err, txp) {
        if (err) return returnError(err, res, req);
        res.json(txp);
        res.end();
      });
    });
  });

  // TODO Check HTTP verb and URL name
  router.post('/v1/txproposals/:id/broadcast/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      req.body.txProposalId = req.params['id'];
      server.broadcastTx(req.body, function(err, txp) {
        if (err) return returnError(err, res, req);
        res.json(txp);
        res.end();
      });
    });
  });

  router.post('/v1/txproposals/:id/rejections', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      req.body.txProposalId = req.params['id'];
      server.rejectTx(req.body, function(err, txp) {
        if (err) return returnError(err, res, req);
        res.json(txp);
        res.end();
      });
    });
  });

  router.delete('/v1/txproposals/:id/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      req.body.txProposalId = req.params['id'];
      server.removePendingTx(req.body, function(err) {
        if (err) return returnError(err, res, req);
        res.json({
          success: true
        });
        res.end();
      });
    });
  });

  router.get('/v1/txproposals/:id/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      req.body.txProposalId = req.params['id'];
      server.getTx(req.body, function(err, tx) {
        if (err) return returnError(err, res, req);
        res.json(tx);
        res.end();
      });
    });
  });

  router.get('/v1/txhistory/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      var opts = {};
      if (req.query.skip) opts.skip = +req.query.skip;
      if (req.query.limit) opts.limit = +req.query.limit;
      if (req.query.includeExtendedInfo == '1') opts.includeExtendedInfo = true;

      server.getTxHistory(opts, function(err, txs) {
        if (err) return returnError(err, res, req);
        res.json(txs);
        res.end();
      });
    });
  });

  router.post('/v1/addresses/scan/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      server.startScan(req.body, function(err, started) {
        if (err) return returnError(err, res, req);
        res.json(started);
        res.end();
      });
    });
  });

  router.get('/v1/stats/', function(req, res) {
    var opts = {};
    if (req.query.network) opts.network = req.query.network;
    if (req.query.coin) opts.coin = req.query.coin;
    if (req.query.from) opts.from = req.query.from;
    if (req.query.to) opts.to = req.query.to;

    var stats = new Stats(opts);
    stats.run(function(err, data) {
      if (err) return returnError(err, res, req);
      res.json(data);
      res.end();
    });
  });

  router.get('/v1/version/', function(req, res) {
    res.json({
      serviceVersion: WalletService.getServiceVersion(),
    });
    res.end();
  });

  router.post('/v1/login/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      server.login({}, function(err, session) {
        if (err) return returnError(err, res, req);
        res.json(session);
      });
    });
  });

  router.post('/v1/logout/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      server.logout({}, function(err) {
        if (err) return returnError(err, res, req);
        res.end();
      });
    });
  });

  router.get('/v1/notifications/', function(req, res) {
    getServerWithAuth(req, res, {
      allowSession: true,
    }, function(server) {
      var timeSpan = req.query.timeSpan ? Math.min(+req.query.timeSpan || 0, Defaults.MAX_NOTIFICATIONS_TIMESPAN) : Defaults.NOTIFICATIONS_TIMESPAN;
      var opts = {
        minTs: +Date.now() - (timeSpan * 1000),
        notificationId: req.query.notificationId,
      };

      server.getNotifications(opts, function(err, notifications) {
        if (err) return returnError(err, res, req);
        res.json(notifications);
      });
    });
  });

  router.get('/v1/txnotes/:txid', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      var opts = {
        txid: req.params['txid'],
      };
      server.getTxNote(opts, function(err, note) {
        if (err) return returnError(err, res, req);
        res.json(note);
      });
    });
  });

  router.put('/v1/txnotes/:txid/', function(req, res) {
    req.body.txid = req.params['txid'];
    getServerWithAuth(req, res, function(server) {
      server.editTxNote(req.body, function(err, note) {
        if (err) return returnError(err, res, req);
        res.json(note);
      });
    });
  });

  router.get('/v1/txnotes/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      var opts = {};
      if (req.query.minTs && _.isNumber(+req.query.minTs)) {
        opts.minTs = +req.query.minTs;
      }
      server.getTxNotes(opts, function(err, notes) {
        if (err) return returnError(err, res, req);
        res.json(notes);
      });
    });
  });

  router.get('/v1/fiatrates/:code/', function(req, res) {
    var server;
    var opts = {
      code: req.params['code'],
      provider: req.query.provider,
      ts: +req.query.ts,
    };
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.getFiatRate(opts, function(err, rates) {
      if (err) return returnError(err, res, req);
      res.json(rates);
    });
  });

  router.post('/v1/pushnotifications/subscriptions/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      server.pushNotificationsSubscribe(req.body, function(err, response) {
        if (err) return returnError(err, res, req);
        res.json(response);
      });
    });
  });

  // DEPRECATED
  router.delete('/v1/pushnotifications/subscriptions/', function(req, res) {
    logDeprecated(req);
    getServerWithAuth(req, res, function(server) {
      server.pushNotificationsUnsubscribe({
        token: 'dummy'
      }, function(err, response) {
        if (err) return returnError(err, res, req);
        res.json(response);
      });
    });
  });

  router.delete('/v2/pushnotifications/subscriptions/:token', function(req, res) {
    var opts = {
      token: req.params['token'],
    };
    getServerWithAuth(req, res, function(server) {
      server.pushNotificationsUnsubscribe(opts, function(err, response) {
        if (err) return returnError(err, res, req);
        res.json(response);
      });
    });
  });


  router.post('/v1/txconfirmations/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      server.txConfirmationSubscribe(req.body, function(err, response) {
        if (err) return returnError(err, res, req);
        res.json(response);
      });
    });
  });

  router.delete('/v1/txconfirmations/:txid', function(req, res) {
    var opts = {
      txid: req.params['txid'],
    };
    getServerWithAuth(req, res, function(server) {
      server.txConfirmationUnsubscribe(opts, function(err, response) {
        if (err) return returnError(err, res, req);
        res.json(response);
      });
    });
  });

  this.app.use(opts.basePath || '/bws/api', router);

  WalletService.initialize(opts, cb);

};

module.exports = ExpressApp;
