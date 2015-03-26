var $ = require('preconditions').singleton();

var WalletUtils = require('bitcore-wallet-utils');
var Bitcore = WalletUtils.Bitcore;
var PayPro = require('bitcore-payment-protocol');
var PayProRequest = {};

PayProRequest._nodeGet = function(opts, cb) {
  opts.agent = false;
  var http = opts.proto === 'http' ? require("http") : require("https");

  http.get(opts, function(res) {
    if (res.headers['content-type'] != PayPro.PAYMENT_REQUEST_CONTENT_TYPE)
      return cb(new Error('Bad response content type'));

    if (res.statusCode != 200)
      return cb(new Error('Bad status code'));

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

PayProRequest._browserGet = function(opts, cb) {
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
    var buf = new Uint8Array(response);
    var headers = {};
    (xhr.getAllResponseHeaders() || '').replace(
      /(?:\r?\n|^)([^:\r\n]+): *([^\r\n]+)/g,
      function($0, $1, $2) {
        headers[$1.toLowerCase()] = $2;
      }
    );
    return cb(null, buf);
  };

  xhr.onerror = function(event) {
    var status;
    if (xhr.status === 0 || !xhr.statusText) {
      status = 'HTTP Request Error: This endpoint likely does not support cross-origin requests.';
    } else {
      status = xhr.statusText;
    }
    return cb(status);
  };

  xhr.send(null);
};

PayProRequest.get = function(opts, cb) {
  $.checkArgument(opts && opts.url);

  var getter = opts.getter;

  opts.headers = opts.headers || {
    'Accept': PayPro.PAYMENT_REQUEST_CONTENT_TYPE,
    'Content-Type': 'application/octet-stream',
  };

  if (!opts.getter) {
    // node?
    if (process && !process.browser) {
      getter = PayProRequest._nodeGet;
    } else {
      getter = PayProRequest._browserGet;
    }
  }

  var match = opts.url.match(/^((http[s]?|ftp):\/)?\/?([^:\/\s]+)((\/\w+)*\/)([\w\-\.]+[^#?\s]+)(.*)?(#[\w\-]+)?$/);

  opts.proto = RegExp.$2;
  opts.host = RegExp.$3;
  opts.path = RegExp.$4 + RegExp.$6;

  getter(opts, function(err, dataBuffer) {
    if (err) return cb(err);
    var body = PayPro.PaymentRequest.decode(dataBuffer);
    var request = (new PayPro()).makePaymentRequest(body);

    var signature = request.get('signature');
    var serializedDetails = request.get('serialized_payment_details');

    // Verify the signature
    var verified = request.verify(true);

    // Get the payment details
    var decodedDetails = PayPro.PaymentDetails.decode(serializedDetails);
    var pd = new PayPro();
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

module.exports = PayProRequest;
