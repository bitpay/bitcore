'use strict';

var chai = require('chai');
var sinon = require('sinon');
var assert = require('assert');
var request = require('request');
var http = require('http');
var should = chai.should();
var proxyquire = require('proxyquire');
var config = require('../ts_build/config.js');
var log = require('npmlog');

var Common = require('../ts_build/lib/common');
var Defaults = Common.Defaults;
var { WalletService } = require('../ts_build/lib/server');



describe('ExpressApp', function() {
  beforeEach(()=>{
    log.level = 'error';
    config.disableLogs = true;
  });
  describe('#constructor', function() {
    it('will set an express app', function() {
      var {ExpressApp: TestExpressApp} = proxyquire('../ts_build/lib/expressapp', {});
      var express = new TestExpressApp({
      });
      should.exist(express.app);
      should.exist(express.app.use);
      should.exist(express.app.enable);
    });
  });
  describe('#start', function() {
    it('will listen at the specified port', function(done) {
      var initialize = sinon.stub().callsArg(1);
      var {ExpressApp: TestExpressApp} = proxyquire('../ts_build/lib/expressapp', {
        './server': {
          WalletService : {
            initialize: initialize,
            getServiceVersion: WalletService.getServiceVersion
          }
        }
      });
      var app = new TestExpressApp();
      var options = {};
      app.start(config, function(err) {
        should.not.exist(err);
        initialize.callCount.should.equal(1);
        done();
      });           
    });

    describe('Routes', function() {
      var testPort = 3239;
      var testHost = 'http://127.0.0.1';
      var httpServer;

      function start(ExpressApp, done) {
        var app = new ExpressApp({
        });
        httpServer = http.Server(app.app);

        app.start(config, function(err) {
          should.not.exist(err);
          httpServer.listen(testPort);
          done();
        });
      };

      afterEach(function() {
        httpServer.close();
      });

      it('/v2/wallets', function(done) {
        var server = {
          getStatus: sinon.stub().callsArgWith(1, null, {}),
        };
        var {ExpressApp: TestExpressApp} = proxyquire('../ts_build/lib/expressapp', {
          './server': {
            WalletService:  {
              initialize: sinon.stub().callsArg(1),
              getServiceVersion: WalletService.getServiceVersion,
              getInstanceWithAuth: sinon.stub().callsArgWith(1, null, server),
            }
          }
        });
        start(TestExpressApp, function() {
          var requestOptions = {
            url: testHost + ':' + testPort + config.basePath + '/v2/wallets',
            headers: {
              'x-identity': 'identity',
              'x-signature': 'signature'
            }
          };
          request(requestOptions, function(err, res, body) {
            should.not.exist(err);
            should.exist(res.headers['x-service-version']);
            res.headers['x-service-version'].should.equal('bws-' + require('../package').version);
            res.statusCode.should.equal(200);
            body.should.equal('{}');
            done();
          });
        });
      });

      it('/v1/addresses', function(done) {
        var server = {
          getMainAddresses: sinon.stub().callsArgWith(1, null, {}),
        };
        var {ExpressApp: TestExpressApp} = proxyquire('../ts_build/lib/expressapp', {
          './server': {
            WalletService: {
              initialize: sinon.stub().callsArg(1),
              getServiceVersion: WalletService.getServiceVersion,
              getInstanceWithAuth: sinon.stub().callsArgWith(1, null, server),
            }
          }
        });
        start(TestExpressApp, function() {
          var requestOptions = {
            url: testHost + ':' + testPort + config.basePath + '/v1/addresses?limit=4&reverse=1',
            headers: {
              'x-identity': 'identity',
              'x-signature': 'signature'
            }
          };
          request(requestOptions, function(err, res, body) {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            var args = server.getMainAddresses.getCalls()[0].args[0];
            args.limit.should.equal(4);
            args.reverse.should.be.true;
            done();
          });
        });
      });

  
      it('latest-copay-version', function(done) {

          var htmlString = {
            "url": "https://api.github.com/repos/bitpay/copay/releases/21158137",
            "assets_url": "https://api.github.com/repos/bitpay/copay/releases/21158137/assets",
            "upload_url": "https://uploads.github.com/repos/bitpay/copay/releases/21158137/assets{?name,label}",
            "html_url": "https://github.com/bitpay/copay/releases/tag/v8.2.2",
            "id": 21158137,
            "node_id": "MDc6UmVsZWFzZTIxMTU4MTM3",
            "tag_name": "v8.2.2",
            "target_commitish": "master",
            "name": "v8.2.2",
            "draft": false,
            "author": {
              "login": "cmgustavo",
              "id": 237435,
              "node_id": "MDQ6VXNlcjIzNzQzNQ==",
              "avatar_url": "https://avatars3.githubusercontent.com/u/237435?v=4",
              "gravatar_id": "",
              "url": "https://api.github.com/users/cmgustavo",
              "html_url": "https://github.com/cmgustavo",
              "followers_url": "https://api.github.com/users/cmgustavo/followers",
              "following_url": "https://api.github.com/users/cmgustavo/following{/other_user}",
              "gists_url": "https://api.github.com/users/cmgustavo/gists{/gist_id}",
              "starred_url": "https://api.github.com/users/cmgustavo/starred{/owner}{/repo}",
              "subscriptions_url": "https://api.github.com/users/cmgustavo/subscriptions",
              "organizations_url": "https://api.github.com/users/cmgustavo/orgs",
              "repos_url": "https://api.github.com/users/cmgustavo/repos",
              "events_url": "https://api.github.com/users/cmgustavo/events{/privacy}",
              "received_events_url": "https://api.github.com/users/cmgustavo/received_events",
              "type": "User",
              "site_admin": false
            },
            "prerelease": false,
            "created_at": "2019-10-29T14:09:01Z",
            "published_at": "2019-11-01T19:50:37Z",
            "assets": [
          
            ],
            "tarball_url": "https://api.github.com/repos/bitpay/copay/tarball/v7.1.1",
            "zipball_url": "https://api.github.com/repos/bitpay/copay/zipball/v7.1.1",
            "body": "### Changelog\r\n\r\nNEW\r\n\r\n* ETH Testnet support\r\n* EUR Gift Cards\r\n* Export Key to another wallet as QR code\r\n\r\nBUG FIXES\r\n\r\n* Open app from ETH link (only Desktop)\r\n* Clear badge of pending notification (iOS)\r\n* UI issues on Settings Page\r\n* Send-max for top up cards\r\n\r\n### Download\r\n\r\n<table>\r\n<tbody>\r\n<tr>\r\n<td>App</td>\r\n<td>for Mac OS</td>\r\n<td>for Windows</td>\r\n<td>for Linux</td>\r\n</tr>\r\n<tr>\r\n<td>\r\n<a href=\"https://bitpay.com/wallet\" target=\"_blank\"><img src=\"https://user-images.githubusercontent.com/237435/48089088-68afa480-e1e2-11e8-83a8-361d0440528c.png\" alt=\"BitPay\"></a>\r\n</td>\r\n<td>\r\n<a href=\"https://itunes.apple.com/us/app/bitpay/id1440200291?ls=1&mt=12\" target=\"_blank\"><img src=\"https://user-images.githubusercontent.com/237435/48092454-7ddd0100-e1eb-11e8-9e13-3fe80bba7f00.png\" alt=\"mac\" width=\"120\"></a>\r\n</td>\r\n<td>\r\n<a href=\"https://www.microsoft.com/store/apps/9NBR15SK4ZJV\" target=\"_blank\"><img src=\"https://user-images.githubusercontent.com/237435/48092465-82091e80-e1eb-11e8-9e06-36b36cd44021.png\" alt=\"windows\" width=\"120\"></a>\r\n</td>\r\n<td>\r\n<a href=\"https://snapcraft.io/bitpay\" target=\"_blank\"><img src=\"https://user-images.githubusercontent.com/237435/48092664-09ef2880-e1ec-11e8-94a2-184446cb7183.png\" alt=\"linux\" width=\"120\"></a>\r\n</td>\r\n</tr>\r\n<tr>\r\n<td>\r\n<a href=\"https://copay.io\" target=\"_blank\"><img src=\"https://user-images.githubusercontent.com/237435/48089097-6cdbc200-e1e2-11e8-9e54-363d54ae8fc6.png\" alt=\"Copay\"></a>\r\n</td>\r\n<td>\r\n<a href=\"https://itunes.apple.com/us/app/copay/id1440201813\" target=\"_blank\"><img src=\"https://user-images.githubusercontent.com/237435/48092454-7ddd0100-e1eb-11e8-9e13-3fe80bba7f00.png\" alt=\"mac\" width=\"120\"></a>\r\n</td>\r\n<td>\r\n<a href=\"https://www.microsoft.com/store/apps/9MZGT30HL9DF\" target=\"_blank\"><img src=\"https://user-images.githubusercontent.com/237435/48092465-82091e80-e1eb-11e8-9e06-36b36cd44021.png\" alt=\"windows\" width=\"120\"></a>\r\n</td>\r\n<td>\r\n<a href=\"https://snapcraft.io/copay\" target=\"_blank\"><img src=\"https://user-images.githubusercontent.com/237435/48092664-09ef2880-e1ec-11e8-94a2-184446cb7183.png\" alt=\"linux\" width=\"120\"></a>\r\n</td>\r\n</tr>\r\n</tbody>\r\n</table>"
          };
          
          
          var server = {
            storage: {
              storeGlobalCache: sinon.stub().callsArgWith(2, null),
              checkAndUseGlobalCache: sinon.stub().callsArgWith(2, null, 'v8.2.2'),
            }
          };
          
          var {ExpressApp: TestExpressApp} = proxyquire('../ts_build/lib/expressapp', {
            './server': {
              WalletService: {
                initialize: sinon.stub().callsArg(1),
                getServiceVersion: WalletService.getServiceVersion,
                getInstance: sinon.stub().returns(server),
              }
            }
          });
          
          start(TestExpressApp, function() {
            var requestOptions = {
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
              server.storage.checkAndUseGlobalCache.getCalls()[0].args[2].should.exist();
              body.should.equal(JSON.stringify({"version":htmlString['tag_name']}));
              done();
            });
          });
      });

      it('/v1/sendmaxinfo', function(done) {
        var server = {
          getSendMaxInfo: sinon.stub().callsArgWith(1, null, {
            amount: 123
          }),
        };
        var {ExpressApp: TestExpressApp} = proxyquire('../ts_build/lib/expressapp', {
          './server': {
            WalletService : {
              initialize: sinon.stub().callsArg(1),
              getServiceVersion: WalletService.getServiceVersion,
              getInstanceWithAuth: sinon.stub().callsArgWith(1, null, server),
            }
          }
        });
        
        start(TestExpressApp, function() {
          var requestOptions = {
            url: testHost + ':' + testPort + config.basePath + '/v1/sendmaxinfo?feePerKb=10000&returnInputs=1',
            headers: {
              'x-identity': 'identity',
              'x-signature': 'signature'
            }
          };
          request(requestOptions, function(err, res, body) {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            var args = server.getSendMaxInfo.getCalls()[0].args[0];
            args.feePerKb.should.equal(10000);
            args.returnInputs.should.be.true;
            JSON.parse(body).amount.should.equal(123);
            done();
          });
        });
      });

      describe('Balance', function() {
        it('should handle cache argument', function(done) {
          var server = {
            getBalance: sinon.stub().callsArgWith(1, null, {}),
          };
          var {ExpressApp: TestExpressApp} = proxyquire('../ts_build/lib/expressapp', {
            './server': {
              WalletService : {
                initialize: sinon.stub().callsArg(1),
                getServiceVersion: WalletService.getServiceVersion,
                getInstanceWithAuth: sinon.stub().callsArgWith(1, null, server),
              }
            }
          });
          start(TestExpressApp, function() {
            var reqOpts = {
              url: testHost + ':' + testPort + config.basePath + '/v1/balance',
              headers: {
                'x-identity': 'identity',
                'x-signature': 'signature'
              }
            };
            request(reqOpts, function(err, res, body) {
              should.not.exist(err);
              res.statusCode.should.equal(200);
              var args = server.getBalance.getCalls()[0].args[0];
              should.not.exist(args.twoStep);

              reqOpts.url += '?twoStep=1';
              request(reqOpts, function(err, res, body) {
                should.not.exist(err);
                res.statusCode.should.equal(200);
                var args = server.getBalance.getCalls()[1].args[0];
                args.twoStep.should.equal(true);
                done();
              });
            });
          });
        });
      });

      describe('/v1/notifications', function(done) {
        var server, clock, TestExpressApp;
        beforeEach(function() {
          clock = sinon.useFakeTimers(2000000000, 'Date');

          server = {
            getNotifications: sinon.stub().callsArgWith(1, null, {})
          };
          var {ExpressApp} = proxyquire('../ts_build/lib/expressapp', {
            './server': {
              WalletService: {
                initialize: sinon.stub().callsArg(1),
                getServiceVersion: WalletService.getServiceVersion,
                getInstanceWithAuth: sinon.stub().callsArgWith(1, null, server),
              }
            }
          });
          TestExpressApp = ExpressApp;
        });
        afterEach(function() {
          clock.restore();
        });

        it('should fetch notifications from a specified id', function(done) {
          start(TestExpressApp, function() {
            var requestOptions = {
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
          start(TestExpressApp, function() {
            var requestOptions = {
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
          start(TestExpressApp, function() {
            var overLimit  = Defaults.MAX_NOTIFICATIONS_TIMESPAN * 2;
            var requestOptions = {
              url: testHost + ':' + testPort + config.basePath + '/v1/notifications' + '?timeSpan=' + overLimit ,
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
        it('v1/advertisements', function(done) {
          start(TestExpressApp, function() {
            var requestOptions = {
              url: testHost + ':' + testPort + config.basePath + '/v1/advertisements',
              headers: {
                'x-identity': 'identity',
                'x-signature': 'signature'
              }
            };
          });
          done();
        });
        it('Server under maintenance check, should return 503 status code', function(done) {
          var server = {
            getStatus: sinon.stub().callsArgWith(1, null, {}),
          };
          var {ExpressApp: TestExpressApp} = proxyquire('../ts_build/lib/expressapp', {
            './server': {
              WalletService:  {
                initialize: sinon.stub().callsArg(1),
                getServiceVersion: WalletService.getServiceVersion,
                getInstanceWithAuth: sinon.stub().callsArgWith(1, null, server),
              }
            }
          });
          start(TestExpressApp, function(err, data) {
            var requestOptions = {
              //test link, for either a 503 or 200 code response
              url: testHost + ':' + testPort + config.basePath + "/v2/wallets",
              headers: {
                'x-identity': 'identity',
                'x-signature': 'signature'
              }
            };
            request(requestOptions, function(err,res,body){
              if(config.maintenanceOpts.maintenanceMode === true) {
                should.not.exist(err);
                res.statusCode.should.equal(503);
                body.should.equal(`{"code":503,"message":"Bitcore Wallet Service is currently under maintenance. Please periodically check https://status.bitpay.com/ to stay up to date with our current status."}`);
              } else {
                should.not.exist(err);
                res.statusCode.should.equal(200);
              }
              done();
            });
          });
        });
      });
    });
  });
});
