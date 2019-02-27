var $ = require('preconditions').singleton();
const URL = require('url');
const _ = require('lodash');
var Bitcore = require('bitcore-lib');
var Bitcore_ = {
  btc: Bitcore,
  bch: require('bitcore-lib-cash'),
};
const JSON_PAYMENT_REQUEST_CONTENT_TYPE = 'application/payment-request';
const JSON_PAYMENT_VERIFY_CONTENT_TYPE = 'application/verify-payment';
const JSON_PAYMENT_CONTENT_TYPE = 'application/payment';
const JSON_PAYMENT_ACK_CONTENT_TYPE = 'application/payment-ack';


var PayPro = {};

PayPro._nodeRequest = function(opts, cb) {
  opts.agent = false;

  var http = opts.httpNode || (opts.proto === 'http' ? require("http") : require("https"));

  const url =  URL.parse(opts.url);
  let ropts = {
    headers: opts.headers,
    method: opts.method || 'GET',
    hostname: url.host,
    port:url.port ||  (opts.proto === 'http' ? 80 : 443),
    path:url.path,
    protocol: url.protocol,
    agent: false,
  };

  var req  = http.request(ropts, function(res) {
    var data = []; // List of Buffer objects

    if (res.statusCode != 200)
      return cb(new Error('HTTP Request Error: '  + res.statusCode + ' ' + res.statusMessage + ' ' +  ( data ? data : '' )  ));

    res.on("data", function(chunk) {
      data.push(chunk); // Append Buffer object
    });
    res.on("end", function() {
      data = Buffer.concat(data); // Make one large Buffer of it
      return cb(null, data);
    });
  });

  req.on("error", function(error) {
    return cb(error);
  });

  if (opts.body) 
    req.write(opts.body);

  req.end();
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
    if (xhr.status == 200) {
      return cb(null, Buffer.from(response));
    } else {
      return cb('HTTP Request Error: '  + xhr.status + ' ' + xhr.statusText + ' ' + response ? response : '');
    }
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

  if (opts.http) {
    return opts.http;
  }

  var env = opts.env;
  if (!env)
    env = (process && !process.browser) ? 'node' : 'browser';

  return (env == "node") ? PayPro._nodeRequest : http = PayPro._browserRequest;;
};

const MAX_FEE_PER_KB = 500000;

PayPro.get = function(opts, cb) {
  $.checkArgument(opts && opts.url);

  var http = getHttp(opts);
  var coin = opts.coin || 'btc';
  var bitcore = Bitcore_[coin];

  var COIN = coin.toUpperCase();
  opts.headers = opts.headers || {
    'Accept': JSON_PAYMENT_REQUEST_CONTENT_TYPE,
    'Content-Type': 'application/octet-stream',
  };

  http(opts, function(err, data) {
    if (err) return cb(err);
    try {
      data = JSON.parse(data.toString());

    } catch (e)  {
      return cb(e);
    }
    // read and check
    let ret = {};
    ret.url = opts.url;

    // TODO TODO TODO
    ret.verified= 1;

    // network
    if(data.network == 'test') 
      ret.network = 'testnet';

    if(data.network == 'live') 
      ret.network = 'livenet';

    if ( !data.network )
      return cb(new Error('No network at payment request'));

    //currency
    if ( data.currency != COIN )
      return cb(new Error('Currency mismatch. Expecting:' + COIN));

    ret.coin = coin;


    //fee
    if ( data.requiredFeeRate > MAX_FEE_PER_KB)
      return cb(new Error('Fee rate too high:' +data.requiredFeeRate));

    ret.requiredFeeRate = data.requiredFeeRate;

    //outputs
    if (!data.outputs || data.outputs.length !=1) {
      return cb(new Error('Must have 1 output'));
    }

    if (!_.isNumber(data.outputs[0].amount) ) {
      return cb(new Error('Bad output amount ' + e));
    }
    ret.amount = data.outputs[0].amount;

    try {
      ret.toAddress = (new bitcore.Address(data.outputs[0].address)).toString();
    } catch (e) {
      return cb(new Error('Bad output address '+ e));
    }
    
    ret.memo = data.memo;
    ret.paymentId = data.paymentId;
    try {
      ret.expires = (new Date(data.expires)).toISOString();
    } catch (e) {
      return cb(new Error('Bad expiration'));
    }

    return cb(null, ret);
  });
};



PayPro.send = function(opts, cb) {
  $.checkArgument(opts.rawTxUnsigned)
    .checkArgument(opts.url)
    .checkArgument(opts.rawTx);


  var coin = opts.coin || 'btc';
  var COIN = coin.toUpperCase();

  var http = getHttp(opts);
  opts.method = 'POST';
  opts.headers = opts.headers || {
    'Content-Type': JSON_PAYMENT_VERIFY_CONTENT_TYPE,
  };
  let size = opts.rawTx.length/2;
  opts.body = JSON.stringify({
    "currency": COIN,
    "unsignedTransaction": opts.rawTxUnsigned,
    "weightedSize": size,
  });

  // verify request
  http(opts, function(err, rawData) {
    if (err) {
      console.log('Error at verify-payment:', err, opts);
      return cb(err);
    }

    opts.headers = {
      'Content-Type': JSON_PAYMENT_CONTENT_TYPE,
      'Accept': JSON_PAYMENT_ACK_CONTENT_TYPE,
    };

    opts.body = JSON.stringify({
      "currency": COIN,
      "transactions": [
        opts.rawTx,
      ],
    });

    http(opts, function(err, rawData) {
      if (err) {
        console.log('Error at payment:', err, opts);
        return cb(err);
      }
  
      var memo;
      if (rawData) {
        try {
          var data = JSON.parse(rawData.toString());
          memo = data.memo;
        } catch (e) {
          console.log('Could not decode paymentACK');
        };
      }
      return cb(null, rawData, memo);
    });
  });
};

module.exports = PayPro;
