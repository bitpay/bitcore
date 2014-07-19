'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');
var Transaction = bitcore.Transaction;
var NetworkMonitor = bitcore.NetworkMonitor;
var EventEmitter = require('events').EventEmitter;

var should = chai.should();

var nop = function() {};

describe('NetworkMonitor', function() {
  var config = {
    networkName: 'testnet',
    host: 'localhost',
    port: 18333
  };
  var fakePM = {};
  fakePM.on = nop;
  fakePM.config = {
    network: config.networkName
  };
  it('should initialze the main object', function() {
    should.exist(NetworkMonitor);
  });
  it('should be able to instanciate', function() {
    var nm = new NetworkMonitor(fakePM);
    should.exist(nm);
  });
  it('should be able to create instance', function() {
    var nm = new NetworkMonitor.create(config);
    should.exist(nm);
  });
  it('should be able to start instance', function() {
    var nm = new NetworkMonitor.create(config);
    nm.start.bind(nm).should.not.throw();
  });
  it('should be able to stop instance', function() {
    var nm = new NetworkMonitor.create(config);
    nm.start();
    nm.stop.bind(nm).should.not.throw();
  });
  it('should be able to register listeners', function() {
    var nm = new NetworkMonitor.create(config);
    (function() {
      nm.on('block', nop);
    }).should.not.throw();
    (function() {
      nm.incoming('n2tTCgsJPJBZZEKLiJx9KoU4idJQB37j9E', nop);
    }).should.not.throw();
    (function() {
      nm.outgoing('n2tTCgsJPJBZZEKLiJx9KoU4idJQB37j9E', nop);
    }).should.not.throw();
  });
  var createConnectedNM = function() {
    var nm = new NetworkMonitor.create(config);
    var fakeConnection = new EventEmitter();
    nm.peerman.emit('connection', fakeConnection);
    return nm;
  };
  it('should store connection', function() {
    var nm = createConnectedNM();
    should.exist(nm.connection);
  });
  describe('block event', function() {
    it('should be called on blocks', function(done) {
      var nm = createConnectedNM();
      nm.on('block', function(m) {
        should.exist(m);
        done();
      });
      nm.connection.emit('block', {
        message: 'test'
      });
    });
  });
  var observedAddress = '2NFYBLfabKgLbgoTALYrtBQhbLjEKUcs9Go';
  describe('incoming tx event', function() {
    it('should be called on incoming transactions', function(done) {
      var nm = createConnectedNM();
      nm.incoming(observedAddress, function(tx) {
        should.exist(tx);
        done();
      });
      var tx = new Transaction();
      var raw = '01000000012732117ef4663b4a7a455ff37c3af26deca57dc43f5d8e7e5440b22c11cefc8b010000006a47304402201ca8b1b33e9f7a515829b887b264b812ab499a08e0002a0fb32629bdbfbc005e0220567adbec3befee04e810e1d34bf31614e1cd397d7a6e3184f219c89562cac7a3012102f1bc222f40a7dd4348e4c2b1e88812179686305f1b56374aae891aa21929ad14ffffffff02809698000000000017a914f487a0aeae655268e2636207abe75228bfcf5631874f219800000000001976a914361d24071123fb9fd88685c877b014ff8543c24488ac00000000';
      tx.parse(new Buffer(raw, 'hex'));

      nm.connection.emit('tx', {
        message: {
          tx: tx
        }
      });
    });
    it('should not be called on unrelated transactions', function(done) {
      var nm = createConnectedNM();
      nm.incoming(observedAddress, function(tx) {
        should.exist(tx);
        done();
      });
      var raw = '010000000114bae675546f758e0dbab95aa88d4db0c63e26f8fd6cbbce3a4827446d4937cf00000000700048304502201da760691f18a0ab140de1437e4bd29767b74add8cca8e38d46a2f37d9a8188f022100cbf4e121d97b4db846d236957da7fc17fd706ad47b41ae63adf953982e34f70901255121022f58491a833933a9bea80d8e820e66bee91bd8c71bfa972fe70482360b48129951aeffffffff01706f9800000000001976a91400a26ff8123593e10d0a9eba2a74db33cd69299288ac00000000';
      var tx = new Transaction();
      tx.parse(new Buffer(raw, 'hex'));
      nm.connection.emit('tx', {
        message: {
          tx: tx
        }
      });
    });
  });
  describe('outgoing tx event', function() {
    it('should be called on outgoing transactions', function() {});
    it('should not be called on incoming transactions', function() {});
  });
});
