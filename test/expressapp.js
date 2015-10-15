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
        var app = new TestExpressApp();
        var httpServer = http.Server(app.app);

        app.start(config, function(err) {
          should.not.exist(err);
          httpServer.listen(testPort);
          var requestOptions = {
            url: testHost + ':' + testPort + config.basePath + '/v1/wallets',
            headers: {
              'x-identity': 'identity',
              'x-signature': 'signature'
            }
          };
          request(requestOptions, function(err, response, body){
            should.not.exist(err);
            response.statusCode.should.equal(200);
            body.should.equal('{}');
            done();
          });
        });
      });
    });
  });
});
