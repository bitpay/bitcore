'use strict';

var chai = require('chai');
var Net = require('net');
var Socks5Client = require('socks5-client');

/* jshint unused: false */
var should = chai.should();
var expect = chai.expect;

var bitcore = require('../..');
var Peer = bitcore.transport.Peer;
var Networks = bitcore.Networks;

describe('Peer', function() {

  it('should be able to create instance', function() {
    var peer = new Peer('localhost');
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.livenet);
    peer.port.should.equal(Networks.livenet.port);
  });

  it('should be able to create instance setting a port', function() {
    var peer = new Peer('localhost', 8111);
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.livenet);
    peer.port.should.equal(8111);
  });

  it('should be able to create instance setting a network', function() {
    var peer = new Peer('localhost', Networks.testnet);
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.testnet);
    peer.port.should.equal(Networks.testnet.port);
  });

  it('should be able to create instance setting port and network', function() {
    var peer = new Peer('localhost', 8111, Networks.testnet);
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.testnet);
    peer.port.should.equal(8111);
  });

  it('should support creating instance without new', function() {
    var peer = Peer('localhost', 8111, Networks.testnet);
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.testnet);
    peer.port.should.equal(8111);
  });

  if (typeof(window) === 'undefined'){

    // Node.js Tests

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

  }

});
