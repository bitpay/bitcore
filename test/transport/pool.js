'use strict';

if (typeof(window) === 'undefined'){

  // Node.js Tests

  var chai = require('chai');

  /* jshint unused: false */
  var should = chai.should();
  var expect = chai.expect;

  var dns = require('dns');
  var sinon = require('sinon');

  var bitcore = require('../..');
  var Peer = bitcore.transport.Peer;
  var Pool = bitcore.transport.Pool;
  var Networks = bitcore.Networks;

  describe('Pool', function() {

    it('should be able to create instance', function() {
      var pool = new Pool();
      pool.network.should.equal(Networks.livenet);
    });

    it('should be able to create instance setting the network', function() {
      var pool = new Peer(Networks.testnet);
      pool.network.should.equal(Networks.livenet);
    });

    it('should discover peers via dns', function() {
      var stub = sinon.stub(dns, 'resolve', function(seed, callback){
        callback(null, ['10.10.10.1', '10.10.10.2', '10.10.10.3']);
      });
      var pool = new Pool(Networks.livenet);
      pool.connect();
      pool.addrs.length.should.equal(3);
      stub.restore();

    });

    it('should not discover peers via dns', function() {
      var pool = new Pool();
      pool.addAddr({ip: '10.10.10.1'});
      pool.connect();
      pool.addrs.length.should.equal(1);
    });

  });

}
