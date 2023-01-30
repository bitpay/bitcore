'use strict';

var chai = require('chai');
var Net = require('net');
var Socks5Client = require('socks5-client');

/* jshint unused: false */
var should = chai.should();
var expect = chai.expect;
var sinon = require('sinon');
var fs = require('fs');

var bitcore = require('bitcore-lib-cash');
var _ = bitcore.deps._;
var P2P = require('../');
var Peer = P2P.Peer;
var EventEmitter = require('events').EventEmitter;
var Messages = P2P.Messages;
var messages = new Messages();
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

  it('create instance', function() {
    var peer = new Peer('localhost');
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.livenet);
    peer.port.should.equal(Networks.livenet.port);
  });

  it('create instance setting a port', function() {
    var peer = new Peer({host: 'localhost', port: 8111});
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.livenet);
    peer.port.should.equal(8111);
  });

  it('create instance setting a network', function() {
    var peer = new Peer({host: 'localhost', network: Networks.testnet});
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.testnet);
    peer.port.should.equal(Networks.testnet.port);
  });

  it('create instance setting port and network', function() {
    var peer = new Peer({host: 'localhost', port: 8111, network: Networks.testnet});
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.testnet);
    peer.port.should.equal(8111);
  });

  it('create instance without new', function() {
    var peer = Peer({host: 'localhost', port: 8111, network: Networks.testnet});
    peer.host.should.equal('localhost');
    peer.network.should.equal(Networks.testnet);
    peer.port.should.equal(8111);
  });

  it('set a proxy', function() {
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

  it('send pong on ping', function(done) {
    var peer = new Peer({host: 'localhost'});
    var pingMessage = messages.Ping();
    peer.sendMessage = function(message) {
      message.command.should.equal('pong');
      message.nonce.should.equal(pingMessage.nonce);
      done();
    };
    peer.emit('ping', pingMessage);
  });

  it('relay error from socket', function(done) {
    var peer = new Peer({host: 'localhost'});
    var socket = new EventEmitter();
    socket.connect = sinon.spy();
    socket.destroy = sinon.spy();
    peer._getSocket = function() {
      return socket;
    };
    var error = new Error('error');
    peer.on('error', function(err) {
      err.should.equal(error);
      done();
    });
    peer.connect();
    peer.socket.emit('error', error);
  });

  it('will not disconnect twice on disconnect and error', function(done) {
    var peer = new Peer({host: 'localhost'});
    var socket = new EventEmitter();
    socket.connect = sinon.stub();
    socket.destroy = sinon.stub();
    peer._getSocket = function() {
      return socket;
    };
    peer.on('error', sinon.stub());
    peer.connect();
    var called = 0;
    peer.on('disconnect', function() {
      called++;
      called.should.not.be.above(1);
      done();
    });
    peer.disconnect();
    peer.socket.emit('error', new Error('fake error'));
  });

  it('disconnect with max buffer length', function(done) {
    var peer = new Peer({ host: 'localhost' });
    var socket = new EventEmitter();
    socket.connect = sinon.spy();
    peer._getSocket = function() {
      return socket;
    };
    var error;
    peer.on('error', function(err) {
      error = err;
    });
    peer.disconnect = function() {
      error.should.include({
        message: 'Data buffer exceeded MAX_RECEIVE_BUFFER, disconnecting.'
      });
      done();
    };
    peer.connect();
    var buffer = Buffer.allocUnsafe(Peer.MAX_RECEIVE_BUFFER + 1);
    peer.socket.emit('data', buffer);
  });

  it('emits an error on unknown messages', function(done) {
    var peer = new Peer({ host: 'localhost' });
    var socket = new EventEmitter();
    socket.connect = sinon.spy();
    peer._getSocket = function() {
      return socket;
    };
    var error;
    peer.on('error', function(err) {
      error = err;
    });
    peer.disconnect = function() {
      error.should.include({
        message: 'Unsupported message command: unknown'
      });
      done();
    };
    peer.connect();
    var buf = Buffer.from('e3e1f3e8756e6b6e6f776e0000000000000000005df6e0e2', 'hex');
    peer.socket.emit('data', buf);
  });

  it('should send version on version if not already sent', function(done) {
    var peer = new Peer({host:'localhost'});
    var commands = {};
    peer.sendMessage = function(message) {
      commands[message.command] = true;
      if (commands.verack && commands.version) {
        done();
      }
    };
    peer.socket = {};
    peer.emit('version', {
      version: 'version',
      subversion: 'subversion',
      startHeight: 'startHeight'
    });
  });

  it('should not send version on version if already sent', function(done) {
    var peer = new Peer({host:'localhost'});
    peer.versionSent = true;
    var commands = {};
    peer.sendMessage = function(message) {
      message.command.should.not.equal('version');
      done();
    };
    peer.socket = {};
    peer.emit('version', {
      version: 'version',
      subversion: 'subversion',
      startHeight: 'startHeight'
    });
  });

  it('relay set properly', function() {
    var peer = new Peer({host: 'localhost'});
    peer.relay.should.equal(true);
    var peer2 = new Peer({host: 'localhost', relay: false});
    peer2.relay.should.equal(false);
    var peer3 = new Peer({host: 'localhost', relay: true});
    peer3.relay.should.equal(true);
  });

  it('relay setting respected', function() {
    [true,false].forEach(function(relay) {
      var peer = new Peer({host: 'localhost', relay: relay});
      var peerSendMessageStub = sinon.stub(Peer.prototype, 'sendMessage', function(message) {
        message.relay.should.equal(relay);
      });
      peer._sendVersion();
      peerSendMessageStub.restore();
    });
  });

  it('version/subversion set properly', function() {
    var peer = new Peer({ host: 'localhost' });
    should.not.exist(peer.ownSubversion);
    should.not.exist(peer.ownVersion);
    var peer2 = new Peer({
      host: 'localhost',
      subversion: '/useragent:0.0.0/'
    });
    peer2.ownSubversion.should.equal('/useragent:0.0.0/');
    should.not.exist(peer.ownVersion);
    var peer3 = new Peer({ host: 'localhost', version: 70012 });
    should.not.exist(peer.ownSubversion);
    peer3.ownVersion.should.equal(70012);
    var peer4 = new Peer({
      host: 'localhost',
      subversion: '/useragent:0.0.0/',
      version: 70012
    });
    peer4.ownSubversion.should.equal('/useragent:0.0.0/');
    peer4.ownVersion.should.equal(70012);
  });

  it('version/subversion settings respected', function(done) {
  var socket = new EventEmitter();
    var peer = new Peer({
      socket: socket,
      subversion: '/useragent:0.0.0/',
      version: 70012
    });
    peer.sendMessage = function(message) {
      message.version.should.equal(70012);
      message.subversion.should.equal('/useragent:0.0.0/');
      peer.disconnect();
    };
    peer.on('disconnect', () => {
      done();
    });
    peer.connect();
  });
});
