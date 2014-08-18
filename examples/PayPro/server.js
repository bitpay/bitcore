#!/bin/bash

/**
 * Payment-Server - A Payment Protocol demonstration.
 * Copyright (c) 2014, BitPay
 * https://github.com/bitpay/bitcore
 */

/**
 * Modules
 */

var https = require('https');
var fs = require('fs');
var path = require('path');
var qs = require('querystring');
var crypto = require('crypto');
var assert = require('assert');

// Disable strictSSL
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

/**
 * Dependencies
 */

var argv = require('optimist').argv;
var express = require('express');
var bitcore = require('../../');

var PayPro = bitcore.PayPro;
var Transaction = bitcore.Transaction;
var TransactionBuilder = bitcore.TransactionBuilder;

/**
 * Variables
 */

var x509 = {
  priv: fs.readFileSync(__dirname + '/../../test/data/x509.key'),
  pub: fs.readFileSync(__dirname + '/../../test/data/x509.pub'),
  der: fs.readFileSync(__dirname + '/../../test/data/x509.der'),
  pem: fs.readFileSync(__dirname + '/../../test/data/x509.crt')
};

var server = https.createServer({
  key: fs.readFileSync(__dirname + '/../../test/data/x509.key'),
  cert: fs.readFileSync(__dirname + '/../../test/data/x509.crt')
});

server.options = argv;

server.setOptions = function(options) {
  server.options = argv = options;
};

var app = express();

/**
 * Ignore Cache Headers
 * Allow CORS
 * Accept Payments
 */

app.use(function(req, res, next) {
  var setHeader = res.setHeader;

  res.setHeader = function(name) {
    switch (name) {
      case 'Cache-Control':
      case 'Last-Modified':
      case 'ETag':
        return;
    }
    return setHeader.apply(res, arguments);
  };

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', [
    'Host',
    'Connection',
    'Content-Length',
    'Accept',
    'Origin',
    'User-Agent',
    'Content-Type',
    'Accept-Encoding',
    'Accept-Language'
  ].join(','));

  res.setHeader('Accept', PayPro.PAYMENT_CONTENT_TYPE);

  return next();
});

/**
 * Body Parser
 */

app.use('/-/pay', function(req, res, next) {
  var buf = [];

  req.on('error', function(err) {
    error('Request Error: %s', err.message);
    try {
      req.socket.destroy();
    } catch (e) {
      ;
    }
  });

  req.on('data', function(data) {
    buf.push(data);
  });

  req.on('end', function(data) {
    if (data) buf.push(data);
    buf = Buffer.concat(buf, buf.length);
    req.paymentData = buf;
    return next();
  })
});

/**
 * Router
 */

// Not used in express 4.x
// app.use(app.router);

/**
 * Receive "I want to pay"
 */

app.uid = 0;

app.get('/-/request', function(req, res, next) {
  print('Received payment "request" from %s.', req.socket.remoteAddress);

  var outputs = [];

  [2000, 1000, 10000].forEach(function(value) {
    var po = new PayPro();
    po = po.makeOutput();

    // number of satoshis to be paid
    po.set('amount', value);

    // a TxOut script where the payment should be sent. similar to OP_CHECKSIG

    // Instead of creating it ourselves:
    // if (!argv.pubkey && !argv.privkey && !argv.address) {
    //   //argv.pubkey = '3730febcba04bad0cd476cfb820f9c37d7466fd9';
    //   argv.pubkey = 'd96f46d7379c0f82fb6c47cdd0ba04babcfe3037'
    // }

    if (argv.pubkey || argv.privkey || argv.address) {
      var pubKey;
      if (argv.pubkey) {
        pubKey = new Buffer(argv.pubkey, 'hex');
      } else if (argv.privkey) {
        pubKey = bitcore.Key.recoverPubKey(new Buffer(argv.privkey)).toCompressedPubKey();
      } else if (argv.address) {
        pubKey = bitcore.Base58Check.decode(new Buffer(argv.address));
      }
      var address = bitcore.Address.fromPubKey(pubKey, 'testnet');
      var scriptPubKey = address.getScriptPubKey();
      assert.equal(scriptPubKey.isPubkeyHash(), true);
      po.set('script', scriptPubKey.getBuffer());
    } else {
      po.set('script', new Buffer([
        118, // OP_DUP
        169, // OP_HASH160
        76,  // OP_PUSHDATA1
        20,  // number of bytes
        55,
        48,
        254,
        188,
        186,
        4,
        186,
        208,
        205,
        71,
        108,
        251,
        130,
        15,
        156,
        55,
        215,
        70,
        111,
        217,
        136, // OP_EQUALVERIFY
        172  // OP_CHECKSIG
      ]));
    }

    outputs.push(po.message);
  });

  /**
   * Payment Details
   */

  var mdata = new Buffer([0]);
  app.uid++;
  if (app.uid > 0xffff) {
    throw new Error('UIDs bigger than 0xffff not supported.');
  } else if (app.uid > 0xff) {
    mdata = new Buffer([(app.uid >> 8) & 0xff, (app.uid >> 0) & 0xff])
  } else {
    mdata = new Buffer([0, app.uid])
  }
  var now = Date.now() / 1000 | 0;
  var pd = new PayPro();
  pd = pd.makePaymentDetails();
  pd.set('network', 'test');
  pd.set('outputs', outputs);
  pd.set('time', now);
  pd.set('expires', now + 60 * 60 * 24);
  pd.set('memo', 'Hello, this is the server, we would like some money.');
  var port = +req.headers.host.split(':')[1] || server.port;
  pd.set('payment_url', 'https://localhost:' + port + '/-/pay');
  pd.set('merchant_data', mdata);

  /*
   * PaymentRequest
   */

  var cr = new PayPro();
  cr = cr.makeX509Certificates();
  cr.set('certificate', [x509.der]);

  // We send the PaymentRequest to the customer
  var pr = new PayPro();
  pr = pr.makePaymentRequest();
  pr.set('payment_details_version', 1);
  pr.set('pki_type', 'x509+sha256');
  pr.set('pki_data', cr.serialize());
  pr.set('serialized_payment_details', pd.serialize());
  pr.sign(x509.priv);

  pr = pr.serialize();

  // BIP-71 - set the content-type
  res.setHeader('Content-Type', PayPro.PAYMENT_REQUEST_CONTENT_TYPE);
  res.setHeader('Content-Length', pr.length + '');
  res.setHeader('Content-Transfer-Encoding', 'binary');

  res.send(pr);
});

