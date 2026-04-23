'use strict';

const bitcore = require('@bitpay-labs/bitcore-lib-doge');
const chai = require('chai');
const p2p = require('../');

const should = chai.should();
const Random = bitcore.crypto.Random;
const BN = bitcore.crypto.BN;
const Peer = p2p.Peer;
const Networks = bitcore.Networks;
const Messages = p2p.Messages;
const Inventory = p2p.Inventory;
const Block = bitcore.Block;

// config 
const network = process.env.NETWORK === 'testnet' ? Networks.testnet : Networks.livenet;
const messages = new Messages({
  network: network
});
const blockHash = {
  'livenet': '000000000000000013413cf2536b491bf0988f52e90c476ffeb701c8bfdb1db9',
  'testnet': '0000000058cc069d964711cd25083c0a709f4df2b34c8ff9302ce71fe5b45786'
};
const stopBlock = {
  'livenet': '00000000000000000b539ef570128acb953af3dbcfc19dd8e6066949672311a1',
  'testnet': '00000000d0bc4271bcefaa7eb25000e345910ba16b91eb375cd944b68624de9f'
};
const txHash = {
  'livenet': '22231e8219a0617a0ded618b5dc713fdf9b0db8ebd5bb3322d3011a703119d3b',
  'testnet': '22231e8219a0617a0ded618b5dc713fdf9b0db8ebd5bb3322d3011a703119d3b'
};

// These tests require a running bitcoind instance
describe('Integration with ' + network.name + ' bitcoind', function() {

  this.timeout(15000);
  const opts = {
    host: 'localhost',
    network: network.name
  };
  it('handshakes', function(cb) {
    const peer = new Peer(opts);
    peer.once('version', function(m) {
      m.version.should.be.above(70000);
      m.services.toString().should.equal('1');
      Math.abs(new Date() - m.timestamp).should.be.below(10000); // less than 10 seconds of time difference
      m.nonce.length.should.equal(8);
      m.startHeight.should.be.above(300000);
      cb();
    });
    peer.once('verack', function(m) {
      should.exist(m);
      m.command.should.equal('verack');
    });
    peer.connect();
  });
  const connect = function(cb) {
    const peer = new Peer(opts);
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
      (typeof peer.subversion === 'string').should.be(true);
      (typeof peer.bestHeight === 'number').should.be(true);
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
        for (const address of message.addresshes) {
          (address.time instanceof Date).should.equal(true);
          should.exist(address.ip);
          (address.services instanceof BN).should.equal(true);
        }
        cb();
      });
      const message = messages.GetAddr();
      peer.sendMessage(message);
    });
  });
  it('requests inv detailed info', function(cb) {
    connect(function(peer) {
      peer.once('block', function(message) {
        should.exist(message.block);
        cb();
      });
      peer.once('tx', function(message) {
        should.exist(message.transaction);
        cb();
      });
      peer.once('inv', function(message) {
        const get = messages.GetData(message.inventory);
        peer.sendMessage(get);
      });
    });
  });
  it('sends tx inv and receives getdata for that tx', function(cb) {
    connect(function(peer) {
      const type = Inventory.TYPE.TX;
      const inv = [{
        type: type,
        hash: Buffer.from(Random.getRandomBuffer(32)) // needs to be random for repeatability
      }];
      peer.once('getdata', function(message) {
        message.inventory[0].should.deep.equal(inv[0]);
        cb();
      });
      const message = messages.Inventory(inv);
      message.inventory[0].hash.length.should.equal(32);
      peer.sendMessage(message);
    });
  });
  it('requests block data', function(cb) {
    connect(function(peer) {
      peer.once('block', function(message) {
        (message.block instanceof Block).should.equal(true);
        cb();
      });
      const message = messages.GetData.forBlock(blockHash[network.name]);
      peer.sendMessage(message);
    });
  });
  const fakeHash = 'e2dfb8afe1575bfacae1a0b4afc49af7ddda69285857267bae0e22be15f74a3a';
  it('handles request tx data not found', function(cb) {
    connect(function(peer) {
      const expected = messages.NotFound.forTransaction(fakeHash);
      peer.once('notfound', function(message) {
        message.command.should.equal('notfound');
        message.inventory[0].type.should.equal(Inventory.TYPE.TX);
        const expectedHash = expected.inventory[0].hash.toString('hex');
        message.inventory[0].hash.toString('hex').should.equal(expectedHash);
        cb();
      });
      const message = messages.GetData.forTransaction(fakeHash);
      peer.sendMessage(message);
    });
  });
  const from = [blockHash[network.name]];
  const stop = stopBlock[network.name];
  it('gets headers', function(cb) {
    connect(function(peer) {
      peer.once('headers', function(message) {
        message.command.should.equal('headers');
        message.headers.length.should.equal(3);
        cb();
      });
      const message = messages.GetHeaders({
        starts: from,
        stop: stop
      });
      peer.sendMessage(message);
    });
  });
  it('gets blocks', function(cb) {
    connect(function(peer) {
      peer.once('inv', function(message) {
        message.command.should.equal('inv');
        if (message.inventory.length === 2) {
          message.inventory[0].type.should.equal(Inventory.TYPE.BLOCK);
          message.inventory[1].type.should.equal(Inventory.TYPE.BLOCK);
          cb();
        }
      });
      const message = messages.GetBlocks({
        starts: from,
        stop: stop
      });
      peer.sendMessage(message);
    });
  });
  const testInvGetData = function(expected, message, cb) {
    connect(function(peer) {
      peer.once('getdata', function(message) {
        message.command.should.equal('getdata');
        message.inventory[0].type.should.equal(expected.inventory[0].type);
        const expectedHash = expected.inventory[0].hash.toString('hex');
        message.inventory[0].hash.toString('hex').should.equal(expectedHash);
        cb();
      });
      peer.sendMessage(message);
    });
  };
  it('sends block inv and receives getdata', function(cb) {
    const randomHash = Buffer.from(Random.getRandomBuffer(32)); // slow buffer
    const expected = messages.GetData.forBlock(randomHash);
    const message = messages.Inventory.forBlock(randomHash);
    testInvGetData(expected, message, cb);
  });
  it('sends tx inv and receives getdata', function(cb) {
    const randomHash = Buffer.from(Random.getRandomBuffer(32)); // slow buffer
    const expected = messages.GetData.forTransaction(randomHash);
    const message = messages.Inventory.forTransaction(randomHash);
    testInvGetData(expected, message, cb);
  });
});
