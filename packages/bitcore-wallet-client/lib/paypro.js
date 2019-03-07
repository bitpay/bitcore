var $ = require('preconditions').singleton();
const URL = require('url');
const _ = require('lodash');
var Bitcore = require('bitcore-lib');
var Bitcore_ = {
  btc: Bitcore,
  bch: require('bitcore-lib-cash'),
};
const request = require('request');
const JSON_PAYMENT_REQUEST_CONTENT_TYPE = 'application/payment-request';
const JSON_PAYMENT_VERIFY_CONTENT_TYPE = 'application/verify-payment';
const JSON_PAYMENT_CONTENT_TYPE = 'application/payment';
const JSON_PAYMENT_ACK_CONTENT_TYPE = 'application/payment-ack';


const dfltTrustedKeys = require('../util/JsonPaymentProtocolKeys.js');


var PayPro = {
  request: request
};
const MAX_FEE_PER_KB = 500000;


/**
 * Verifies the signature of a given payment request is both valid and from a trusted key
 */
PayPro._verify = function (requestUrl, headers, network, trustedKeys, callback) {
  let hash = headers.digest.split('=')[1];
  let signature = headers.signature;
  let signatureType = headers['x-signature-type'];
  let identity = headers['x-identity'];
  let host;

  if (network == 'testnet') network = 'test';
  if (network == 'livenet') network = 'main';

  if (!requestUrl) {
    return callback(new Error('You must provide the original payment request url'));
  }
  if (!trustedKeys) {
    return callback(new Error('You must provide a set of trusted keys'))
  }

  try {
    host = URL.parse(requestUrl).hostname;
  }
  catch(e) {}

  if (!host) {
    return callback(new Error('Invalid requestUrl'));
  }
  if (!signatureType) {
    return callback(new Error('Response missing x-signature-type header'));
  }
  if (typeof signatureType !== 'string') {
    return callback(new Error('Invalid x-signature-type header'));
  }
  if (signatureType !== 'ecc') {
    return callback(new Error(`Unknown signature type ${signatureType}`))
  }
  if (!signature) {
    return callback(new Error('Response missing signature header'));
  }
  if (typeof signature !== 'string') {
    return callback(new Error('Invalid signature header'));
  }
  if (!identity) {
    return callback(new Error('Response missing x-identity header'));
  }
  if (typeof identity !== 'string') {
    return callback(new Error('Invalid identity header'));
  }
console.log('[paypro.js.173:identity:]',identity); //TODO

  if (!trustedKeys[identity]) {
    return callback(new Error(`Response signed by unknown key (${identity}), unable to validate`));
  }

  let keyData = trustedKeys[identity];
  if (keyData.domains.indexOf(host) === -1) {
    return callback(new Error(`The key on the response (${identity}) is not trusted for domain ${host}`));
  } else if (!keyData.networks.includes(network)) {
    return callback(new Error(`The key on the response is not trusted for transactions on the '${network}' network`));
  }

  let valid = Bitcore.crypto.ECDSA.verify(
    Buffer.from(hash, 'hex'),
    Buffer.from(signature, 'hex'),
    Buffer.from(keyData.publicKey, 'hex'),
    'little',
  );
console.log('[paypro.js.188:valid:]',valid); //TODO

  if (!valid) {
    return callback(new Error('Response signature invalid'));
  }

  return callback(null, keyData.owner);
};


PayPro.runRequest = function (opts, cb) {
  $.checkArgument(opts.network, 'should pass network');

  PayPro.request(opts, (err, res, body) => {
    if (err) return cb(err);
    let ret;

    try {
      ret = JSON.parse(body.toString());
    } catch (e)  {
      return cb({message: 'Could not retrieve payment: ' + body.toString()});
    }

    // read and check
    ret.url = opts.url;

    if (!res.headers.digest) {
      return cb(new Error('Digest missing from response headers'));
    }

    // Step 1: Check digest from header
    let digest = res.headers.digest.split('=')[1];
console.log('[paypro.js.120:digest:]',digest); //TODO
    let hash = Bitcore.crypto.Hash.sha256(Buffer.from(body,'utf8')).toString('hex');

    if (digest !== hash) {
      return cb(new Error(`Response body hash does not match digest header. Actual: ${hash} Expected: ${digest}`));
    }

    // Step 2: verify digest's signature
    PayPro._verify(opts.url, res.headers, opts.network, opts.trustedKeys, (err) => {
console.log('[paypro.js.243:err:]',err); //TODO
      if (err) return cb(err);
      ret.verified= 1;
console.log('[paypro.js.131:ret:]',ret); //TODO

      return cb(null, ret);
    });
  });
};


PayPro.get = function(opts, cb) {
  $.checkArgument(opts && opts.url);
  opts.trustedKeys = opts.trustedKeys || dfltTrustedKeys;

  var coin = opts.coin || 'btc';
  var bitcore = Bitcore_[coin];

  var COIN = coin.toUpperCase();
  opts.headers = opts.headers || {
    'Accept': JSON_PAYMENT_REQUEST_CONTENT_TYPE,
    'Content-Type': 'application/octet-stream',
  };
  opts.method = 'GET';
  opts.network = opts.network || 'livenet';

  PayPro.runRequest(opts, function(err, data) {
console.log('[paypro.js.160:err:]',err); //TODO
console.log('[paypro.js.160:data:]',data); //TODO
    if (err) return cb(err);
// TODO TODO 
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

  opts.network = opts.network || 'livenet';
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
  PayPro.runRequest(opts, function(err, rawData) {
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

    PayPro.runRequest(opts, function(err, rawData) {
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
