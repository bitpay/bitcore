'use strict';

import * as chai from 'chai';
import 'chai/register-should';
import sinon from 'sinon';
import request from 'request';
import http from 'http';
import log from 'npmlog';
import config from '../src/config';
import { Common } from '../src/lib/common';
import { WalletService } from '../src/lib/server';
import { ExpressApp } from '../src/lib/expressapp';
import { ClientError } from '../src/lib/errors/clienterror';
import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import * as TestData from './testdata';
import { Stats } from '../src/lib/stats';

const Defaults = Common.Defaults;
const should = chai.should();

describe('ExpressApp', function() {
  const sandbox = sinon.createSandbox();
  beforeEach(function() {
    log.level = 'error';
    config.disableLogs = true;
  });
  afterEach(function() {
    sandbox.restore();
  });
  describe('#constructor', function() {
    it('will set an express app', function() {
      const express = new ExpressApp();
      should.exist(express.app);
      should.exist(express.app.use);
      should.exist(express.app.enable);
    });
  });
  describe('#start', function() {
    it('will listen at the specified port', function(done) {
      const initializeStub = sandbox.stub(WalletService, 'initialize').callsArg(1);
      const app = new ExpressApp();
      app.start(config, function(err) {
        should.not.exist(err);
        initializeStub.callCount.should.equal(1);
        done();
      });           
    });

    describe('Routes', function() {
      const testPort = 3239;
      const testHost = 'http://127.0.0.1';
      let httpServer;

      function start(ExpressApp, done) {
        const app = new ExpressApp();
        httpServer = new http.Server(app.app);

        app.start(config, function(err) {
          should.not.exist(err);
          httpServer.listen(testPort);
          done();
        });
      };

      afterEach(function() {
        httpServer.close();
      });

      describe('Public query validation', function() {
        let runStats, getFiatRate;

        beforeEach(function() {
          runStats = sandbox.stub(Stats.prototype, 'run').callsArgWith(0, null, {});
          getFiatRate = sinon.stub().callsArgWith(1, null, {});
          sandbox.stub(WalletService, 'initialize').callsArg(1);
          sandbox.stub(WalletService, 'getInstance').returns({ getFiatRate } as any);
        });

        const targets = [
          { path: '/v1/stats/', parameter: 'network' },
          { path: '/v1/stats/', parameter: 'coin' },
          { path: '/v1/fiatrates/USD/', parameter: 'coin' }
        ];

        for (const { path, parameter } of targets) {
          const value = parameter === 'network' ? 'livenet' : 'btc';
          // Cover operator objects, bracket arrays, and duplicate parameters.
          const invalidQueries = [
            `${parameter}[$regex]=.*`,
            `${parameter}[]=${value}`,
            `${parameter}=${value}&${parameter}=${value}`
          ];
          for (const query of invalidQueries) {
            it(`should reject ${path}?${query} before accessing data`, function(done) {
              start(ExpressApp, function() {
                request({ url: testHost + ':' + testPort + config.basePath + path + '?' + query, json: true }, function(err, res, body) {
                  should.not.exist(err);
                  res.statusCode.should.equal(400);
                  body.code.should.equal('BADREQUEST');
                  runStats.called.should.equal(false);
                  getFiatRate.called.should.equal(false);
                  done();
                });
              });
            });
          }
        }

        for (const query of ['', '?coin=&network=']) {
          it(`should preserve stats defaults for ${query || 'omitted parameters'}`, function(done) {
            start(ExpressApp, function() {
              request({ url: testHost + ':' + testPort + config.basePath + '/v1/stats/' + query, json: true }, function(err, res) {
                should.not.exist(err);
                res.statusCode.should.equal(200);
                runStats.calledOnce.should.equal(true);
                runStats.firstCall.thisValue.coin.should.equal('btc');
                runStats.firstCall.thisValue.network.should.equal('livenet');
                done();
              });
            });
          });
        }

        it('should pass valid stats filters through unchanged', function(done) {
          start(ExpressApp, function() {
            const query = '?coin=eth&network=testnet&from=2026-01-01&to=2026-02-01';
            request({ url: testHost + ':' + testPort + config.basePath + '/v1/stats/' + query, json: true }, function(err, res) {
              should.not.exist(err);
              res.statusCode.should.equal(200);
              runStats.calledOnce.should.equal(true);
              const stats = runStats.firstCall.thisValue;
              stats.coin.should.equal('eth');
              stats.network.should.equal('testnet');
              stats.from.should.equal('2026-01-01');
              stats.to.should.equal('2026-02-01');
              done();
            });
          });
        });

        for (const query of ['', '?coin=']) {
          it(`should preserve the fiat coin default for ${query || 'omitted parameters'}`, function(done) {
            start(ExpressApp, function() {
              request({ url: testHost + ':' + testPort + config.basePath + '/v1/fiatrates/USD/' + query, json: true }, function(err, res) {
                should.not.exist(err);
                res.statusCode.should.equal(200);
                getFiatRate.calledOnceWithExactly({ code: 'USD', coin: 'btc', ts: null }, sinon.match.func).should.equal(true);
                done();
              });
            });
          });
        }

        it('should pass a valid fiat coin and numeric timestamp through unchanged', function(done) {
          start(ExpressApp, function() {
            const query = '?coin=eth&ts=1700000000000';
            request({ url: testHost + ':' + testPort + config.basePath + '/v1/fiatrates/EUR/' + query, json: true }, function(err, res) {
              should.not.exist(err);
              res.statusCode.should.equal(200);
              getFiatRate.calledOnceWithExactly({ code: 'EUR', coin: 'eth', ts: 1700000000000 }, sinon.match.func).should.equal(true);
              done();
            });
          });
        });
      });

      it('/v2/wallets', function(done) {
        const server = {
          getStatus: sinon.stub().callsArgWith(1, null, {}),
        };
        sandbox.stub(WalletService, 'initialize').callsArg(1);
        sandbox.stub(WalletService, 'getInstanceWithAuth').callsArgWith(1, null, server);
        start(ExpressApp, function() {
          const requestOptions = {
            url: testHost + ':' + testPort + config.basePath + '/v2/wallets',
            headers: {
              'x-identity': 'identity',
              'x-signature': 'signature'
            }
          };
          request(requestOptions, function(err, res, body) {
            should.not.exist(err);
            should.exist(res.headers['x-service-version']);
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            res.headers['x-service-version'].should.equal('bws-' + require('../package').version);
            res.statusCode.should.equal(200);
            body.should.equal('{}');
            done();
          });
        });
      });

      it('/v1/addresses', function(done) {
        const server = {
          getAddresses: sinon.stub().callsArgWith(1, null, {}),
        };
        sandbox.stub(WalletService, 'initialize').callsArg(1);
        sandbox.stub(WalletService, 'getInstanceWithAuth').callsArgWith(1, null, server);
        start(ExpressApp, function() {
          const requestOptions = {
            url: testHost + ':' + testPort + config.basePath + '/v1/addresses?limit=4&reverse=1',
            headers: {
              'x-identity': 'identity',
              'x-signature': 'signature'
            }
          };
          request(requestOptions, function(err, res, body) {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            const args = server.getAddresses.getCalls()[0].args[0];
            args.limit.should.equal(4);
            args.reverse.should.be.true;
            args.noChange.should.be.true;
            done();
          });
        });
      });

      it('/v2/addresses', function(done) {
        const server = {
          getAddresses: sinon.stub().callsArgWith(1, null, {}),
        };
        sandbox.stub(WalletService, 'initialize').callsArg(1);
        sandbox.stub(WalletService, 'getInstanceWithAuth').callsArgWith(1, null, server);
        start(ExpressApp, function() {
          const requestOptions = {
            url: testHost + ':' + testPort + config.basePath + '/v2/addresses?limit=4&reverse=1',
            headers: {
              'x-identity': 'identity',
              'x-signature': 'signature'
            }
          };
          request(requestOptions, function(err, res, body) {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            const args = server.getAddresses.getCalls()[0].args[0];
            args.limit.should.equal(4);
            args.reverse.should.be.true;
            args.noChange.should.be.false;
            done();
          });
        });
      });

      it('/latest-version', function(done) {
        const htmlString = {
          'url': 'https://api.github.com/repos/bitpay/wallet/releases/21158137',
          'assets_url': 'https://api.github.com/repos/bitpay/wallet/releases/21158137/assets',
          'upload_url': 'https://uploads.github.com/repos/bitpay/wallet/releases/21158137/assets{?name,label}',
          'html_url': 'https://github.com/bitpay/wallet/releases/tag/v8.2.2',
          'id': 21158137,
          'node_id': 'MDc6UmVsZWFzZTIxMTU4MTM3',
          'tag_name': 'v8.2.2',
          'target_commitish': 'master',
          'name': 'v8.2.2',
          'draft': false,
          'author': {
            'login': 'cmgustavo',
            'id': 237435,
            'node_id': 'MDQ6VXNlcjIzNzQzNQ==',
            'avatar_url': 'https://avatars3.githubusercontent.com/u/237435?v=4',
            'gravatar_id': '',
            'url': 'https://api.github.com/users/cmgustavo',
            'html_url': 'https://github.com/cmgustavo',
            'followers_url': 'https://api.github.com/users/cmgustavo/followers',
            'following_url': 'https://api.github.com/users/cmgustavo/following{/other_user}',
            'gists_url': 'https://api.github.com/users/cmgustavo/gists{/gist_id}',
            'starred_url': 'https://api.github.com/users/cmgustavo/starred{/owner}{/repo}',
            'subscriptions_url': 'https://api.github.com/users/cmgustavo/subscriptions',
            'organizations_url': 'https://api.github.com/users/cmgustavo/orgs',
            'repos_url': 'https://api.github.com/users/cmgustavo/repos',
            'events_url': 'https://api.github.com/users/cmgustavo/events{/privacy}',
            'received_events_url': 'https://api.github.com/users/cmgustavo/received_events',
            'type': 'User',
            'site_admin': false
          },
          'prerelease': false,
          'created_at': '2019-10-29T14:09:01Z',
          'published_at': '2019-11-01T19:50:37Z',
          'assets': [
        
          ],
          'tarball_url': 'https://api.github.com/repos/bitpay/wallet/tarball/v7.1.1',
          'zipball_url': 'https://api.github.com/repos/bitpay/wallet/zipball/v7.1.1',
          'body': '### Changelog\r\n\r\nNEW\r\n\r\n* ETH Testnet support\r\n* EUR Gift Cards\r\n* Export Key to another wallet as QR code\r\n\r\nBUG FIXES\r\n\r\n* Open app from ETH link (only Desktop)\r\n* Clear badge of pending notification (iOS)\r\n* UI issues on Settings Page\r\n* Send-max for top up cards\r\n\r\n### Download\r\n\r\n<table>\r\n<tbody>\r\n<tr>\r\n<td>App</td>\r\n<td>for Mac OS</td>\r\n<td>for Windows</td>\r\n<td>for Linux</td>\r\n</tr>\r\n<tr>\r\n<td>\r\n<a href="https://bitpay.com/wallet" target="_blank"><img src="https://user-images.githubusercontent.com/237435/48089088-68afa480-e1e2-11e8-83a8-361d0440528c.png" alt="BitPay"></a>\r\n</td>\r\n<td>\r\n<a href="https://itunes.apple.com/us/app/bitpay/id1440200291?ls=1&mt=12" target="_blank"><img src="https://user-images.githubusercontent.com/237435/48092454-7ddd0100-e1eb-11e8-9e13-3fe80bba7f00.png" alt="mac" width="120"></a>\r\n</td>\r\n<td>\r\n<a href="https://www.microsoft.com/store/apps/9NBR15SK4ZJV" target="_blank"><img src="https://user-images.githubusercontent.com/237435/48092465-82091e80-e1eb-11e8-9e06-36b36cd44021.png" alt="windows" width="120"></a>\r\n</td>\r\n<td>\r\n<a href="https://snapcraft.io/bitpay" target="_blank"><img src="https://user-images.githubusercontent.com/237435/48092664-09ef2880-e1ec-11e8-94a2-184446cb7183.png" alt="linux" width="120"></a>\r\n</td>\r\n</tr>\r\n<tr>\r\n<td>\r\n<a href="https://copay.io" target="_blank"><img src="https://user-images.githubusercontent.com/237435/48089097-6cdbc200-e1e2-11e8-9e54-363d54ae8fc6.png" alt="Copay"></a>\r\n</td>\r\n<td>\r\n<a href="https://itunes.apple.com/us/app/copay/id1440201813" target="_blank"><img src="https://user-images.githubusercontent.com/237435/48092454-7ddd0100-e1eb-11e8-9e13-3fe80bba7f00.png" alt="mac" width="120"></a>\r\n</td>\r\n<td>\r\n<a href="https://www.microsoft.com/store/apps/9MZGT30HL9DF" target="_blank"><img src="https://user-images.githubusercontent.com/237435/48092465-82091e80-e1eb-11e8-9e06-36b36cd44021.png" alt="windows" width="120"></a>\r\n</td>\r\n<td>\r\n<a href="https://snapcraft.io/copay" target="_blank"><img src="https://user-images.githubusercontent.com/237435/48092664-09ef2880-e1ec-11e8-94a2-184446cb7183.png" alt="linux" width="120"></a>\r\n</td>\r\n</tr>\r\n</tbody>\r\n</table>'
        };
        
        const server = {
          storage: {
            storeGlobalCache: sinon.stub().callsArgWith(2, null),
            checkAndUseGlobalCache: sinon.stub().callsArgWith(2, null, 'v8.2.2'),
          }
        };
        
        sandbox.stub(WalletService, 'initialize').callsArg(1);
        sandbox.stub(WalletService, 'getInstance').returns(server);        
        start(ExpressApp, function() {
          const requestOptions = {
            url: testHost + ':' + testPort + config.basePath + '/latest-version',
            headers: {
              'x-identity': 'identity',
              'x-signature': 'signature'
            }
          };
          request(requestOptions, function(err, res, body) {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            server.storage.checkAndUseGlobalCache.getCalls()[0].args[0].should.equal('latest-copay-version');
            server.storage.checkAndUseGlobalCache.getCalls()[0].args[1].should.equal(360000);
            server.storage.checkAndUseGlobalCache.getCalls()[0].args[2].should.exist;
            body.should.equal(JSON.stringify({ 'version': htmlString['tag_name'] }));
            done();
          });
        });
      });

      it('/v1/sendmaxinfo', function(done) {
        const server = {
          getSendMaxInfo: sinon.stub().callsArgWith(1, null, {
            amount: 123
          }),
        };
        sandbox.stub(WalletService, 'initialize').callsArg(1);
        sandbox.stub(WalletService, 'getInstanceWithAuth').callsArgWith(1, null, server);        
        start(ExpressApp, function() {
          const requestOptions = {
            url: testHost + ':' + testPort + config.basePath + '/v1/sendmaxinfo?feePerKb=10000&returnInputs=1',
            headers: {
              'x-identity': 'identity',
              'x-signature': 'signature'
            }
          };
          request(requestOptions, function(err, res, body) {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            const args = server.getSendMaxInfo.getCalls()[0].args[0];
            args.feePerKb.should.equal(10000);
            args.returnInputs.should.be.true;
            JSON.parse(body).amount.should.equal(123);
            done();
          });
        });
      });

      describe('Balance', function() {
        it('should handle cache argument', function(done) {
          const server = {
            getBalance: sinon.stub().callsArgWith(1, null, {}),
          };
          sandbox.stub(WalletService, 'initialize').callsArg(1);
          sandbox.stub(WalletService, 'getInstanceWithAuth').callsArgWith(1, null, server);
          start(ExpressApp, function() {
            const reqOpts = {
              url: testHost + ':' + testPort + config.basePath + '/v1/balance',
              headers: {
                'x-identity': 'identity',
                'x-signature': 'signature'
              }
            };
            request(reqOpts, function(err, res, body) {
              should.not.exist(err);
              res.statusCode.should.equal(200);
              const args = server.getBalance.getCalls()[0].args[0];
              should.not.exist(args.twoStep);

              reqOpts.url += '?twoStep=1';
              request(reqOpts, function(err, res, body) {
                should.not.exist(err);
                res.statusCode.should.equal(200);
                const args = server.getBalance.getCalls()[1].args[0];
                should.exist(args.twoStep);
                args.twoStep.should.equal(true);
                done();
              });
            });
          });
        });

        it('should get the balance at a given time', function(done) {
          const server = {
            getBalanceAtTime: sinon.stub().callsArgWith(1, null, { balance: 123 }),
          };
          sandbox.stub(WalletService, 'initialize').callsArg(1);
          sandbox.stub(WalletService, 'getInstanceWithAuth').callsArgWith(1, null, server);
          start(ExpressApp, function() {
            const reqOpts = {
              url: testHost + ':' + testPort + config.basePath + '/v1/balance/2025-01-15T12%3A00%3A00.000Z?tokenAddress=0xToken',
              headers: {
                'x-identity': 'identity',
                'x-signature': 'signature'
              }
            };
            request(reqOpts, function(err, res, body) {
              should.not.exist(err);
              res.statusCode.should.equal(200);
              server.getBalanceAtTime.calledOnce.should.be.true;
              server.getBalanceAtTime.getCall(0).args[0].time.should.equal('2025-01-15T12:00:00.000Z');
              server.getBalanceAtTime.getCall(0).args[0].tokenAddress.should.equal('0xToken');
              JSON.parse(body).balance.should.equal(123);
              done();
            });
          });
        });
      });

      describe('v1/wallets/all', function() {
        it('should return a wallet for each identity/sig pair given', function(done) {
          const server = {
            getStatus: sinon.stub().callsArgWith(1, null, 
              {
                walletId: 'walletId',
                success: true,
                status: {
                  wallet: {
                    version: '1.0.0',
                    createdOn: 1650990065,
                    id: 'walletId',
                    name: 'myWallet',
                    m: 1,
                    n: 1,
                    singleAddress: false,
                    status: 'complete',
                    copayers: [
                      {
                        version: 2,
                        createdOn: 1650990066,
                        coin: '',
                        id: '',
                        name: '',
                        requestPubKeys: [
                          {
                            key: '035141682a552b9e4c202a15ac6ab053259d287f1e6005dcb0f0bf84d85ceb104b',
                            signature: '30440220557faf80ba92db79e4f0b9f132d9f6faf312afa30ba126a9c1915b47f227e77a02204367ee72bb15494c548bc094461efd1b0def3a050ac625cbcdeb2db7310bb19e',
                          },
                        ],
                      },
                    ],
                    coin: 'btc',
                    network: 'testnet',
                    derivationStrategy: 'BIP44',
                    addressType: 'P2PKH',
                    scanStatus: null,
                    beRegistered: true,
                    beAuthPrivateKey2: '531782d0744909da635dd93c89631853db396392805b9addae8ed6ec0a04e0cc',
                    beAuthPublicKey2: '04a862a8a90ed5ded167a1f0faf9f22e61e5f9d60ddd876cab1907dca8c8039981a41a76abb40f1930a5a579f11c1b4671cba9ec04cf1ddc12b2fa0029c9fe213e',
                    nativeCashAddr: null,
                    usePurpose48: false,
                  },
                  serverMessages: [
                  ],
                  preferences: {
                  },
                  pendingTxps: [
                  ],
                  balance: {
                    totalAmount: 0,
                    lockedAmount: 0,
                    totalConfirmedAmount: 0,
                    lockedConfirmedAmount: 0,
                    availableAmount: 0,
                    availableConfirmedAmount: 0,
                    byAddress: [
                    ],
                  },
                },
              }
            ),
            walletId: 'walletId',
          };
          sandbox.stub(WalletService, 'initialize').callsArg(1);
          sandbox.stub(WalletService, 'getInstanceWithAuth').callsArgWith(1, null, server);
          start(ExpressApp, function() {
            const reqOpts = {
              url: testHost + ':' + testPort + config.basePath + '/v1/wallets/all',
              headers: {
                'x-identities': 'identity1,identity2,identity3',
                'x-signature': 'signature'
              }
            };
            reqOpts.url += '?includeExtendedInfo=1';
            request(reqOpts, function(err, res, body) {
              should.not.exist(err);
              res.statusCode.should.equal(200);
              const bodyObj = JSON.parse(body);
              bodyObj.length.should.equal(3);
              const args = server.getStatus.getCalls()[0].args[0];
              should.exist(args.includeExtendedInfo);
              args.includeExtendedInfo.should.equal(true);
              done();
            });
          });
        });
      });

      describe('/v1/notifications', function() {
        let server, clock;
        beforeEach(function() {
          clock = sinon.useFakeTimers(2000000000, 'Date');
          server = {
            getNotifications: sinon.stub().callsArgWith(1, null, {})
          };
          sandbox.stub(WalletService, 'initialize').callsArg(1);
          sandbox.stub(WalletService, 'getInstanceWithAuth').callsArgWith(1, null, server);
        });
        afterEach(function() {
          clock.restore();
        });

        it('should fetch notifications from a specified id', function(done) {
          start(ExpressApp, function() {
            const requestOptions = {
              url: testHost + ':' + testPort + config.basePath + '/v1/notifications' + '?notificationId=123',
              headers: {
                'x-identity': 'identity',
                'x-signature': 'signature'
              }
            };
            request(requestOptions, function(err, res, body) {
              should.not.exist(err);
              res.statusCode.should.equal(200);
              body.should.equal('{}');
              server.getNotifications.calledWith({
                notificationId: '123',
                minTs: +Date.now() - Defaults.NOTIFICATIONS_TIMESPAN * 1000,
              }).should.be.true;
              done();
            });
          });
        });
        it('should allow custom minTs within limits', function(done) {
          start(ExpressApp, function() {
            const requestOptions = {
              url: testHost + ':' + testPort + config.basePath + '/v1/notifications' + '?timeSpan=30',
              headers: {
                'x-identity': 'identity',
                'x-signature': 'signature'
              }
            };
            request(requestOptions, function(err, res, body) {
              should.not.exist(err);
              res.statusCode.should.equal(200);
              server.getNotifications.calledWith({
                notificationId: undefined,
                minTs: +Date.now() - 30000,
              }).should.be.true;
              done();
            });
          });
        });
        it('should limit minTs to Defaults.MAX_NOTIFICATIONS_TIMESPAN', function(done) {
          start(ExpressApp, function() {
            const overLimit = Defaults.MAX_NOTIFICATIONS_TIMESPAN * 2;
            const requestOptions = {
              url: testHost + ':' + testPort + config.basePath + '/v1/notifications' + '?timeSpan=' + overLimit,
              headers: {
                'x-identity': 'identity',
                'x-signature': 'signature'
              }
            };
            request(requestOptions, function(err, res, body) {
              should.not.exist(err);
              res.statusCode.should.equal(200);
              body.should.equal('{}');
              server.getNotifications.calledWith({
                notificationId: undefined,
                minTs: Date.now() - Defaults.MAX_NOTIFICATIONS_TIMESPAN * 1000, // override minTs argument
              }).should.be.true;
              done();
            });
          });
        });
        it.skip('v1/advertisements', function(done) {
          start(ExpressApp, function() {
            const requestOptions = {
              url: testHost + ':' + testPort + config.basePath + '/v1/advertisements',
              headers: {
                'x-identity': 'identity',
                'x-signature': 'signature'
              }
            };
            done();
          });
        });
        it('Server under maintenance check, should return 503 status code', function(done) {
          const server = {
            getStatus: sinon.stub().callsArgWith(1, null, {}),
          };
          (WalletService.getInstanceWithAuth as any).restore();
          sandbox.stub(WalletService, 'getInstanceWithAuth').callsArgWith(1, null, server);
          start(ExpressApp, function(err, data) {
            const requestOptions = {
              // test link, for either a 503 or 200 code response
              url: testHost + ':' + testPort + config.basePath + '/v2/wallets',
              headers: {
                'x-identity': 'identity',
                'x-signature': 'signature'
              }
            };
            request(requestOptions, function(err, res, body) {
              if (config.maintenanceOpts.maintenanceMode === true) {
                should.not.exist(err);
                res.statusCode.should.equal(503);
                body.should.equal('{"code":503,"message":"Bitcore Wallet Service is currently under maintenance. Please periodically check https://status.bitpay.com/ to stay up to date with our current status."}');
              } else {
                should.not.exist(err);
                res.statusCode.should.equal(200);
              }
              done();
            });
          });
        });
        
      });
      describe('Aave service routes', function() {
        it('/v1/service/aave/userAccountData', function(done) {
          const server = {
            getAaveUserAccountData: sinon.stub().resolves({ totalCollateralBase: '1000', healthFactor: '2.0' }),
          };
          sandbox.stub(WalletService, 'initialize').callsArg(1);
          sandbox.stub(WalletService, 'getInstance').returns(server);
          start(ExpressApp, function() {
            const requestOptions = {
              url: testHost + ':' + testPort + config.basePath + '/v1/service/aave/userAccountData',
              method: 'post',
              json: { chain: 'eth', network: 'mainnet', address: '0x123', version: 'v3' }
            };
            request(requestOptions, function(err, res, body) {
              should.not.exist(err);
              res.statusCode.should.equal(200);
              body.totalCollateralBase.should.equal('1000');
              body.healthFactor.should.equal('2.0');
              done();
            });
          });
        });

        it('/v1/service/aave/userAccountData should fail with missing arguments', function(done) {
          const server = {
            getAaveUserAccountData: sinon.stub().rejects(new ClientError('getAaveUserAccountData request missing arguments')),
          };
          sandbox.stub(WalletService, 'initialize').callsArg(1);
          sandbox.stub(WalletService, 'getInstance').returns(server);
          start(ExpressApp, function() {
            const requestOptions = {
              url: testHost + ':' + testPort + config.basePath + '/v1/service/aave/userAccountData',
              method: 'post',
              json: { version: 'v3' }
            };
            request(requestOptions, function(err, res) {
              should.not.exist(err);
              res.statusCode.should.equal(400);
              done();
            });
          });
        });

        it('/v1/service/aave/reserveData', function(done) {
          const server = {
            getAaveReserveData: sinon.stub().resolves({ currentVariableBorrowRate: '35000000' }),
          };
          sandbox.stub(WalletService, 'initialize').callsArg(1);
          sandbox.stub(WalletService, 'getInstance').returns(server);
          start(ExpressApp, function() {
            const requestOptions = {
              url: testHost + ':' + testPort + config.basePath + '/v1/service/aave/reserveData',
              method: 'post',
              json: { chain: 'eth', network: 'mainnet', asset: '0xabc', version: 'v3' }
            };
            request(requestOptions, function(err, res, body) {
              should.not.exist(err);
              res.statusCode.should.equal(200);
              body.currentVariableBorrowRate.should.equal('35000000');
              done();
            });
          });
        });

        it('/v1/service/aave/reserveData should fail with missing arguments', function(done) {
          const server = {
            getAaveReserveData: sinon.stub().rejects(new ClientError('getAaveReserveData request missing arguments')),
          };
          sandbox.stub(WalletService, 'initialize').callsArg(1);
          sandbox.stub(WalletService, 'getInstance').returns(server);
          start(ExpressApp, function() {
            const requestOptions = {
              url: testHost + ':' + testPort + config.basePath + '/v1/service/aave/reserveData',
              method: 'post',
              json: { version: 'v3' }
            };
            request(requestOptions, function(err, res) {
              should.not.exist(err);
              res.statusCode.should.equal(400);
              done();
            });
          });
        });

        it('/v1/service/aave/reserveTokensAddresses', function(done) {
          const server = {
            getAaveReserveTokensAddresses: sinon.stub().resolves({ variableDebtTokenAddress: '0xdef' }),
          };
          sandbox.stub(WalletService, 'initialize').callsArg(1);
          sandbox.stub(WalletService, 'getInstance').returns(server);
          start(ExpressApp, function() {
            const requestOptions = {
              url: testHost + ':' + testPort + config.basePath + '/v1/service/aave/reserveTokensAddresses',
              method: 'post',
              json: { chain: 'eth', network: 'mainnet', asset: '0xabc', version: 'v3' }
            };
            request(requestOptions, function(err, res, body) {
              should.not.exist(err);
              res.statusCode.should.equal(200);
              body.variableDebtTokenAddress.should.equal('0xdef');
              done();
            });
          });
        });

        it('/v1/service/aave/reserveTokensAddresses should fail with missing arguments', function(done) {
          const server = {
            getAaveReserveTokensAddresses: sinon.stub().rejects(new ClientError('getAaveReserveTokensAddresses request missing arguments')),
          };
          sandbox.stub(WalletService, 'initialize').callsArg(1);
          sandbox.stub(WalletService, 'getInstance').returns(server);
          start(ExpressApp, function() {
            const requestOptions = {
              url: testHost + ':' + testPort + config.basePath + '/v1/service/aave/reserveTokensAddresses',
              method: 'post',
              json: { version: 'v3' }
            };
            request(requestOptions, function(err, res) {
              should.not.exist(err);
              res.statusCode.should.equal(400);
              done();
            });
          });
        });
      });

      describe('Moralis routes (wallet-authenticated or public)', function() {
        const whitelistedOrigin = 'https://whitelisted-dapp.example';
        let originalMoralisConfig;
        beforeEach(function() {
          originalMoralisConfig = config.moralis;
          config.moralis = { whitelist: [whitelistedOrigin] };
        });
        afterEach(function() {
          config.moralis = originalMoralisConfig;
        });

        it('/v1/moralis/getMultipleERC20TokenPrices should work without auth headers (public/dApp)', function(done) {
          const server = {
            moralisGetMultipleERC20TokenPrices: sinon.stub().resolves([{ tokenAddress: '0xaaa', usdPrice: 1 }]),
          };
          sandbox.stub(WalletService, 'initialize').callsArg(1);
          sandbox.stub(WalletService, 'getInstance').returns(server);
          start(ExpressApp, function() {
            const requestOptions = {
              url: testHost + ':' + testPort + config.basePath + '/v1/moralis/getMultipleERC20TokenPrices',
              method: 'post',
              json: { chain: '0x1', tokens: [{ tokenAddress: '0xaaa' }] },
              headers: {
                origin: whitelistedOrigin
              }
            };
            request(requestOptions, function(err, res, body) {
              should.not.exist(err);
              res.statusCode.should.equal(200);
              body[0].tokenAddress.should.equal('0xaaa');
              done();
            });
          });
        });

        it('/v1/moralis/getMultipleERC20TokenPrices should work with valid wallet auth headers', function(done) {
          const server = {
            moralisGetMultipleERC20TokenPrices: sinon.stub().resolves([{ tokenAddress: '0xaaa', usdPrice: 1 }]),
          };
          sandbox.stub(WalletService, 'initialize').callsArg(1);
          sandbox.stub(WalletService, 'getInstance').returns(server);
          sandbox.stub(WalletService, 'getInstanceWithAuth').callsArgWith(1, null, server);
          start(ExpressApp, function() {
            const requestOptions = {
              url: testHost + ':' + testPort + config.basePath + '/v1/moralis/getMultipleERC20TokenPrices',
              method: 'post',
              json: { chain: '0x1', tokens: [{ tokenAddress: '0xaaa' }] },
              headers: {
                'x-identity': 'identity',
                'x-signature': 'signature'
              }
            };
            request(requestOptions, function(err, res, body) {
              should.not.exist(err);
              res.statusCode.should.equal(200);
              body[0].tokenAddress.should.equal('0xaaa');
              done();
            });
          });
        });

        it('/v1/moralis/getMultipleERC20TokenPrices should fail with invalid wallet auth headers', function(done) {
          sandbox.stub(WalletService, 'initialize').callsArg(1);
          sandbox.stub(WalletService, 'getInstanceWithAuth').callsArgWith(1, new ClientError('NOT_AUTHORIZED', 'Not authorized'));
          start(ExpressApp, function() {
            const requestOptions = {
              url: testHost + ':' + testPort + config.basePath + '/v1/moralis/getMultipleERC20TokenPrices',
              method: 'post',
              json: { chain: '0x1', tokens: [{ tokenAddress: '0xaaa' }] },
              headers: {
                'x-identity': 'identity',
                'x-signature': 'bad-signature'
              }
            };
            request(requestOptions, function(err, res) {
              should.not.exist(err);
              res.statusCode.should.equal(401);
              done();
            });
          });
        });
      });

      describe('Token allowance', function() {
        it('/v1/token/allowance', function(done) {
          const server = {
            getTokenAllowance: sinon.stub().resolves(5000000),
          };
          sandbox.stub(WalletService, 'initialize').callsArg(1);
          sandbox.stub(WalletService, 'getInstance').returns(server);
          start(ExpressApp, function() {
            const requestOptions = {
              url: testHost + ':' + testPort + config.basePath + '/v1/token/allowance',
              method: 'post',
              json: { chain: 'eth', network: 'mainnet', tokenAddress: '0xtoken', ownerAddress: '0xowner', spenderAddress: '0xspender' }
            };
            request(requestOptions, function(err, res, body) {
              should.not.exist(err);
              res.statusCode.should.equal(200);
              body.should.equal(5000000);
              done();
            });
          });
        });

        it('/v1/token/allowance should fail with missing arguments', function(done) {
          const server = {
            getTokenAllowance: sinon.stub().rejects(new ClientError('getTokenAllowance request missing arguments')),
          };
          sandbox.stub(WalletService, 'initialize').callsArg(1);
          sandbox.stub(WalletService, 'getInstance').returns(server);
          start(ExpressApp, function() {
            const requestOptions = {
              url: testHost + ':' + testPort + config.basePath + '/v1/token/allowance',
              method: 'post',
              json: {}
            };
            request(requestOptions, function(err, res) {
              should.not.exist(err);
              res.statusCode.should.equal(400);
              done();
            });
          });
        });
      });

      describe('/v1/wallets/exist', function() {
        const idA = 'a'.repeat(64);
        const idB = 'b'.repeat(64);
        const idC = 'c'.repeat(64);
        let storage;

        function sign(message) {
          const hash = Common.Utils.hashMessage(message, false);
          return BitcoreLib.crypto.ECDSA.sign(hash, new BitcoreLib.PrivateKey(TestData.keyPair.priv), { endian: 'little' }).toString();
        }

        // posts each body in turn, and calls back with each response's status and body
        function postEach(bodies, cb) {
          sandbox.stub(WalletService, 'initialize').callsArg(1);
          sandbox.stub(WalletService, 'getStorage').returns(storage);
          start(ExpressApp, function() {
            const results = [];
            (function next() {
              if (results.length === bodies.length) {
                return cb(null, results);
              }
              request({
                url: testHost + ':' + testPort + config.basePath + '/v1/wallets/exist',
                method: 'post',
                json: true,
                body: bodies[results.length]
              }, function(err, res, body) {
                if (err) {
                  return cb(err);
                }
                results.push({ status: res.statusCode, body });
                next();
              });
            })();
          });
        }

        function post(body, cb) {
          postEach([body], (err, results) => (err ? cb(err) : cb(null, { statusCode: results[0].status }, results[0].body)));
        }

        beforeEach(function() {
          const copayer = { requestPubKeys: [{ key: TestData.keyPair.pub }] };
          storage = {
            fetchCopayerLookup: sinon.stub().callsFake(async id => (id === idA || id === idB ? copayer : undefined))
          };
        });

        it('returns the copayers whose signature verifies against their request key', function(done) {
          post({
            copayers: [
              { copayerId: idA, signature: sign(idA) },
              { copayerId: idB, signature: sign(idA) },
              { copayerId: idC, signature: sign(idC) }
            ]
          }, function(err, res, body) {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            body.should.deep.equal([idA]);
            storage.fetchCopayerLookup.args.should.deep.equal([[idA], [idB], [idC]]);
            done();
          });
        });

        it('returns no copayers when given none to check', function(done) {
          postEach([
            {},
            { copayers: null },
            { copayers: idA },
            { copayers: { copayerId: idA, signature: sign(idA) } },
            { copayers: [] }
          ], function(err, results) {
            should.not.exist(err);
            results.should.deep.equal(Array(5).fill({ status: 200, body: [] }));
            storage.fetchCopayerLookup.callCount.should.equal(0);
            done();
          });
        });

        it('does not verify a copayer whose signature is not a string', function(done) {
          post({
            copayers: [
              { copayerId: idA, signature: 1 },
              { copayerId: idA, signature: [sign(idA)] },
              { copayerId: idB, signature: {} },
              { copayerId: idB }
            ]
          }, function(err, res, body) {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            body.should.deep.equal([]);
            storage.fetchCopayerLookup.callCount.should.equal(4);
            done();
          });
        });

        it('treats a copayer that fails to load as not found', function(done) {
          storage.fetchCopayerLookup.withArgs(idB).rejects(new Error('lookup failed'));
          post({
            copayers: [
              { copayerId: idA, signature: sign(idA) },
              { copayerId: idB, signature: sign(idB) }
            ]
          }, function(err, res, body) {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            body.should.deep.equal([idA]);
            done();
          });
        });

        it('looks up only copayer ids that are strings', function(done) {
          post({
            copayers: [
              { copayerId: { id: idB }, signature: sign(idB) },
              { copayerId: [idB], signature: sign(idB) },
              { copayerId: 1, signature: sign(idB) },
              { signature: sign(idB) },
              { copayerId: idA, signature: sign(idA) }
            ]
          }, function(err, res, body) {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            body.should.deep.equal([idA]);
            storage.fetchCopayerLookup.args.should.deep.equal([[idA]]);
            done();
          });
        });

        it('skips copayers that are not objects', function(done) {
          post({
            copayers: [null, idB, { copayerId: idA, signature: sign(idA) }]
          }, function(err, res, body) {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            body.should.deep.equal([idA]);
            storage.fetchCopayerLookup.args.should.deep.equal([[idA]]);
            done();
          });
        });
      });

      describe('Clear cache', function() {
        it('/v1/clearcache/', function(done) {
          const resolveStub = sinon.stub().callsFake( () => { return Promise.resolve(true);});
          const server = {
            clearWalletCache: resolveStub
          };
          sandbox.stub(WalletService, 'initialize').callsArg(1);
          sandbox.stub(WalletService, 'getInstanceWithAuth').callsArgWith(1, null, server);
          start(ExpressApp, function() {
            const requestOptions = {
              url: testHost + ':' + testPort + config.basePath + '/v1/clearcache/',
              headers: {
                'x-identity': 'identity',
                'x-signature': 'signature'
              },
              method: 'post'
            };
            request(requestOptions, function(err, res, body) {
              should.not.exist(err);
              res.statusCode.should.equal(200);
              done();
            });
          });
        });  
      });
    });
  });
});
