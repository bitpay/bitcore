'use strict';

import chai from 'chai';
import sinon from 'sinon';
import crypto from 'crypto';
import { PayPro } from '../src/lib/paypro';
import * as TestData from './data/testdata';

const should = chai.should();

function mockRequest(bodyBuf, headers) {
  bodyBuf = Array.isArray(bodyBuf) ? bodyBuf : [bodyBuf];
  PayPro.r = {
    'get': (_url) => {
      return {
        set: (_k, _v) => { },
        query: (_opts) => { },
        end: (cb) => {
          return cb(null, {
            headers: headers || {},
            statusCode: 200,
            statusMessage: 'OK',
            text: bodyBuf.shift()
          });
        }
      };
    },
    'post': (_url) => {
      return {
        set: (_k, _v) => { },
        send: (_opts) => { },
        end: (cb) => {
          return cb(null, {
            headers: headers || {},
            statusCode: 200,
            statusMessage: 'OK',
            text: bodyBuf.shift()
          });
        }
      };
    }
  } as any;

};

describe('PayPro', function() {
  let clock;
  let oldreq;
  before(function () {
    // Stub time before cert expiration at Mar 27 2016
    clock = sinon.useFakeTimers(1459105693843);
  });
  beforeEach(() => {
    oldreq = PayPro.r;
  });
  after(function () {
    clock.restore();
  });
  afterEach(function () {
    PayPro.r = oldreq;
  });

  it('Make and verify PP request', function (done) {
    mockRequest(TestData.payProJson.bch.body, TestData.payProJson.bch.headers);
    PayPro.get({
      url: 'https://test.bitpay.com/paypro',
      network: 'testnet',
      coin: 'bch',
    }, function (err, res) {
      should.not.exist(err);
      res.should.be.deep.equal({
        amount: 769200,
        coin: 'bch',
        expires: '2019-03-07T18:20:44.301Z',
        memo: 'Payment request for BitPay invoice 3oZcpotopVGcZ2stRw2dop for merchant GusPay',
        network: 'testnet',
        paymentId: '3oZcpotopVGcZ2stRw2dop',
        requiredFeeRate: 1.398,
        toAddress: 'qz78y0832kskq84rr4f9t22fequ5c0l4gu6wsehezr',
        verified: true,
      });
      done();
    });
  });


  it('Should handle a failed (404) request', function (done) {
    PayPro.r = {
      'get': (_url) => {
        return {
          set: (_k, _v) => { },
          query: (_opts) => { },
          end: (cb) => {
            return cb(null, {
              statusCode: 404,
              statusMessage: 'Not Found',
            }, 'This invoice was not found or has been archived');
          }
        };
      },
      'post': () => { }
    } as any;
    PayPro.get({
      url: 'https://test.bitpay.com/paypro',
      network: 'testnet',
      coin: 'bch',
    }, function (err, res) {
      should.exist(err);
      done();
    });
  });

  it('Should detect a tampered PP request (bad signature)', function (done) {
    const h = JSON.parse(JSON.stringify(TestData.payProJson.bch.headers));
    h.signature = crypto.randomBytes(64).toString('hex');
    mockRequest(TestData.payProJson.bch.body, h);
    PayPro.get({
      url: 'https://test.bitpay.com/paypro',
      network: 'testnet',
      coin: 'bch',
    }, function (err, res) {
      err.toString().should.contain('signature invalid');
      done();
    });
  });

  it('Should detect a tampered PP request (short signature)', function (done) {
    const h = JSON.parse(JSON.stringify(TestData.payProJson.bch.headers));
    h.signature = h.signature.slice(0, -1);
    mockRequest(TestData.payProJson.bch.body, h);
    PayPro.get({
      url: 'https://test.bitpay.com/paypro',
      network: 'testnet',
      coin: 'bch',
    }, function (err, res) {
      err.toString().should.contain('signature invalid');
      done();
    });
  });

  it('Should detect a tampered PP request (non-hex signature)', function (done) {
    const h = JSON.parse(JSON.stringify(TestData.payProJson.bch.headers));
    h.signature = crypto.randomBytes(64).toString('base64');
    mockRequest(TestData.payProJson.bch.body, h);
    PayPro.get({
      url: 'https://test.bitpay.com/paypro',
      network: 'testnet',
      coin: 'bch',
    }, function (err, res) {
      err.toString().should.contain('signature invalid');
      done();
    });
  });

  it('Should detect a tampered PP request (bogus signature)', function (done) {
    const h = JSON.parse(JSON.stringify(TestData.payProJson.bch.headers));
    h.signature = 'xx';
    mockRequest(TestData.payProJson.bch.body, h);
    PayPro.get({
      url: 'https://test.bitpay.com/paypro',
      network: 'testnet',
      coin: 'bch',
    }, function (err, res) {
      err.toString().should.contain('signature invalid');
      done();
    });
  });


  it('Should detect a tampered PP request (bad amount)', function (done) {
    let b = JSON.parse(TestData.payProJson.bch.body.toString());
    b.outputs[0].amount = 100;
    b = JSON.stringify(b);
    mockRequest(Buffer.from(b), TestData.payProJson.bch.headers);
    PayPro.get({
      url: 'https://test.bitpay.com/paypro',
      network: 'testnet',
      coin: 'bch',
    }, function (err, res) {
      err.toString().should.contain('not match digest');
      done();
    });
  });


  it('should send a PP payment', function (done) {
    const opts = {
      rawTx: 'rawTx1',
      rawTxUnsigned: 'rawTxUnsigned',
      url: 'http://an.url.com/paypro',
      coin: 'bch',
    };
    mockRequest([Buffer.from('{"memo":"Payment seems OK"}'), Buffer.from('{"memo":"memo1"}')], {
    });
    PayPro.send(opts, function (err, data, memo) {
      should.not.exist(err);
      memo.should.equal('memo1');
      done();
    });
  });


  it('should not send PP payment if verify fails', function (done) {
    const opts = {
      rawTx: 'rawTx1',
      rawTxUnsigned: 'rawTxUnsigned',
      url: 'http://an.url.com/paypro',
      coin: 'bch',
    };
    PayPro.r = {
      'post': (_url) => {
        return {
          set: (_k, _v) => { },
          send: (_opts) => { },
          end: (cb) => {
            return cb(null, {
              statusCode: 400,
              statusMessage: 'ss',
            }, 'This invoice was not found or has been archived');
          }
        };
      }
    } as any;
    PayPro.send(opts, function (err, data, memo) {
      should.exist(err);
      done();
    });
  });

});
