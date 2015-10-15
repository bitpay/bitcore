'use strict';

var chai = require('chai');
var sinon = require('sinon');
var request = require('request');
var http = require('http');
var should = chai.should();
var proxyquire = require('proxyquire');
var config = require('../config.js');

describe('ExpressApp', function() {
  describe('#constructor', function() {
    it('will set an express app', function() {
      var TestExpressApp = proxyquire('../lib/expressapp', {});
      var express = new TestExpressApp();
      should.exist(express.app);
      should.exist(express.app.use);
      should.exist(express.app.enable);
    });
  });
  describe('#start', function() {
    it('will listen at the specified port', function(done) {
      var initialize = sinon.stub().callsArg(1);
      var TestExpressApp = proxyquire('../lib/expressapp', {
        './server': {
          initialize: initialize
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
        var app = new ExpressApp();
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
          getStatus: sinon.stub().callsArgWith(1, null, {})
        };
        var TestExpressApp = proxyquire('../lib/expressapp', {
          './server': {
            initialize: sinon.stub().callsArg(1),
            getInstanceWithAuth: sinon.stub().callsArgWith(1, null, server),
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
          request(requestOptions, function(err, response, body) {
            should.not.exist(err);
            response.statusCode.should.equal(200);
            body.should.equal('{}');
            done();
          });
        });
      });

      it('/v1/notifications', function(done) {
        var clock = sinon.useFakeTimers(1234000, 'Date');

        var server = {
          getNotifications: sinon.stub().callsArgWith(1, null, {})
        };
        var TestExpressApp = proxyquire('../lib/expressapp', {
          './server': {
            initialize: sinon.stub().callsArg(1),
            getInstanceWithAuth: sinon.stub().callsArgWith(1, null, server),
          }
        });
        start(TestExpressApp, function() {
          var requestOptions = {
            url: testHost + ':' + testPort + config.basePath + '/v1/notifications' + '?notificationId=123&minTs=0',
            headers: {
              'x-identity': 'identity',
              'x-signature': 'signature'
            }
          };
          request(requestOptions, function(err, response, body) {
            should.not.exist(err);
            response.statusCode.should.equal(200);
            body.should.equal('{}');
            server.getNotifications.calledWith({
              notificationId: '123',
              minTs: 1234000 - 60000, // override minTs argument with a hardcoded 60 seconds span
            }).should.be.true;

            clock.restore();
            done();
          });
        });
      });
    });
  });
});
