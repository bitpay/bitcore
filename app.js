'use strict';

var _ = require('lodash');
var async = require('async');
var log = require('npmlog');
var CopayServer = require('./lib/server');
var express = require('express');
var querystring = require('querystring');

log.debug = log.verbose;
log.level = 'debug';

var POST_LIMIT = 1024 * 100 /* Max POST 100 kb */ ;

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

var port = process.env.COPAY_PORT || 3001;
var router = express.Router();

function returnError(err, res) {
  if (err instanceof CopayServer.ClientError) {
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
  };
};

function authenticate() {
  return true;
};

function parsePost(req, res, cb) {
  var queryData = '';
  req.on('data', function(data) {
    queryData += data;
    if (queryData.length > POST_LIMIT) {
      queryData = '';
      res.writeHead(413, {
        'Content-Type': 'text/plain'
      });
      res.end();
      req.connection.destroy();
    }
  }).on('end', function() {
    try {
      var params = JSON.parse(queryData);
      cb(params);
    } catch (ex) {
      returnError({
        code: 400,
        message: 'Unable to parse request'
      }, res);
    }
  });
};

router.post('/v1/wallets/', function(req, res) {
  parsePost(req, res, function(params) {
    try {
      var server = CopayServer.getInstance();
      server.createWallet(params, function(err, wallet) {
        if (err) returnError(err, res);

        res.json(wallet);
      });
    } catch (ex) {
      returnError(ex, res);
    }
  });
});

router.post('/v1/wallets/:id/join/', function(req, res) {
  parsePost(req, res, function(params) {
    params.walletId = req.params['id'];
    try {
      var server = CopayServer.getInstance();
      server.joinWallet(params, function(err) {
        if (err) returnError(err, res);

        res.end();
      });
    } catch (ex) {
      returnError(ex, res);
    }
  });
});

router.get('/v1/wallets/', function(req, res) {
  var credentials = getCredentials(req);

  CopayServer.getInstanceWithAuth({
    copayerId: credentials.copayerId,
    message: 'hello world!',
    signature: '3045022100addd20e5413865d65d561ad2979f2289a40d52594b1f804840babd9a63e4ebbf02204b86285e1fcab02df772e7a1325fc4b511ecad79a8f80a2bd1ad8bfa858ac3d4',
  }, function(err, server) {
    if (err) return returnError(err, res);
    try {
      server.getWallet({}, function(err, wallet) {
        if (err) returnError(err, res);
        res.json(wallet);
      });
    } catch (ex) {
      returnError(ex, res);
    }
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
