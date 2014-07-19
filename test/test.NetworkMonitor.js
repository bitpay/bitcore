'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');
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
  describe('incoming tx event', function() {
    it('should be called on incoming transactions', function(done) {
      var nm = createConnectedNM();
      nm.incoming('n2tTCgsJPJBZZEKLiJx9KoU4idJQB37j9E', function(tx) {
        should.exist(tx);
        done();
      });
      var fakeTX = null;
      nm.connection.emit('tx', {
        message: {
          tx: fakeTX
        }
      });
    });
    it('should not be called on outgoing transactions', function() {
    });
  });
  describe('outgoing tx event', function() {
    it('should be called on outgoing transactions', function() {
    });
    it('should not be called on incoming transactions', function() {
    });
  });
});
