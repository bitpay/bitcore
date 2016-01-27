var $ = require('preconditions').singleton();

var Bitcore = require('bitcore-lib');
var BitcorePayPro = require('bitcore-payment-protocol');
var PayPro = {};

PayPro._nodeRequest = function(opts, cb) {
  opts.agent = false;
  var http = opts.httpNode || (opts.proto === 'http' ? require("http") : require("https"));

  var fn = opts.method == 'POST' ? 'post' : 'get';

  http[fn](opts, function(res) {
    if (res.statusCode != 200)
      return cb(new Error('HTTP Request Error'));

    var data = []; // List of Buffer objects
    res.on("data", function(chunk) {
      data.push(chunk); // Append Buffer object
    });
    res.on("end", function() {
      data = Buffer.concat(data); // Make one large Buffer of it
      return cb(null, data);
    });
  });
};

PayPro._browserRequest = function(opts, cb) {
  var method = (opts.method || 'GET').toUpperCase();
  var url = opts.url;
  var req = opts;

  req.headers = req.headers || {};
  req.body = req.body || req.data || '';

  var xhr = opts.xhr || new XMLHttpRequest();
  xhr.open(method, url, true);

  Object.keys(req.headers).forEach(function(key) {
    var val = req.headers[key];
    if (key === 'Content-Length') return;
    if (key === 'Content-Transfer-Encoding') return;
    xhr.setRequestHeader(key, val);
  });
  xhr.responseType = 'arraybuffer';

  xhr.onload = function(event) {
    var response = xhr.response;
    return cb(null, new Uint8Array(response));
  };

  xhr.onerror = function(event) {
    var status;
    if (xhr.status === 0 || !xhr.statusText) {
      status = 'HTTP Request Error';
    } else {
      status = xhr.statusText;
    }
    return cb(new Error(status));
  };

  if (req.body) {
    xhr.send(req.body);
  } else {
    xhr.send(null);
  }
};

var getHttp = function(opts) {
  var match = opts.url.match(/^((http[s]?):\/)?\/?([^:\/\s]+)((\/\w+)*\/)([\w\-\.]+[^#?\s]+)(.*)?(#[\w\-]+)?$/);

  opts.proto = RegExp.$2;
  opts.host = RegExp.$3;
  opts.path = RegExp.$4 + RegExp.$6;
  if (opts.http) return opts.http;

  var env = opts.env;
  if (!env)
    env = (process && !process.browser) ? 'node' : 'browser';

  return (env == "node") ? PayPro._nodeRequest : http = PayPro._browserRequest;;
};

PayPro.get = function(opts, cb) {
  $.checkArgument(opts && opts.url);

  var http = getHttp(opts);
  opts.headers = opts.headers || {
    'Accept': BitcorePayPro.PAYMENT_REQUEST_CONTENT_TYPE,
    'Content-Type': 'application/octet-stream',
  };

  http(opts, function(err, dataBuffer) {
    if (err) return cb(err);
    var request, verified, signature, serializedDetails;
    try {
      var body = BitcorePayPro.PaymentRequest.decode(dataBuffer);
      request = (new BitcorePayPro()).makePaymentRequest(body);
      signature = request.get('signature');
      serializedDetails = request.get('serialized_payment_details');
      // Verify the signature
      verified = request.verify(true);
    } catch (e) {
      return cb(new Error('Could not parse payment protocol: ' + e));
    }

    // Get the payment details
    var decodedDetails = BitcorePayPro.PaymentDetails.decode(serializedDetails);
    var pd = new BitcorePayPro();
    pd = pd.makePaymentDetails(decodedDetails);

    var outputs = pd.get('outputs');
    if (outputs.length > 1)
      return cb(new Error('Payment Protocol Error: Requests with more that one output are not supported'))

    var output = outputs[0];

    var amount = output.get('amount').toNumber();
    var network = pd.get('network') == 'test' ? 'testnet' : 'livenet';

    // We love payment protocol
    var offset = output.get('script').offset;
    var limit = output.get('script').limit;

    // NOTE: For some reason output.script.buffer
    // is only an ArrayBuffer
    var buffer = new Buffer(new Uint8Array(output.get('script').buffer));
    var scriptBuf = buffer.slice(offset, limit);
    var addr = new Bitcore.Address.fromScript(new Bitcore.Script(scriptBuf), network);

    var md = pd.get('merchant_data');

    if (md) {
      md = md.toString();
    }

    var ok = verified.verified;
    var caName;

    if (verified.isChain) {
      ok = ok && verified.chainVerified;
    }

    return cb(null, {
      verified: ok,
      caTrusted: verified.caTrusted,
      caName: verified.caName,
      selfSigned: verified.selfSigned,
      expires: pd.get('expires'),
      memo: pd.get('memo'),
      time: pd.get('time'),
      merchant_data: md,
      toAddress: addr.toString(),
      amount: amount,
      network: network,
      domain: opts.host,
      url: opts.url,
    });
  });
};


PayPro._getPayProRefundOutputs = function(addrStr, amount) {
  amount = amount.toString(10);

  var output = new BitcorePayPro.Output();
  var addr = new Bitcore.Address(addrStr);

  var s;
  if (addr.isPayToPublicKeyHash()) {
    s = Bitcore.Script.buildPublicKeyHashOut(addr);
  } else if (addr.isPayToScriptHash()) {
    s = Bitcore.Script.buildScriptHashOut(addr);
  } else {
    throw new Error('Unrecognized address type ' + addr.type);
  }

  //  console.log('PayPro refund address set to:', addrStr,s);
  output.set('script', s.toBuffer());
  output.set('amount', amount);
  return [output];
};


PayPro._createPayment = function(merchant_data, rawTx, refundAddr, amountSat) {
  var pay = new BitcorePayPro();
  pay = pay.makePayment();

  if (merchant_data) {
    merchant_data = new Buffer(merchant_data);
    pay.set('merchant_data', merchant_data);
  }

  var txBuf = new Buffer(rawTx, 'hex');
  pay.set('transactions', [txBuf]);

  var refund_outputs = this._getPayProRefundOutputs(refundAddr, amountSat);
  if (refund_outputs)
    pay.set('refund_to', refund_outputs);

  // Unused for now
  // options.memo = '';
  // pay.set('memo', options.memo);

  pay = pay.serialize();
  var buf = new ArrayBuffer(pay.length);
  var view = new Uint8Array(buf);
  for (var i = 0; i < pay.length; i++) {
    view[i] = pay[i];
  }

  return view;
};

PayPro.send = function(opts, cb) {
  $.checkArgument(opts.merchant_data)
    .checkArgument(opts.url)
    .checkArgument(opts.rawTx)
    .checkArgument(opts.refundAddr)
    .checkArgument(opts.amountSat);

  var payment = PayPro._createPayment(opts.merchant_data, opts.rawTx, opts.refundAddr, opts.amountSat);

  var http = getHttp(opts);
  opts.method = 'POST';
  opts.headers = opts.headers || {
    'Accept': BitcorePayPro.PAYMENT_ACK_CONTENT_TYPE,
    'Content-Type': BitcorePayPro.PAYMENT_CONTENT_TYPE,
    // 'Content-Type': 'application/octet-stream',
  };
  opts.body = payment;

  http(opts, function(err, rawData) {
    if (err) return cb(err);
    var memo;
    if (rawData) {
      try {
        var data = BitcorePayPro.PaymentACK.decode(rawData);
        var pp = new BitcorePayPro();
        var ack = pp.makePaymentACK(data);
        memo = ack.get('memo');
      } catch (e) {};
    }
    return cb(null, rawData, memo);
  });
};

module.exports = PayPro;
