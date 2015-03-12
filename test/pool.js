'use strict';

var chai = require('chai');

/* jshint unused: false */
var should = chai.should();
var expect = chai.expect;

var bitcore = require('bitcore');
var P2P = require('../');
var Peer = P2P.Peer;
var MessagesData = require('./data/messages');
var Messages = P2P.Messages;
var messages = new Messages();
var Pool = P2P.Pool;
var Networks = bitcore.Networks;

var dns = require('dns');
var sinon = require('sinon');

function getPayloadBuffer(messageBuffer) {
  return new Buffer(messageBuffer.slice(48), 'hex');
}

describe('Pool', function() {

  it('should be able to create instance', function() {
    var pool = new Pool();
    should.exist(pool.network);
    expect(pool.network).to.satisfy(function(network) {
      return network === Networks.testnet || network === Networks.livenet;
    });
  });

  it('should be able to create instance setting the network', function() {
    var pool = new Pool({network: Networks.testnet});
    pool.network.should.equal(Networks.testnet);
  });

  it('should discover peers via dns', function() {
    var stub = sinon.stub(dns, 'resolve', function(seed, callback) {
      callback(null, ['10.10.10.1', '10.10.10.2', '10.10.10.3']);
    });
    var pool = new Pool({network: Networks.livenet});
    pool.connect();
    pool.disconnect();
    pool._addrs.length.should.equal(3);
    stub.restore();
  });

  it('can optionally connect without dns seeds', function() {
    var stub = sinon.stub(dns, 'resolve', function(seed, callback) {
      throw new Error('DNS should not be called');
    });
    var options = {
      network: Networks.livenet,
      dnsSeed: false,
      maxSize: 1,
      addrs: [
        {
          ip: {
            v4: 'localhost'
          }
        },
        {
          ip: {
            v4: 'localhost2'
          }
        }
      ]
    };
    var pool = new Pool(options);
    pool.connect();
    pool.disconnect();
    pool._addrs.length.should.equal(2);
    stub.restore();
  });

  it('will add addrs via options argument', function() {
    var options = {
      network: Networks.livenet,
      dnsSeed: false,
      addrs: [
        {
          ip: {
            v4: 'localhost'
          }
        }
      ]
    };
    var pool = new Pool(options);
    pool._addrs.length.should.equal(1);
  });

  it('should add new addrs as they are announced over the network', function(done) {

    // only emit an event, no need to connect
    var peerConnectStub = sinon.stub(Peer.prototype, 'connect', function() {
      this._readMessage();
      this.emit('ready');
    });

    // mock a addr peer event
    var peerMessageStub = sinon.stub(Peer.prototype, '_readMessage', function() {
      var payloadBuffer = getPayloadBuffer(MessagesData.addr.message);
      var message = messages.buildFromBuffer('addr', payloadBuffer);
      this.emit(message.command, message);
    });

    var options = {
      network: Networks.testnet,
      dnsSeed: false,
      addrs: [
        {
          ip: {
            v4: 'localhost'
          }
        }
      ]
    };

    var pool = new Pool(options);

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

  it('can optionally not listen to new addrs messages', function(done) {

    // only emit an event, no need to connect
    var peerConnectStub = sinon.stub(Peer.prototype, 'connect', function() {
      this._readMessage();
      this.emit('ready');
    });

    // mock a addr peer event
    var peerMessageStub = sinon.stub(Peer.prototype, '_readMessage', function() {
      var payloadBuffer = getPayloadBuffer(MessagesData.addr.message);
      var message = messages.buildFromBuffer('addr', payloadBuffer);
      this.emit(message.command, message);
    });

    var options = {
      network: Networks.testnet,
      dnsSeed: false,
      listenAddr: false,
      addrs: [
        {
          ip: {
            v4: 'localhost'
          }
        }
      ]
    };

    var pool = new Pool(options);

    // listen for the event
    pool.on('peeraddr', function(peer, message) {
      pool._addrs.length.should.equal(1);

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

  it('should propagate connect, ready, and disconnect peer events', function(done) {
    var peerConnectStub = sinon.stub(Peer.prototype, 'connect', function() {
      this.emit('connect', this, {});
      this.emit('ready');
    });
    var peerDisconnectStub = sinon.stub(Peer.prototype, 'disconnect', function() {
      this.emit('disconnect', this, {});
    });
    var poolRemoveStub = sinon.stub(Pool.prototype, '_removeConnectedPeer', function() {});

    var pool = new Pool({
      dnsSeed: false,
      addrs: [
        {
          ip: {
            v4: 'localhost'
          }
        }
      ]
    });

    var poolDisconnectStub;
    pool.on('peerconnect', function(peer, addr) {
      pool.on('peerready', function(peer, addr) {
        // disconnect when the peer is ready
        poolDisconnectStub = sinon.stub(Pool.prototype, 'disconnect', function() {
          peer.disconnect();
        });
        pool.disconnect();
      });
    });
    pool.on('peerdisconnect', function(peer, addr) {
      // Restore stubs
      peerConnectStub.restore();
      peerDisconnectStub.restore();
      poolDisconnectStub.restore();
      poolRemoveStub.restore();

      // done
      done();
    });

    pool.connect();
  });

  it('should propagate Pool.relay property to peers', function(done) {
    var count = 0;
    var peerConnectStub = sinon.stub(Peer.prototype, 'connect', function() {
      this.emit('connect', this, {});
    });
    [true, false].forEach(function(relay) {
      var pool = new Pool({relay: relay, dnsSeed: false});
      pool._addAddr({ ip: { v4: 'localhost' } });
      pool.on('peerconnect', function(peer, addr) {
        peer.relay.should.equal(relay);
        pool.disconnect();
        if(++count == 2) {
          done();
        }
      });
      pool.connect();
    });
    peerConnectStub.restore();
  });

  it('should output the console correctly', function() {
    var pool = new Pool();
    pool.inspect().should.equal('<Pool network: livenet, connected: 0, available: 0>');
  });

  it('should emit seederrors with error', function(done) {
    var dnsStub = sinon.stub(dns, 'resolve', function(seed, callback) {
      callback(new Error('A DNS error'));
    });
    var pool = new Pool({network: Networks.livenet, maxSize: 1});
    pool.once('seederror', function(error) {
      should.exist(error);
      pool.disconnect();
      dnsStub.restore();
      done();
    });
    pool.connect();
  });

  it('should emit seederrors with notfound', function(done) {
    var dnsStub = sinon.stub(dns, 'resolve', function(seed, callback) {
      callback(null, []);
    });
    var pool = new Pool({network: Networks.livenet, maxSize: 1});
    pool.once('seederror', function(error) {
      should.exist(error);
      pool.disconnect();
      dnsStub.restore();
      done();
    });
    pool.connect();
  });

});
