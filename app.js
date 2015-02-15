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

app.use(require('morgan')('dev'));


var port = process.env.COPAY_PORT || 3001;
var router = express.Router();

function returnError(err, res, req) {
  if (err instanceof CopayServer.ClientError) {

    var status = (err.code == 'NOTAUTHORIZED') ? 401 : 400;
    log.error('Err: ' + status + ':' + req.url + ' :' + err.code + ':' + err.message);
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
    var m = message || err.toString();

    log.error('Error: ' + req.url + ' :' + code + ':' + m);
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

function getServerWithAuth(req, res, cb) {
  var credentials = getCredentials(req);
  var auth = {
    copayerId: credentials.copayerId,
    message: req.method.toLowerCase() + '|' + req.url + '|' + JSON.stringify(req.body),
    signature: credentials.signature,
  };
  CopayServer.getInstanceWithAuth(auth, function(err, server) {
    if (err) return returnError(err, res, req);
    return cb(server);
  });
};

router.post('/v1/wallets/', function(req, res) {
  var server = CopayServer.getInstance();
  server.createWallet(req.body, function(err, walletId) {
    if (err) return returnError(err, res, req);

    res.json({
      walletId: walletId,
    });
  });
});

router.post('/v1/wallets/:id/copayers/', function(req, res) {
  req.body.walletId = req.params['id'];
  var server = CopayServer.getInstance();
  server.joinWallet(req.body, function(err, result) {
    if (err) return returnError(err, res, req);

    res.json(result);
  });
});

router.get('/v1/wallets/', function(req, res) {
  getServerWithAuth(req, res, function(server) {
    var result = {};
    async.parallel([

      function(next) {
        server.getWallet({}, function(err, wallet) {
          if (err) return next(err);
          result.wallet = wallet;
          next();
        });
      },
      function(next) {
        server.getBalance({}, function(err, balance) {
          if (err) return next(err);
          result.balance = balance;
          next();
        });
      },
      function(next) {
        server.getPendingTxs({}, function(err, pendingTxps) {
          if (err) return next(err);
          result.pendingTxps = pendingTxps;
          next();
        });
      },
    ], function(err) {
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
    server.createTx(req.body, function(err, txp) {
      if (err) return returnError(err, res, req);
      res.json(txp);
    });
  });
});


router.post('/v1/addresses/', function(req, res) {
  getServerWithAuth(req, res, function(server) {
    server.createAddress(req.body, function(err, address) {
      if (err) return returnError(err, res, req);
      res.json(address);
    });
  });
});

router.get('/v1/addresses/', function(req, res) {
  getServerWithAuth(req, res, function(server) {
    server.getAddresses({}, function(err, addresses) {
      if (err) return returnError(err, res, req);
      res.json(addresses);
    });
  });
});

router.get('/v1/balance/', function(req, res) {
  getServerWithAuth(req, res, function(server) {
    server.getBalance({}, function(err, balance) {
      if (err) return returnError(err, res, req);
      res.json(balance);
    });
  });
});

router.post('/v1/txproposals/:id/signatures/', function(req, res) {
  getServerWithAuth(req, res, function(server) {
    req.body.txProposalId = req.params['id'];
    server.signTx(req.body, function(err, txp) {
      if (err) return returnError(err, res, req);
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
      res.end();
    });
  });
});

router.post('/v1/txproposals/:id/rejections', function(req, res) {
  getServerWithAuth(req, res, function(server) {
    req.body.txProposalId = req.params['id'];
    server.rejectTx(req.body, function(err, txp) {
      if (err) return returnError(err, res, req);
      res.end();
    });
  });
});

router.delete('/v1/txproposals/:id/', function(req, res) {
  getServerWithAuth(req, res, function(server) {
    req.body.txProposalId = req.params['id'];
    server.removePendingTx(req.body, function(err) {
      if (err) return returnError(err, res, req);
      res.end();
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
