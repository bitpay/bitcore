'use strict';

if (typeof(window) === 'undefined'){

  // Node.js Tests

  var chai = require('chai');

  /* jshint unused: false */
  var should = chai.should();
  var expect = chai.expect;

  var bitcore = require('bitcore');
  var P2P = require('../');
  var Peer = P2P.Peer;
  var MessagesData = require('./data/messages');
  var Messages = P2P.Messages;
  var Pool = P2P.Pool;
  var Networks = bitcore.Networks;

  var dns = require('dns');
  var sinon = require('sinon');

  describe('Pool', function() {

    it('should be able to create instance', function() {
      var pool = new Pool();
      should.exist(pool.network);
      expect(pool.network).to.satisfy(function(network){
        if (network === Networks.testnet || network === Networks.livenet) {
          return true;
        }
        return false;
      });
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
      pool.disconnect();
      pool._addrs.length.should.equal(3);
      stub.restore();
    });

    it('should not discover peers via dns', function() {
      var pool = new Pool();
      pool._addAddr({ip: {v4: '10.10.10.1'}});
      pool.connect();
      pool.disconnect();
      pool._addrs.length.should.equal(1);
    });

    it('should add new addrs as they are announced over the network', function(done) {

      // only emit an event, no need to connect
      var peerConnectStub = sinon.stub(Peer.prototype, 'connect', function(){
        this._readMessage();
        this.emit('ready');
      });

      // mock a addr peer event
      var peerMessageStub = sinon.stub(Peer.prototype, '_readMessage', function(){
        var payload = new Buffer(MessagesData.ADDR.payload, 'hex');
        var message = new Messages.Addresses().fromBuffer(payload);
        this.emit(message.command, message);
      });

      var pool = new Pool();

      pool._addAddr({ip: {v4: 'localhost'}});

      // listen for the event
      pool.on('peeraddr', function(peer, message) {
        pool._addrs.length.should.equal(502);

        // restore stubs
        peerConnectStub.restore();
        peerMessageStub.restore();

        for (var i = 0; i < pool._addrs.length; i++) {
          should.exist(pool._addrs[i].hash);
          should.exist(pool._addrs[i].ip);
          should.exist(pool._addrs[i].ip.v4);
        }

        // done
        done();
      });

      pool.connect();

    });


  });

}
