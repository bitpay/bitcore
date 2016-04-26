# Payment Protocol
`PaymentProtocol` and associated functions and methods will serialize, deserialize, sign and verify payment protocol messages both in Node.js and web browsers. Both X.509 and [bitcoin identity protocol](https://en.bitcoin.it/wiki/Identity_protocol_v1) are supported. For detailed technical information, please view [BIP70](https://github.com/bitcoin/bips/blob/master/bip-0070.mediawiki).

## Installation
Payment protocol is implemented as a separate module and you must add it to your dependencies:

For node projects:

```
npm install bitcore-lib --save
npm install bitcore-payment-protocol --save
```

For client-side projects:

```
bower install bitcore-lib --save
bower install bitcore-payment-protocol --save
```

## Make Payment Details
Here the merchant's server will construct the payment details message:

```javascript
var PaymentProtocol = require('bitcore-payment-protocol');
var now = Date.now() / 1000 | 0;

// construct the payment details
var details = new PaymentProtocol().makePaymentDetails();
details.set('network', 'test');
details.set('outputs', outputs);
details.set('time', now);
details.set('expires', now + 60 * 60 * 24);
details.set('memo', 'A payment request from the merchant.');
details.set('payment_url', 'https://localhost/-/pay');
details.set('merchant_data', new Buffer({size: 7})); // identify the request
```

For more information about these fields please visit [BIP70](https://github.com/bitcoin/bips/blob/master/bip-0070.mediawiki#paymentdetailspaymentrequest)

## Sign a Payment Request
The merchant's server will then construct a payment request and send it to the customer:

```javascript
// load the X509 certificate
var certificates = new PaymentProtocol().makeX509Certificates();
certificates.set('certificate', [file_with_x509_der_cert]);

// form the request
var request = new PaymentProtocol().makePaymentRequest();
request.set('payment_details_version', 1);
request.set('pki_type', 'x509+sha256');
request.set('pki_data', certificates.serialize());
request.set('serialized_payment_details', details.serialize());
request.sign(file_with_x509_private_key);

// serialize the request
var rawbody = request.serialize();

// Example HTTP Response Headers:
// Content-Type: PaymentProtocol.PAYMENT_REQUEST_CONTENT_TYPE
// Content-Length: request.length
// Content-Transfer-Encoding: 'binary'
```

## Verify a Payment Request
The customers wallet would then verify the payment request as follows (after asking for the payment request message):

```javascript

// Example HTTP Request Headers:
// Method: GET
// Accept: PaymentProtocol.PAYMENT_REQUEST_CONTENT_TYPE, PaymentProtocol.PAYMENT_ACK_CONTENT_TYPE
// Content-Type: 'application/octet-stream'
// Content-Length: 0

var body = PaymentProtocol.PaymentRequest.decode(rawbody);
var request = new PaymentProtocol().makePaymentRequest(body);

var version = request.get('payment_details_version');
var pki_type = request.get('pki_type');
var pki_data = request.get('pki_data');
var serializedDetails = request.get('serialized_payment_details');
var signature = request.get('signature');

// Verify the signature
var verified = request.verify();

// Get the payment details
var decodedDetails = PaymentProtocol.PaymentDetails.decode(serializedDetails);
var details = new PaymentProtocol().makePaymentDetails(decodedDetails);
var network = details.get('network');
var outputs = details.get('outputs');
var time = details.get('time');
var expires = details.get('expires');
var memo = details.get('memo');
var payment_url = details.get('payment_url');
var merchant_data = details.get('merchant_data');
```

## Send a Payment
After the request is verified a payment can be sent to the merchant from the customer's wallet:

```javascript

// send the payment transaction
var payment = new PaymentProtocol().makePayment();
payment.set('merchant_data', merchant_data);
payment.set('transactions', [transaction_with_outputs]); // as from payment details

// define the refund outputs
var refund_outputs = [];
var outputs = new PaymentProtocol().makeOutput();
outputs.set('amount', 0);
outputs.set('script', script.toBuffer()); // an instance of script
refund_outputs.push(outputs.message);

payment.set('refund_to', refund_outputs);
payment.set('memo', 'Here is a payment');

// serialize and send
var rawbody = pay.serialize();

// Example Request Headers:
// Method: 'POST',
// Accept: PaymentProtocol.PAYMENT_REQUEST_CONTENT_TYPE, PaymentPrococl.PAYMENT_ACK_CONTENT_TYPE
// Content-Type: PaymentProtocol.PAYMENT_CONTENT_TYPE
// Content-Length: payment.length
// Content-Transfer-Encoding: 'binary'
```

## Receive a Payment
The merchant would then receive the payment as follows:

```javascript

var body = PaymentProtocol.Payment.decode(rawbody);
var payment = new PaymentProtocol().makePayment(body);
var merchant_data = payment.get('merchant_data');
var transactions = payment.get('transactions');
var refund_to = payment.get('refund_to');
var memo = payment.get('memo');

// send the transaction to the bitcoin network
```

## Send a Payment Acknowledgement
After the payment has been broadcasted, a payment acknowledgement can be sent in response:

```javascript

// make a payment acknowledgement
var ack = new PaymentProtocol().makePaymentACK();
ack.set('payment', payment.message);
ack.set('memo', 'Thank you for your payment!');
var rawbody = ack.serialize();

// Example Response Headers:
// Content-Type: PaymentProtocol.PAYMENT_ACK_CONTENT_TYPE
// Content-Length: ack.length
// Content-Transfer-Encoding: 'binary'
```

## Receive an Acknowledgement
The customer's wallet can then receive an acknowledgement of payment as follows:

```javascript
var body = PaymentProtocol.PaymentACK.decode(rawbody);
var ack = new PaymentProtocol().makePaymentACK(body);
var serializedPayment = ack.get('payment');
var memo = ack.get('memo');
var decodedPayment = PaymentProtocol.Payment.decode(serializedPayment);
var payment = new PaymentProtocol().makePayment(decodedPayment);
var tx = payment.message.transactions[0];
```

For detailed diagram of the exchange of messages, please see the [Protocol section of BIP70](https://github.com/bitcoin/bips/blob/master/bip-0070.mediawiki#protocol).
