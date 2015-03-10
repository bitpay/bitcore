'use strict';

var chai = require('chai');
var Net = require('net');
var Socks5Client = require('socks5-client');

/* jshint unused: false */
var should = chai.should();
var expect = chai.expect;
var sinon = require('sinon');
var fs = require('fs');

var bitcore = require('bitcore');
var _ = bitcore.deps._;
var P2P = require('../');
var Peer = P2P.Peer;
var Networks = bitcore.Networks;

describe('Peer', function() {

  describe('Integration test', function() {
    it('parses this stream of data from a connection', function(callback) {
      var peer = new Peer('');
      var stub = sinon.stub();
      var dataCallback;
      var connectCallback;
      var expected = {
        version: 1,
        verack: 1,
        inv: 18,
        addr: 4
      };
      var received = {
        version: 0,
        verack: 0,
        inv: 0,
        addr: 0
      };
      stub.on = function() {
        if (arguments[0] === 'data') {
          dataCallback = arguments[1];
        }
        if (arguments[0] === 'connect') {
          connectCallback = arguments[1];
        }
      };
      stub.write = function() {};
      stub.connect = function() {
        connectCallback();
      };
      peer._getSocket = function() {
        return stub;
      };
      peer.on('connect', function() {
        dataCallback(fs.readFileSync('./test/data/connection.log'));
      });
      var check = function(message) {
        received[message.command]++;
        if (_.isEqual(received, expected)) {
          callback();
        }
      };
      peer.on('version', check);
      peer.on('verack', check);
      peer.on('addr', check);
      peer.on('inv', check);
      peer.connect();
    });
  });


  it('should be able to create instance', function() {
    var peer = new Peer('localhost');
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.livenet);
    peer.port.should.equal(Networks.livenet.port);
  });

  it('should be able to create instance setting a port', function() {
    var peer = new Peer({host: 'localhost', port: 8111});
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.livenet);
    peer.port.should.equal(8111);
  });

  it('should be able to create instance setting a network', function() {
    var peer = new Peer({host: 'localhost', network: Networks.testnet});
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.testnet);
    peer.port.should.equal(Networks.testnet.port);
  });

  it('should be able to create instance setting port and network', function() {
    var peer = new Peer({host: 'localhost', port: 8111, network: Networks.testnet});
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.testnet);
    peer.port.should.equal(8111);
  });

  it('should support creating instance without new', function() {
    var peer = Peer({host: 'localhost', port: 8111, network: Networks.testnet});
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.testnet);
    peer.port.should.equal(8111);
  });

  it('should be able to set a proxy', function() {
    var peer, peer2, socket;

    peer = new Peer('localhost');
    expect(peer.proxy).to.be.undefined();
    socket = peer._getSocket();
    socket.should.be.instanceof(Net.Socket);

    peer2 = peer.setProxy('127.0.0.1', 9050);
    peer2.proxy.host.should.equal('127.0.0.1');
    peer2.proxy.port.should.equal(9050);
    socket = peer2._getSocket();
    socket.should.be.instanceof(Socks5Client);

    peer.should.equal(peer2);
  });

  it('Peer.relay setting set properly', function() {
    var peer = new Peer({host: 'localhost'});
    peer.relay.should.equal(true);
    var peer2 = new Peer({host: 'localhost', relay: false});
    peer2.relay.should.equal(false);
    var peer3 = new Peer({host: 'localhost', relay: true});
    peer3.relay.should.equal(true);
  });

  it('Peer.relay setting respected', function() {
    [true,false].forEach(function(relay) {
      var peer = new Peer({host: 'localhost', relay: relay});
      var peerSendMessageStub = sinon.stub(Peer.prototype, 'sendMessage', function(message) {
        message.relay.should.equal(relay);
      });
      peer._sendVersion();
      peerSendMessageStub.restore();
    });
  });

});
