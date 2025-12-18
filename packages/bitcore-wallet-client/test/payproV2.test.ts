'use strict';

import { PayProV2 } from '../src/lib/payproV2';
import * as TestData from './data/testdata';

describe('PayProV2', () => {
  let oldreq;
  const header = {};
  let postArgs;
  const mockRequest = (bodyBuf, headers) => {
    PayProV2.request = {
      'get': (_url) => {
        return {
          set: (_k, _v) => {
            if (_k && _v) {
              header[_k] = _v;
            }
          },
          query: (_opts) => { },
          agent: (_opts) => { },
          end: (cb) => {
            return cb(null, {
              headers: headers || {},
              statusCode: 200,
              statusMessage: 'OK',
              text: bodyBuf
            });
          }
        };
      },
      'post': (_url) => {
        return {
          set: (_k, _v) => {
            if (_k && _v) {
              header[_k] = _v;
            }
          },
          send: (opts) => {
            const _opts = JSON.parse(opts);
            if (_opts.transactions) {
              postArgs = _opts;
            }
          },
          agent: (_opts) => { },
          end: (cb) => {
            return cb(null, {
              headers: headers || {},
              statusCode: 200,
              statusMessage: 'OK',
              text: bodyBuf
            });
          }
        };
      }
    };
  };
  beforeEach(() => {
    oldreq = PayProV2.request;
  });
  afterEach(() => {
    PayProV2.request = oldreq;
  });
  describe('_asyncRequest', () => {

    it('Should handle a failed (404) request', (done) => {
      const header = {};
      PayProV2.request = {
        'post': (_url) => {
          return {
            set: (_k, _v) => {
              if (_k && _v) {
                header[_k] = _v;
              }
            },
            send: (opts) => {
              const _opts = JSON.parse(opts);
              if (_opts.transactions) {
                postArgs = _opts;
              }
            },
            query: (_opts) => { },
            agent: (_opts) => { },
            end: (cb) => {
              return cb('error', {
                headers: TestData.payProJsonV2.btc.headers,
                statusCode: 404,
                statusMessage: 'Not Found',
                text: null,
                body: {
                  msg: 'This invoice was not found or has been archived'
                }
              });
            }
          };
        }
      };
      PayProV2._asyncRequest({
        url: 'https://bitpay.com/i/LanynqCPoL2JQb8z8s5Z3X',
        method: 'post',
        headers: {
          'Content-Type': 'application/payment-request',
          'x-paypro-version': 2
        },
        args: JSON.stringify({
          chain: 'livenet',
          currency: 'btc'
        })
      }).then(res => {
        res.should.not.exist;
      }).catch(err => {
        err.toString().should.contain('The invoice is no available.');
        done();
      });
    });

    it('Should handle a failed (400) request', (done) => {
      const header = {};
      PayProV2.request = {
        'post': (_url) => {
          return {
            set: (_k, _v) => {
              if (_k && _v) {
                header[_k] = _v;
              }
            },
            send: (opts) => {
              const _opts = JSON.parse(opts);
              if (_opts.transactions) {
                postArgs = _opts;
              }
            },
            query: (_opts) => { },
            agent: (_opts) => { },
            end: (cb) => {
              return cb('error', {
                headers: TestData.payProJsonV2.btc.headers,
                statusCode: 400,
                statusMessage: 'Not Found',
                text: null,
                body: {
                  msg: 'Invoice no longer accepting payments'
                }
              });
            }
          };
        }
      };
      PayProV2._asyncRequest({
        url: 'https://bitpay.com/i/LanynqCPoL2JQb8z8s5Z3X',
        method: 'post',
        headers: {
          'Content-Type': 'application/payment-request',
          'x-paypro-version': 2
        },
        args: JSON.stringify({
          chain: 'livenet',
          currency: 'btc'
        })
      }).then(res => {
        res.should.not.exist;
      }).catch(err => {
        err.toString().should.contain('The invoice is no longer receiving payments.');
        done();
      });
    });

    it('Should handle a failed (500) request', (done) => {
      const header = {};
      PayProV2.request = {
        'post': (_url) => {
          return {
            set: (_k, _v) => {
              if (_k && _v) {
                header[_k] = _v;
              }
            },
            send: (opts) => {
              const _opts = JSON.parse(opts);
              if (_opts.transactions) {
                postArgs = _opts;
              }
            },
            query: (_opts) => { },
            agent: (_opts) => { },
            end: (cb) => {
              return cb('error', {
                headers: TestData.payProJsonV2.btc.headers,
                statusCode: 500,
                statusMessage: 'Not Found',
                text: null,
                body: {
                  msg: 'Error broadcasting payment to network'
                }
              });
            }
          };
        }
      };
      PayProV2._asyncRequest({
        url: 'https://bitpay.com/i/LanynqCPoL2JQb8z8s5Z3X',
        method: 'post',
        headers: {
          'Content-Type': 'application/payment-request',
          'x-paypro-version': 2
        },
        args: JSON.stringify({
          chain: 'livenet',
          currency: 'btc'
        })
      }).then(res => {
        res.should.not.exist;
      }).catch(err => {
        err.toString().should.exist;
        done();
      });
    });
    it('should return rawBody and headers', (done) => {
      mockRequest(TestData.payProJson.btc.body, TestData.payProJson.btc.headers);
      PayProV2._asyncRequest({
        url: 'https://bitpay.com/i/LanynqCPoL2JQb8z8s5Z3X',
        method: 'post',
        headers: {
          'Content-Type': 'application/payment-request',
          'x-paypro-version': 2
        },
        args: JSON.stringify({
          chain: 'livenet',
          currency: 'btc'
        })
      }).then(res => {
        res.rawBody.should.exist;
        res.headers.should.exist;
        done();
      }).catch(err => {
        err.should.not.exist;
      });
    });

  });

  describe('getPaymentOptions', () => {

    it('should get payment options if everthing is ok', (done) => {
      mockRequest(TestData.payProJsonV2.btc.body, TestData.payProJsonV2.btc.headers);
      const opts = {
        paymentUrl: 'https://bitpay.com/i/LanynqCPoL2JQb8z8s5Z3X'
      };
      PayProV2.getPaymentOptions(opts).then((res) => {
        res.should.exist;
        done();
      }).catch(err => {
        err.should.not.exist;
      });
    });

    it('should fail if the protocol is invalid', (done) => {
      mockRequest(TestData.payProJsonV2.btc.body, TestData.payProJsonV2.btc.headers);
      const opts = {
        paymentUrl: 'bitpay.com/i/LanynqCPoL2JQb8z8s5Z3X'
      };
      PayProV2.getPaymentOptions(opts).then((res) => {
        res.should.not.exist;
      }).catch(err => {
        err.toString().should.contain('Invalid payment protocol url');
        done();
      });
    });


  });
  describe('selectPaymentOption', () => {

    it('should work if the params passed are correct', (done) => {
      mockRequest(TestData.payProJsonV2.btc.body, TestData.payProJsonV2.btc.headers);
      const opts = {
        paymentUrl: 'https://bitpay.com/i/LanynqCPoL2JQb8z8s5Z3X'
      };
      PayProV2.selectPaymentOption(opts).then((res) => {
        res.should.exist;
        done();
      }).catch(err => {
        err.should.not.exist;
      });
    });

    it('should fail if the url is not provided', (done) => {
      mockRequest(TestData.payProJsonV2.btc.body, TestData.payProJsonV2.btc.headers);
      const opts = { paymentUrl: '' };
      PayProV2.selectPaymentOption(opts).then((res) => {
        res.should.not.exist;
      }).catch(err => {
        err.toString().should.contain('Parameter requestUrl is required');
        done();
      });
    });
  });

  describe('verifyUnsignedPayment', () => {

    it('should verify fails if the params are incomplete', (done) => {
      mockRequest(TestData.payProJsonV2.btc.body, TestData.payProJsonV2.btc.headers);
      const opts = {
        paymentUrl: 'https://bitpay.com/i/LanynqCPoL2JQb8z8s5Z3X',
        chain: 'BTC',
        currency: '',
        unsignedTransactions: [],
      };
      PayProV2.verifyUnsignedPayment(opts).then((res) => {
        res.should.not.exist;
      }).catch(err => {
        err.should.exist;
        done();
      });
    });
  });
});