/**
 * Receive Payment
 */

app.post('/-/pay', function(req, res, next) {
  var body = req.paymentData;

  print('Received Payment Message Body:');
  print(body.toString('hex'));

  body = PayPro.Payment.decode(body);

  var pay = new PayPro();
  pay = pay.makePayment(body);
  var merchant_data = pay.get('merchant_data');
  var transactions = pay.get('transactions');
  var refund_to = pay.get('refund_to');
  var memo = pay.get('memo');

  print('Received Payment from %s.', req.socket.remoteAddress);
  print('Customer Message: %s', memo);
  print('Payment Message:');
  print(pay);

  // We send this to the customer after receiving a Payment
  // Then we propogate the transaction through bitcoin network
  var ack = new PayPro();
  ack = ack.makePaymentACK();
  ack.set('payment', pay.message);
  ack.set('memo', 'Thank you for your payment!');

  ack = ack.serialize();

  // BIP-71 - set the content-type
  res.setHeader('Content-Type', PayPro.PAYMENT_ACK_CONTENT_TYPE);
  res.setHeader('Content-Length', ack.length + '');
  res.setHeader('Content-Transfer-Encoding', 'binary');

  transactions = transactions.map(function(tx) {
    tx.buffer = tx.buffer.slice(tx.offset, tx.limit);
    var ptx = new bitcore.Transaction();
    ptx.parse(tx.buffer);
    return ptx;
  });

  (function retry() {
    var timeout = setTimeout(function() {
      if (conn) {
        transactions.forEach(function(tx) {
          var id = tx.getHash().toString('hex');
          print('');
          print('Sending transaction with txid: %s', id);
          print(tx.getStandardizedObject());

          var pending = 1;
          peerman.on('ack', function listener() {
            if (!--pending) {
              peerman.removeListener('ack', listener);
              clearTimeout(timeout);
              print('Transaction sent to peer successfully.');
            }
          });

          print('Broadcasting transaction...');

          if (!argv['no-tx']) {
            conn.sendTx(tx);
          }
        });
      } else {
        print('No BTC network connection. Retrying...');
        conn = peerman.getActiveConnection();
        retry();
      }
    }, 1000);
  })();

  res.send(ack);
});

/**
 * Bitcoin
 */

var conn;

var peerman = new bitcore.PeerManager({
  network: 'testnet'
});

peerman.peerDiscovery = argv.d || argv.discovery || false;

peerman.addPeer(new bitcore.Peer('testnet-seed.alexykot.me', 18333));
peerman.addPeer(new bitcore.Peer('testnet-seed.bitcoin.petertodd.org', 18333));
peerman.addPeer(new bitcore.Peer('testnet-seed.bluematt.me', 18333));

peerman.on('connect', function() {
  conn = peerman.getActiveConnection();
});

peerman.start();

/**
 * File Access
 */

app.use(express.static(__dirname));

/**
 * Helpers
 */

var log = require('../../util/log');

log.err = error;
log.debug = error;
log.info = print;

var util = require('util');

function print() {
  var args = Array.prototype.slice.call(arguments);
  if (typeof args[0] !== 'string') {
    args[0] = util.inspect(args[0], null, 20, true);
    console.log('\x1b[34mServer:\x1b[m');
    console.log(args[0]);
    return;
  }
  if (!args[0]) return process.stdout.write('\n');
  var msg = '\x1b[34mServer:\x1b[m '
    + util.format.apply(util.format, args);
  return process.stdout.write(msg + '\n');
}

function error() {
  var args = Array.prototype.slice.call(arguments);
  if (typeof args[0] !== 'string') {
    args[0] = util.inspect(args[0], null, 20, true);
    console.log('\x1b[34mServer:\x1b[m');
    console.log(args[0]);
    return;
  }
  if (!args[0]) return process.stderr.write('\n');
  var msg = '\x1b[34mServer:\x1b[m \x1b[31m'
    + util.format.apply(util.format, args)
    + '\x1b[m';
  return process.stderr.write(msg + '\n');
}

/**
 * Start Server
 */

server.on('request', app);
server.app = app;
server.port = 8080;
server.isNode = true;

setTimeout(function() {
  server.port = argv.p = argv.port = +argv.p || +argv.port || 8080;
  server.isNode = !argv.b && !argv.browser;
  if (argv.s || argv.server || argv.l || argv.listen) {
    server.listen(server.port, function(addr) {
      print('Listening on port %s.', server.port);
    });
    return;
  }
  if (!module.parent || path.basename(module.parent.filename) === 'index.js') {
    server.listen(server.port, function(addr) {
      print('Listening on port %s.', server.port);
      if (!server.isNode) return;
      var customer = require('./customer');
      customer.sendPayment(function(err) {
        if (err) return error(err.message);
        customer.print('Payment sent successfully.');
      });
    });
  }
}, 1);

module.exports = server;
