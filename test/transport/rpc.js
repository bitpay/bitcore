'use strict';

var chai = require('chai');
var should = chai.should();

var bitcore = require('../..');
var RPC = bitcore.transport.RPC;

describe('RPC', function() {
  it('should be able to create instance', function() {
    var client = new RPC('user', 'pass');
    should.exist(client);
  });

  it('should set default config', function() {
    var client = new RPC('user', 'pass');
    client.user.should.be.equal('user');
    client.pass.should.be.equal('pass');

    client.host.should.be.equal('127.0.0.1');
    client.port.should.be.equal(8332);
    client.secure.should.be.equal(true);
    client.disableAgent.should.be.equal(false);
    client.rejectUnauthorized.should.be.equal(false);
  });

  it('should allow setting custom host and port', function() {
    var client = new RPC('user', 'pass', {
      host: 'localhost',
      port: 18332
    });

    client.host.should.be.equal('localhost');
    client.port.should.be.equal(18332);
  });

  it('should honor request options', function() {
    var client = new RPC('user', 'pass', {
      host: 'localhost',
      port: 18332,
      rejectUnauthorized: true,
      disableAgent: true
    });

    client._client = {};
    client._client.request = function(options, callback) {
      options.host.should.be.equal('localhost');
      options.port.should.be.equal(18332);
      options.rejectUnauthorized.should.be.equal(true);
      options.agent.should.be.false;
      return {
        on: function() {},
        setHeader: function() {},
        write: function() {},
        end: function() {}
      };
    };

    client._request({}, function() {});
  });

});
