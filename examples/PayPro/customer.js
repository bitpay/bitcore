/**
 * Payment-Customer - A Payment Protocol demonstration.
 * This file will run in node or the browser.
 * Copyright (c) 2014, BitPay
 * https://github.com/bitpay/bitcore
 */

;(function() {

/**
 * Global
 */

var window = this;
var global = this;

/**
 * Platform
 */

var isNode = !!(typeof process === 'object' && process && process.versions.node);

// Disable strictSSL
if (isNode) {
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
}

/**
 * Dependencies
 */

var bitcore = isNode
  ? require('../../')
  : require('bitcore');
var PayPro = bitcore.PayPro;
var Transaction = bitcore.Transaction;
var TransactionBuilder = bitcore.TransactionBuilder;

/**
 * Variables
 */

var port = 8080;

if (isNode) {
  var argv = require('optimist').argv;
  if (argv.p || argv.port) {
    port = +argv.p || +argv.port;
  }
} else {
  port = +window.location.port || 443;
}

var merchant = isNode
  ? parseMerchantURI(argv.m || argv.u || argv._[0])
  : parseMerchantURI(window.merchantURI);

/**
 * Send Payment
 */

if (isNode) {
  var Buffer = global.Buffer;
} else {
  var Buffer = bitcore.Buffer;
}

function request(options, callback) {
  if (typeof options === 'string') {
    options = { uri: options };
  }

  options.method = options.method || 'GET';
  options.headers = options.headers || {};

  if (!isNode) {
    var xhr = new XMLHttpRequest();
    xhr.open(options.method, options.uri, true);

    Object.keys(options.headers).forEach(function(key) {
      var val = options.headers[key];
      if (key === 'Content-Length') return;
      if (key === 'Content-Transfer-Encoding') return;
      xhr.setRequestHeader(key, val);
    });

    // For older browsers:
    // xhr.overrideMimeType('text/plain; charset=x-user-defined');

    // Newer browsers:
    xhr.responseType = 'arraybuffer';

    xhr.onload = function(event) {
      var response = xhr.response;
      var buf = new Uint8Array(response);
      return callback(null, xhr, buf);
    };

    if (options.body) {
      xhr.send(options.body);
    } else {
      xhr.send(null);
    }

    return;
  }

  return require('request')(options, callback);
}

function sendPayment(msg, callback) {
  if (arguments.length === 1) {
    callback = msg;
    msg = null;
  }

  return request({
    method: 'GET',
    uri: 'https://localhost:' + port + '/-/request',
    headers: {
      'Accept': PayPro.PAYMENT_REQUEST_CONTENT_TYPE
        + ', ' + PayPro.PAYMENT_ACK_CONTENT_TYPE,
      'Content-Type': 'application/octet-stream',
      'Content-Length': 0
    },
    encoding: null
  }, function(err, res, body) {
    if (err) return callback(err);

    body = PayPro.PaymentRequest.decode(body);

    var pr = new PayPro();
    pr = pr.makePaymentRequest(body);

    var ver = pr.get('payment_details_version');
    var pki_type = pr.get('pki_type');
    var pki_data = pr.get('pki_data');
    var details = pr.get('serialized_payment_details');
    var sig = pr.get('signature');

    // Verify Signature
    var verified = pr.verify();

    if (!verified) {
      return callback(new Error('Server sent a bad signature.'));
    }

    details = PayPro.PaymentDetails.decode(details);
    var pd = new PayPro();
    pd = pd.makePaymentDetails(details);
    var network = pd.get('network');
    var outputs = pd.get('outputs');
    var time = pd.get('time');
    var expires = pd.get('expires');
    var memo = pd.get('memo');
    var payment_url = pd.get('payment_url');
    var merchant_data = pd.get('merchant_data');

    print('You are currently on this BTC network:');
    print(network);
    print('The server sent you a message:');
    print(memo);

    var refund_outputs = [];

    var rpo = new PayPro();
    rpo = rpo.makeOutput();
    rpo.set('amount', 0);
    rpo.set('script', new Buffer([
      118, // OP_DUP
      169, // OP_HASH160
      76, // OP_PUSHDATA1
      20, // number of bytes
      0xcf,
      0xbe,
      0x41,
      0xf4,
      0xa5,
      0x18,
      0xed,
      0xc2,
      0x5a,
      0xf7,
      0x1b,
      0xaf,
      0xc7,
      0x2f,
      0xb6,
      0x1b,
      0xfc,
      0xfc,
      0x4f,
      0xcd,
      136, // OP_EQUALVERIFY
      172  // OP_CHECKSIG
    ]));

    refund_outputs.push(rpo.message);

    // We send this to the serve after receiving a PaymentRequest
    var pay = new PayPro();
    pay = pay.makePayment();
    pay.set('merchant_data', merchant_data);
    pay.set('transactions', [createTX(outputs)]);
    pay.set('refund_to', refund_outputs);

    msg = msg || 'Hi server, I would like to give you some money.';

    if (isNode && argv.memo) {
      msg = argv.memo;
    }

    pay.set('memo', msg);
    pay = pay.serialize();

    return request({
      method: 'POST',
      uri: payment_url,
      headers: {
        // BIP-71
        'Accept': PayPro.PAYMENT_REQUEST_CONTENT_TYPE
          + ', ' + PayPro.PAYMENT_ACK_CONTENT_TYPE,
        'Content-Type': PayPro.PAYMENT_CONTENT_TYPE,
        'Content-Length': pay.length + '',
        'Content-Transfer-Encoding': 'binary'
      },
      body: pay,
      encoding: null
    }, function(err, res, body) {
      if (err) return callback(err);
      body = PayPro.PaymentACK.decode(body);
      var ack = new PayPro();
      ack = ack.makePaymentACK(body);
      var payment = ack.get('payment');
      var memo = ack.get('memo');
      print('Our payment was acknowledged!');
      print('Message from Merchant: %s', memo);
      payment = PayPro.Payment.decode(payment);
      var pay = new PayPro();
      payment = pay.makePayment(payment);
      print(payment);
      var tx = payment.message.transactions[0];
      if (tx.buffer) {
        tx.buffer = tx.buffer.slice(tx.offset, tx.limit);
        var ptx = new bitcore.Transaction();

        var parser = new bitcore.BinaryParser(tx.buffer);
        ptx.parse(parser);
        // ptx.parse(tx.buffer);

        tx = ptx;
      }
      var txid = tx.getHash().toString('hex');
      print('First payment txid: %s', txid);
      return callback();
    });
  });
}

/**
 * Helpers
 */

// URI Spec
// A backwards-compatible request:
// bitcoin:mq7se9wy2egettFxPbmn99cK8v5AFq55Lx?amount=0.11&r=https://merchant.com/pay.php?h%3D2a8628fc2fbe
// Non-backwards-compatible equivalent:
// bitcoin:?r=https://merchant.com/pay.php?h%3D2a8628fc2fbe
function parseMerchantURI(uri) {
  uri = uri || 'bitcoin:?r=https://localhost:' + port + '/-/request';
  var query, id;
  if (uri.indexOf('bitcoin:') !== 0) {
    throw new Error('Not a Bitcoin URI.');
  }
  if (~uri.indexOf(':?')) {
    query = uri.split(':?')[1];
  } else {
    // Legacy URI
    uri = uri.substring('bitcoin:'.length);
    uri = uri.split('?');
    id = uri[0];
    query = uri[1];
  }
  query = parseQS(query);
  if (!query.r) {
    throw new Error('No uri.');
  }
  if (id) {
    query.id = id;
  }
  return query;
}

function parseQS(query) {
  var out = {};
  var parts = query.split('&');
  parts.forEach(function(part) {
    var parts = part.split('=');
    var key = parts[0];
    var value = parts[1];
    out[key] = value;
  });
  return out;
}

function createTX(outputs) {
  // Addresses
  var addrs = [
    'mzTQ66VKcybz9BD1LAqEwMFp9NrBGS82sY',
    'mmu9k3KzsDMEm9JxmJmZaLhovAoRKW3zr4',
    'myqss64GNZuWuFyg5LTaoTCyWEpKH56Fgz'
  ];

  // Private keys in WIF format (see TransactionBuilder.js for other options)
  var keys = [
    'cVvr5YmWVAkVeZWAawd2djwXM4QvNuwMdCw1vFQZBM1SPFrtE8W8',
    'cPyx1hXbe3cGQcHZbW3GNSshCYZCriidQ7afR2EBsV6ReiYhSkNF'
    // 'cUB9quDzq1Bj7pocenmofzNQnb1wJNZ5V3cua6pWKzNL1eQtaDqQ'
  ];

  var unspent = [{
    // http://blockexplorer.com/testnet/rawtx/1fcfe898cc2612f8b222bd3b4ac8d68bf95d43df8367b71978c184dea35bde22
    'txid': '1fcfe898cc2612f8b222bd3b4ac8d68bf95d43df8367b71978c184dea35bde22',
    'vout': 1,
    'address': addrs[0],
    'scriptPubKey': '76a94c14cfbe41f4a518edc25af71bafc72fb61bfcfc4fcd88ac',
    'amount': 1.60000000,
    'confirmations': 9
  },

  {
    // http://blockexplorer.com/testnet/rawtx/0624c0c794447b0d2343ae3d20382983f41b915bb115a834419e679b2b13b804
    'txid': '0624c0c794447b0d2343ae3d20382983f41b915bb115a834419e679b2b13b804',
    'vout': 1,
    'address': addrs[1],
    'scriptPubKey': '76a94c14460376539c219c5e3274d86f16b40e806b37817688ac',
    'amount': 1.60000000,
    'confirmations': 9
  }];

  // set change address
  var opts = {
    remainderOut: {
      address: addrs[0]
    }
  };

  var outs = [];
  outputs.forEach(function(output) {
    var amount = output.get('amount');
    var script = {
      offset: output.get('script').offset,
      limit: output.get('script').limit,
      buffer: new Buffer(new Uint8Array(
        output.get('script').buffer))
    };

    // big endian
    var v = new Buffer(8);
    v[0] = (amount.high >> 24) & 0xff;
    v[1] = (amount.high >> 16) & 0xff;
    v[2] = (amount.high >> 8) & 0xff;
    v[3] = (amount.high >> 0) & 0xff;
    v[4] = (amount.low >> 24) & 0xff;
    v[5] = (amount.low >> 16) & 0xff;
    v[6] = (amount.low >> 8) & 0xff;
    v[7] = (amount.low >> 0) & 0xff;

    var s = script.buffer.slice(script.offset, script.limit);
    var addr = bitcore.Address.fromScriptPubKey(new bitcore.Script(s), 'testnet');

    outs.push({
      address: addr.toString(),
      amountSatStr: bitcore.Bignum.fromBuffer(v, {
        // XXX for some reason, endian is ALWAYS 'big'
        // in node (in the browser it behaves correctly)
        endian: 'big',
        size: 1
      }).toString(10)
    });
  });

  var b = new bitcore.TransactionBuilder(opts)
    .setUnspent(unspent)
    .setOutputs(outs)
    .sign(keys);

  outputs.forEach(function(output, i) {
    var script = {
      offset: output.get('script').offset,
      limit: output.get('script').limit,
      buffer: new Buffer(new Uint8Array(
        output.get('script').buffer))
    };
    var s = script.buffer.slice(script.offset, script.limit);
    b.tx.outs[i].s = s;
  });

  var tx = b.build();

  print('');
  print('Customer created transaction:');
  print(tx.getStandardizedObject());
  print('');

  return tx.serialize();
}

/**
 * Helpers
 */

function clientLog(args, isError) {
  var log = document.getElementById('log');
  var msg = args[0];
  if (typeof msg !== 'string') {
    msg = JSON.stringify(msg, null, 2);
    if (isError) msg = '<span style="color:red;">' + msg + '</span>';
    log.innerHTML += msg + '\n';
    return;
  }
  var i = 0;
  msg = msg.replace(/%[sdji]/g, function(ch) {
    i++;
    if (ch === 'j' || typeof args[i] !== 'string') {
      return JSON.stringify(args[i]);
    }
    return args[i];
  });
  if (isError) msg = '<span style="color:red;">' + msg + '</span>';
  log.innerHTML += msg + '\n';
}

function print() {
  var args = Array.prototype.slice.call(arguments);
  if (!isNode) {
    return clientLog(args, false);
  }
  var util = require('util');
  if (typeof args[0] !== 'string') {
    args[0] = util.inspect(args[0], null, 20, true);
    console.log('\x1b[32mCustomer:\x1b[m');
    console.log(args[0]);
    return;
  }
  if (!args[0]) return process.stdout.write('\n');
  var msg = '\x1b[32mCustomer:\x1b[m '
    + util.format.apply(util.format, args);
  return process.stdout.write(msg + '\n');
}

function error() {
  var args = Array.prototype.slice.call(arguments);
  if (!isNode) {
    return clientLog(args, true);
  }
  var util = require('util');
  if (typeof args[0] !== 'string') {
    args[0] = util.inspect(args[0], null, 20, true);
    console.log('\x1b[32mCustomer:\x1b[m');
    console.log(args[0]);
    return;
  }
  if (!args[0]) return process.stderr.write('\n');
  var msg = '\x1b[32mCustomer:\x1b[m \x1b[31m'
    + util.format.apply(util.format, args) + '\x1b[m';
  return process.stderr.write(msg + '\n');
}

/**
 * Execute
 */

if (isNode) {
  if (!module.parent) {
    sendPayment(function(err) {
      if (err) return error(err.message);
      print('Payment sent successfully.');
    });
  } else {
    var customer = sendPayment;
    customer.sendPayment = sendPayment;
    customer.print = print;
    customer.error = error;
    module.exports = customer;
  }
} else {
  var customer = sendPayment;
  customer.sendPayment = sendPayment;
  customer.print = print;
  customer.error = error;
  window.customer = window.sendPayment = customer;
  window.onload = function() {
    var form = document.getElementsByTagName('form')[0];
    var memo = document.querySelector('input[name="memo"]');
    var loader = document.getElementById('load');
    loader.style.display = 'none';
    form.onsubmit = function() {
      form.style.display = 'none';
      loader.style.display = 'block';
      form.onsubmit = function() { return false; };
      customer.sendPayment(memo.value || null, function(err) {
        loader.style.display = 'none';
        if (err) return error(err.message);
        print('Payment sent successfully.');
      });
      return false;
    };
  };
}

}).call(function() {
  return this || (typeof window !== 'undefined' ? window : global);
}());
