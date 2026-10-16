'use strict';

import { ethers } from '@bitpay-labs/crypto-wallet-core';
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

  // `payProJsonV2.eth`/`.erc20`/`.xrp`/`.sol` are signed with a test-only
  // keypair rather than a real BitPay key, so `PayProV2.trustedKeys` must
  // trust that key for the duration of these cases (mirrors the `domains`
  // stub already used for the real keys in api.test.ts).
  describe('account-chain fixtures (test-signed)', () => {
    let savedTrustedKeys;

    beforeEach(() => {
      savedTrustedKeys = PayProV2.trustedKeys;
      PayProV2.trustedKeys = {
        ...savedTrustedKeys,
        [TestData.payProJsonV2TestKey.identity]: TestData.payProJsonV2TestKey.keyData
      };
    });

    afterEach(() => {
      PayProV2.trustedKeys = savedTrustedKeys;
    });

    const approveIface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
    const payIface = new ethers.Interface([
      'function pay(uint256 value, uint256 gasPrice, uint256 expiration, bytes32 payload, bytes32 hash, uint8 v, bytes32 r, bytes32 s, address tokenContract)'
    ]);

    const cases = [
      {
        description: 'a native ETH transfer',
        fixture: 'eth',
        assert: res => {
          res.currency.should.equal('ETH');
          res.instructions.should.have.lengthOf(1);
          const [ix] = res.instructions;
          ix.toAddress.should.equal('0x52dE8D3fEbd3a06d3c627f59D56e6892B80DCf12');
          ix.amount.should.equal(5214000000000000);
          // This fixture is a real, unmodified 2019 BitPay invoice response
          // (see bodyV2.eth) -
          // Invoice.pay(...)'s decoded `value` matching the instruction's
          // own `amount`/`value` fields confirms the calldata genuinely
          // encodes this same payment, not just a matching selector.
          const decoded = payIface.decodeFunctionData('pay', ix.data);
          decoded.value.should.equal(5214000000000000n);
          decoded.tokenContract.should.equal(ethers.ZeroAddress); // native ETH, not a token
        }
      },
      {
        description: 'two ordered ERC-20 approve/pay instructions',
        fixture: 'erc20',
        assert: res => {
          res.currency.should.equal('USDC');
          res.instructions.should.have.lengthOf(2);
          const [approveIx, payIx] = res.instructions;

          // Mainnet USDC's real contract address
          approveIx.toAddress.should.equal('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
          approveIx.amount.should.equal(0);
          const [spender, approveAmount] = approveIface.decodeFunctionData('approve', approveIx.data);
          spender.should.equal('0x1BA1E35A29E2A52a1b1A1e2c8dbB28B9B5B6f7C1');
          approveAmount.should.equal(10000000n);

          payIx.toAddress.should.equal('0x1BA1E35A29E2A52a1b1A1e2c8dbB28B9B5B6f7C1');
          payIx.amount.should.equal(0);
          const decodedPay = payIface.decodeFunctionData('pay', payIx.data);
          decodedPay.value.should.equal(10000000n);
          decodedPay.tokenContract.should.equal('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
        }
      },
      {
        description: 'an XRP destination tag and invoice ID',
        fixture: 'xrp',
        assert: res => {
          res.currency.should.equal('XRP');
          res.instructions.should.have.lengthOf(1);
          res.instructions[0].toAddress.should.equal('rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh');
          res.instructions[0].amount.should.equal(10000);
          res.instructions[0].outputs[0].destinationTag.should.equal(12345);
          res.instructions[0].outputs[0].invoiceID.should.equal(
            '0000000000000000000000000000000000000000000000000000000000000001'
          );
        }
      },
      {
        description: 'a SOL invoice memo',
        fixture: 'sol',
        assert: res => {
          res.currency.should.equal('SOL');
          res.instructions.should.have.lengthOf(1);
          res.instructions[0].toAddress.should.equal('5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d');
          res.instructions[0].amount.should.equal(10000);
          res.instructions[0].outputs[0].invoiceID.should.equal('SolInvoiceFixture1');
        }
      }
    ];
    for (const testCase of cases) {
      it(`resolves a genuinely signed PayPro V2 response for ${testCase.description}`, (done) => {
        const fixture = TestData.payProJsonV2[testCase.fixture];
        mockRequest(fixture.body, fixture.headers);
        PayProV2.selectPaymentOption({
          paymentUrl: `https://bitpay.com/i/${testCase.fixture}Fixture`
        }).then((res) => {
          testCase.assert(res);
          done();
        }).catch(err => {
          done(err);
        });
      });
    }
  });
});
