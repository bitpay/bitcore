'use strict';

var _ = require('lodash');
var async = require('async');
var log = require('npmlog');

var express = require('express');
var querystring = require('querystring');
var bodyParser = require('body-parser')

var WalletService = require('./server');
var Stats = require('./stats');

log.disableColor();
log.debug = log.verbose;
log.level = 'info';

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

  this.app.use(function(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'x-signature,x-identity,x-client-version,X-Requested-With,Content-Type,Authorization');
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

  var POST_LIMIT = 1024 * 100 /* Max POST 100 kb */ ;

  this.app.use(bodyParser.json({
    limit: POST_LIMIT
  }));

  if (opts.disableLogs) {
    log.level = 'silent';
  } else {
    var morgan = require('morgan');
    morgan.token('walletId', function getId(req) {
      return req.walletId
    });

    morgan.token('copayerId', function getId(req) {
      return req.copayerId
    });



    this.app.use(morgan(' :remote-addr :date[iso] ":method :url" :status :res[content-length] :response-time ":user-agent" :walletId :copayerId'));
  }


  var router = express.Router();

  function returnError(err, res, req) {
    if (err instanceof WalletService.ClientError) {

      var status = (err.code == 'NOT_AUTHORIZED') ? 401 : 400;
      if (!opts.disableLogs)
        log.info('Client Err: ' + status + ' ' + req.url + ' ' + err);

      res.status(status).json({
        code: err.code,
        message: err.message,
      }).end();
    } else {
      var code = 500,
        message;
      if (_.isObject(err)) {
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

  function getCredentials(req) {
    var identity = req.header('x-identity');
    if (!identity) return;

    return {
      copayerId: identity,
      signature: req.header('x-signature'),
    };
  };

  function getServer(req, res, cb) {
    var opts = {
      clientVersion: req.header('x-client-version'),
    };
    return WalletService.getInstance(opts);
  };

  function getServerWithAuth(req, res, cb) {
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
    };
    WalletService.getInstanceWithAuth(auth, function(err, server) {
      if (err) return returnError(err, res, req);

      // For logging
      req.walletId = server.walletId;
      req.copayerId = server.copayerId;

      return cb(server);
    });
  };

  // DEPRECATED
  router.post('/v1/wallets/', function(req, res) {
    var server = getServer(req, res);
    req.body.supportBIP44AndP2PKH = false;
    server.createWallet(req.body, function(err, walletId) {
      if (err) return returnError(err, res, req);
      res.json({
        walletId: walletId,
      });
    });
  });

  router.post('/v2/wallets/', function(req, res) {
    var server = getServer(req, res);
    server.createWallet(req.body, function(err, walletId) {
      if (err) return returnError(err, res, req);
      res.json({
        walletId: walletId,
      });
    });
  });

  router.put('/v1/copayers/:id/', function(req, res) {
    req.body.copayerId = req.params['id'];
    var server = getServer(req, res);
    server.addAccess(req.body, function(err, result) {
      if (err) return returnError(err, res, req);
      res.json(result);
    });
  });

  // DEPRECATED
  router.post('/v1/wallets/:id/copayers/', function(req, res) {
    req.body.walletId = req.params['id'];
    req.body.supportBIP44AndP2PKH = false;
    var server = getServer(req, res);
    server.joinWallet(req.body, function(err, result) {
      if (err) return returnError(err, res, req);

      res.json(result);
    });
  });

  router.post('/v2/wallets/:id/copayers/', function(req, res) {
    req.body.walletId = req.params['id'];
    var server = getServer(req, res);
    server.joinWallet(req.body, function(err, result) {
      if (err) return returnError(err, res, req);

      res.json(result);
    });
  });

  // DEPRECATED
  router.get('/v1/wallets/', function(req, res) {
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

      server.getStatus(opts, function(err, status) {
        if (err) return returnError(err, res, req);
        res.json(status);
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
    getServerWithAuth(req, res, function(server) {
      server.createTxLegacy(req.body, function(err, txp) {
        if (err) return returnError(err, res, req);
        res.json(txp);
      });
    });
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

  // DEPRECATED
  router.get('/v1/balance/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      server.getBalance({}, function(err, balance) {
        if (err) return returnError(err, res, req);
        res.json(balance);
      });
    });
  });

  router.get('/v2/balance/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      server.getBalance2Steps({}, function(err, balance) {
        if (err) return returnError(err, res, req);
        res.json(balance);
      });
    });
  });

  // DEPRECATED
  router.get('/v1/feelevels/', function(req, res) {
    var opts = {};
    if (req.query.network) opts.network = req.query.network;
    var server = getServer(req, res);
    server.getFeeLevels(opts, function(err, feeLevels) {
      if (err) return returnError(err, res, req);
      _.each(feeLevels, function(feeLevel) {
        feeLevel.feePerKB = feeLevel.feePerKb;
        delete feeLevel.feePerKb;
      });
      res.json(feeLevels);
    });
  });

  router.get('/v2/feelevels/', function(req, res) {
    var opts = {};
    if (req.query.network) opts.network = req.query.network;
    var server = getServer(req, res);
    server.getFeeLevels(opts, function(err, feeLevels) {
      if (err) return returnError(err, res, req);
      res.json(feeLevels);
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

  router.get('/v1/notifications/', function(req, res) {
    getServerWithAuth(req, res, function(server) {
      var timeSpan = req.query.timeSpan ? Math.min(+req.query.timeSpan || 0, 60) : 60;
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

  this.app.use(opts.basePath || '/bws/api', router);

  WalletService.initialize(opts, cb);

};

module.exports = ExpressApp;
