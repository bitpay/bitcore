'use strict';

var _ = require('lodash');
var chai = require('chai');

/* jshint unused: false */
var should = chai.should();
var sinon = require('sinon');
var _ = require('lodash');

var bitcore = require('bitcore');
var Random = bitcore.crypto.Random;
var BN = bitcore.crypto.BN;
var BufferUtil = bitcore.util.buffer;
var p2p = require('../');
var Peer = p2p.Peer;
var Pool = p2p.Pool;
var Networks = bitcore.Networks;
var Messages = p2p.Messages;
var Block = bitcore.Block;
var Transaction = bitcore.Transaction;

// config 
var network = Networks.livenet;
var blockHash = {
  'livenet': '000000000000000013413cf2536b491bf0988f52e90c476ffeb701c8bfdb1db9',
  'testnet': '0000000058cc069d964711cd25083c0a709f4df2b34c8ff9302ce71fe5b45786'
};
var txHash = {
  'livenet': '22231e8219a0617a0ded618b5dc713fdf9b0db8ebd5bb3322d3011a703119d3b',
  'testnet': '22231e8219a0617a0ded618b5dc713fdf9b0db8ebd5bb3322d3011a703119d3b'
};

// These tests require a running bitcoind instance
describe('Integration with ' + network.name + ' bitcoind', function() {

  this.timeout(5000);
  it('handshakes', function(cb) {
    var peer = new Peer('localhost', network);
    peer.once('version', function(m) {
      m.version.should.be.above(70000);
      m.services.toString().should.equal('1');
      Math.abs(new Date() - m.timestamp).should.be.below(10000); // less than 10 seconds of time difference
      m.nonce.length.should.equal(8);
      m.start_height.should.be.above(300000);
      cb();
    });
    peer.once('verack', function(m) {
      should.exist(m);
      m.command.should.equal('verack');
    });
    peer.connect();
  });
  var connect = function(cb) {
    var peer = new Peer('localhost', network);
    peer.once('ready', function() {
      cb(peer);
    });
    peer.once('error', function(err) {
      should.not.exist(err);
    });
    peer.connect();
  };
  it('connects', function(cb) {
    connect(function(peer) {
      peer.version.should.be.above(70000);
      _.isString(peer.subversion).should.equal(true);
      _.isNumber(peer.bestHeight).should.equal(true);
      cb();
    });
  });
  it('handles inv', function(cb) {
    // assumes there will be at least one transaction/block
    // in the next few seconds
    connect(function(peer) {
      peer.once('inv', function(message) {
        message.inventory[0].hash.length.should.equal(32);
        cb();
      });
    });
  });
  it('handles addr', function(cb) {
    connect(function(peer) {
      peer.once('addr', function(message) {
        message.addresses.forEach(function(address) {
          // console.log(address.ip.v4 + ':' + address.port);
          (address.time instanceof Date).should.equal(true);
          should.exist(address.ip);
          (address.services instanceof BN).should.equal(true);
        });
        cb();
      });
      var message = new Messages.GetAddresses();
      peer.sendMessage(message);
    });
  });
  it('can request inv detailed info', function(cb) {
    connect(function(peer) {
      peer.once('block', function(message) {
        //console.log(message.block.toJSON());
        should.exist(message.block);
        cb();
      });
      peer.once('tx', function(message) {
        //console.log(message.transaction.toJSON());
        should.exist(message.transaction);
        cb();
      });
      peer.once('inv', function(m) {
        var message = new Messages.GetData(m.inventory);
        peer.sendMessage(message);
      });
    });
  });
  it('can send tx inv and receive getdata for that tx', function(cb) {
    connect(function(peer) {
      var type = Messages.Inventory.TYPE.TX;
      var inv = [{
        type: type,
        typeName: Messages.Inventory.TYPE_NAME[type],
        hash: Random.getRandomBuffer(32) // needs to be random for repeatability
      }];
      peer.once('getdata', function(message) {
        message.inventory.should.deep.equal(inv);
        cb();
      });
      var message = new Messages.Inventory(inv);
      message.inventory[0].hash.length.should.equal(32);
      peer.sendMessage(message);
    });
  });
  it('can request block data', function(cb) {
    connect(function(peer) {
      peer.once('block', function(message) {
        (message.block instanceof Block).should.equal(true);
        cb();
      });
      // TODO: replace this for a new Messages.GetData.forBlock(hash)
      var message = Messages.GetData.forBlock(blockHash[network.name]);
      peer.sendMessage(message);
    });
  });
  it('can handle request tx data not found', function(cb) {
    connect(function(peer) {
      var hash = 'e2dfb8afe1575bfacae1a0b4afc49af7ddda69285857267bae0e22be15f74a3a';
      var expected = Messages.NotFound.forTransaction(hash);
      peer.once('notfound', function(message) {
        (message instanceof Messages.NotFound).should.equal(true);
        message.should.deep.equal(expected);
        cb();
      });
      var message = Messages.GetData.forTransaction(hash);
      peer.sendMessage(message);
    });
  });
});
