var $ = require('preconditions').singleton();

var WalletUtils = require('bitcore-wallet-utils');
var Bitcore = WalletUtils.Bitcore;
var BitcorePayPro = require('bitcore-payment-protocol');
var PayPro = {};

PayPro._nodeRequest = function(opts, cb) {
  opts.agent = false;
  var http = opts.httpNode || (opts.proto === 'http' ? require("http") : require("https"));

  var fn = opts.method == 'POST' ? 'post': 'get';

  http[fn](opts, function(res) {
    if (res.statusCode != 200)
      return cb('HTTP Request Error');

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
    return cb(status);
  };

  xhr.send(null);
};

PayPro.get = function(opts, cb) {
  $.checkArgument(opts && opts.url);

  var http = opts.http;
  opts.headers = opts.headers || {
    'Accept': BitcorePayPro.PAYMENT_REQUEST_CONTENT_TYPE,
    'Content-Type': 'application/octet-stream',
  };

  if (!http) {
    var env = opts.env;
    if (!env)
      env = (process && !process.browser) ? 'node' : 'browser';

    if (env == "node") {
      http = PayPro._nodeRequest;
    } else {
      http = PayPro._browserRequest;
    }
  }

  var match = opts.url.match(/^((http[s]?|ftp):\/)?\/?([^:\/\s]+)((\/\w+)*\/)([\w\-\.]+[^#?\s]+)(.*)?(#[\w\-]+)?$/);

  opts.proto = RegExp.$2;
  opts.host = RegExp.$3;
  opts.path = RegExp.$4 + RegExp.$6;

  http(opts, function(err, dataBuffer) {
    if (err) return cb(err);
    var request;
    try {
      var body = BitcorePayPro.PaymentRequest.decode(dataBuffer);
      request = (new BitcorePayPro()).makePaymentRequest(body);
    } catch (e) {
      return cb('Could not parse payment protocol:' + e)
    }

    var signature = request.get('signature');
    var serializedDetails = request.get('serialized_payment_details');

    // Verify the signature
    var verified = request.verify(true);

    // Get the payment details
    var decodedDetails = BitcorePayPro.PaymentDetails.decode(serializedDetails);
    var pd = new BitcorePayPro();
    pd = pd.makePaymentDetails(decodedDetails);

    var outputs = pd.get('outputs');
    if (outputs.length > 1)
      return cb(new Error('Payment Protocol Error: Requests with more that one output are not supported'))

    var output = outputs[0];

    var amount = output.get('amount');
    amount = amount.low + amount.high * 0x100000000;


    var network = pd.get('network') == 'test' ? 'testnet' : 'livenet';

    // We love payment protocol
    var offset = output.get('script').offset;
    var limit = output.get('script').limit;

    // NOTE: For some reason output.script.buffer
    // is only an ArrayBuffer
    var buffer = new Buffer(new Uint8Array(output.get('script').buffer));
    var scriptBuf = buffer.slice(offset, limit);
    var addr = new Bitcore.Address.fromScript(new Bitcore.Script(scriptBuf), network);

    return cb(null, {
      verified: verified.verified,
      verifyData: {
        caName: verified.caName,
        selfSigned: verified.selfSigned,
      },
      expires: pd.get('expires'),
      memo: pd.get('memo'),
      time: pd.get('time'),
      toAddress: addr.toString(),
      amount: amount,
      network: network,
      domain: opts.host,
      url: opts.url,
    });
  });
};

module.exports = PayPro;
