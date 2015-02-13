'use strict';

var _ = require('lodash');
var async = require('async');
var log = require('npmlog');
var express = require('express');
var querystring = require('querystring');
var bodyParser = require('body-parser')

var CopayServer = require('./lib/server');

log.debug = log.verbose;
log.level = 'debug';


CopayServer.initialize();


var app = express();
app.use(function(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Content-Type,Authorization');
  next();
});
var allowCORS = function(req, res, next) {
  if ('OPTIONS' == req.method) {
    res.send(200);
    res.end();
    return;
  }
  next();
}
app.use(allowCORS);

var POST_LIMIT = 1024 * 100 /* Max POST 100 kb */ ;

app.use(bodyParser.json({
  limit: POST_LIMIT
}));

var port = process.env.COPAY_PORT || 3001;
var router = express.Router();

function returnError(err, res) {
  if (err instanceof CopayServer.ClientError) {

console.log('[app.js.47]'); //TODO
    var status = (err.code == 'NOTAUTHORIZED') ? 401 : 400;
    res.status(status).json({
      code: err.code,
      error: err.message,
    }).end();
  } else {
    var code, message;
    if (_.isObject(err)) {
      code = err.code;
      message = err.message;
    }
    res.status(code || 500).json({
      error: message || err.toString(),
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

function getServerWithAuth(req, res, cb) {
  var credentials = getCredentials(req);
  var auth = {
    copayerId: credentials.copayerId,
    message: req.url + '|' + JSON.stringify(req.body),
    signature: credentials.signature,
  };
  CopayServer.getInstanceWithAuth(auth, function(err, server) {
    if (err) return returnError(err, res);
    return cb(server);
  });
};

router.post('/v1/wallets/', function(req, res) {
  var server = CopayServer.getInstance();
  server.createWallet(req.body, function(err, walletId) {
    if (err) return returnError(err, res);

    res.json({
      walletId: walletId,
    });
  });
});

router.post('/v1/wallets/:id/copayers/', function(req, res) {
  req.body.walletId = req.params['id'];
  var server = CopayServer.getInstance();
  server.joinWallet(req.body, function(err, result) {
    if (err) return returnError(err, res);

    res.json(result);
  });
});

router.get('/v1/wallets/', function(req, res) {
  getServerWithAuth(req, res, function(server) {
    server.getWallet({}, function(err, wallet) {
      if (err) returnError(err, res);
      res.json(wallet);
    });
  });
});

router.post('/v1/addresses/', function(req, res) {
  getServerWithAuth(req, res, function(server) {
    server.createAddress(req.body, function(err, address) {
      if (err) return returnError(err, res);
      res.json(address);
    });
  });
});

router.get('/v1/addresses/', function(req, res) {
  getServerWithAuth(req, res, function(server) {
    server.getAddresses({}, function(err, addresses) {
      if (err) return returnError(err, res);
      res.json(addresses);
    });
  });
});

router.get('/v1/balance/', function(req, res) {
  getServerWithAuth(req, res, function(server) {
    server.getBalance({}, function(err, balance) {
      if (err) return returnError(err, res);
      res.json(balance);
    });
  });
});

// TODO: DEBUG only!
router.get('/v1/dump', function(req, res) {
  var server = CopayServer.getInstance();
  server.storage._dump(function() {
    res.end();
  });
});

app.use('/copay/api', router);

app.listen(port);
console.log('Copay service running on port ' + port);
