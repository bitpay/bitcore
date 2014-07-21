'use strict';

var chai = chai || require('chai');
var sinon = sinon || require('sinon');
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
    nm.stop();
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
  var observedAddress = 'mwABUqsGjjeTgExrBmyyWEErS8yA4QNAUJ';
  var simulateNetworkTx = function(raw, nm) {
    var tx = new Transaction();
    tx.parse(new Buffer(raw, 'hex'));
    nm.connection.emit('tx', {
      message: {
        tx: tx
      }
    });
    return tx;
  };
  var incomingRaw = '01000000017ee4912333a1add2b03041b7abf4f64c365634a2d31ebfef4f47684c5adcfc49010000006a473044022064e5a4bd31615d184f7c660fcb7e072bfaaf8d87ad8f208ec85276b66420aeb102201c4fe9921495b07492a26648d4b124b346028dbdd91fea1ce3a32a21f1accb31012102749393ba256c17f67ff1c3e7d3ad72e610f07146b2d1d996287b1c500a75062effffffff0200ca9a3b000000001976a914ab9448d3b5adab710665e82506ae5cbd4ba7ba1288acf0bfe71c000000001976a9146c45fa9d90420668f7ff16e33d3d21b0d7e73bc188ac00000000';
  var unrelatedRaw = '010000000114bae675546f758e0dbab95aa88d4db0c63e26f8fd6cbbce3a4827446d4937cf00000000700048304502201da760691f18a0ab140de1437e4bd29767b74add8cca8e38d46a2f37d9a8188f022100cbf4e121d97b4db846d236957da7fc17fd706ad47b41ae63adf953982e34f70901255121022f58491a833933a9bea80d8e820e66bee91bd8c71bfa972fe70482360b48129951aeffffffff01706f9800000000001976a91400a26ff8123593e10d0a9eba2a74db33cd69299288ac00000000';
  var outgoingRaw = '0100000001613b50ef601ac068b7805afb8615bb06371881321a478b62d1f52d21f2a8529c000000006b483045022100e3c38e6da99bc8e4b6150404d3afc9ee74b5b48a245311e8fb0e019a3f69570102201eda167b14d675f7b9cf60cf1b0c65b1d66efa4a339743aaec047ce90b92e52e0121031915a253ead0da95c46ff64d07fe4d562a29b7fc211c6a8f49764ac85c039de4ffffffff01f0a29a3b000000001976a914c69536a7d60748bb1953e5e186edf920efa823e388ac00000000';

  describe('tx event', function() {
    it('should be called on network transactions', function() {
      var nm = createConnectedNM();
      var spy = sinon.spy();
      nm.on('tx', spy);
      var tx1 = simulateNetworkTx(incomingRaw, nm);
      var tx2 = simulateNetworkTx(unrelatedRaw, nm);
      var tx3 = simulateNetworkTx(outgoingRaw, nm);
      spy.calledWith(tx1).should.equal(true);
      spy.calledWith(tx2).should.equal(true);
      spy.calledWith(tx3).should.equal(true);
      spy.callCount.should.equal(3);
    });
  });
  describe('incoming tx event', function() {
    it('should be called on incoming transactions', function() {
      var nm = createConnectedNM();
      var spy = sinon.spy();
      nm.incoming(observedAddress, spy);
      var tx = simulateNetworkTx(incomingRaw, nm);
      spy.calledWith(tx).should.equal(true);
      spy.callCount.should.equal(1);
    });
    it('should not be called on unrelated transactions', function() {
      var nm = createConnectedNM();
      var spy = sinon.spy();
      nm.incoming(observedAddress, spy);
      var tx = simulateNetworkTx(unrelatedRaw, nm);
      spy.calledWith(tx).should.equal(false);
      spy.callCount.should.equal(0);
    });
    it('should not be called on outgoing transactions', function() {
      var nm = createConnectedNM();
      var spy = sinon.spy();
      nm.incoming(observedAddress, spy);
      var tx = simulateNetworkTx(outgoingRaw, nm);
      spy.calledWith(tx).should.equal(false);
      spy.callCount.should.equal(0);
    });
  });
  describe('outgoing tx event', function() {
    it('should be called on outgoing transactions', function() {
      var nm = createConnectedNM();
      var spy = sinon.spy();
      nm.outgoing(observedAddress, spy);
      var tx = simulateNetworkTx(outgoingRaw, nm);
      spy.calledWith(tx).should.equal(true);
      spy.callCount.should.equal(1);
    });
    it('should not be called on unrelated transactions', function() {
      var nm = createConnectedNM();
      var spy = sinon.spy();
      nm.outgoing(observedAddress, spy);
      var tx = simulateNetworkTx(unrelatedRaw, nm);
      spy.calledWith(tx).should.equal(false);
      spy.callCount.should.equal(0);
    });
    it('should not be called on incoming transactions', function() {
      var nm = createConnectedNM();
      var spy = sinon.spy();
      nm.outgoing(observedAddress, spy);
      var tx = simulateNetworkTx(incomingRaw, nm);
      spy.calledWith(tx).should.equal(false);
      spy.callCount.should.equal(0);
    });
  });
});
