'use strict';

const should = require('chai').should();
const bitcore = require('@bitpay-labs/bitcore-lib-cash');
const P2P = require('../');

const Inventory = P2P.Inventory;
const BufferUtils = bitcore.util.buffer;
const BufferWriter = bitcore.encoding.BufferWriter;
const BufferReader = bitcore.encoding.BufferReader;

describe('Inventory', function() {

  const hash = Buffer.from('eb951630aba498b9a0d10f72b5ea9e39d5ff04b03dc2231e662f52057f948aa1', 'hex');
  const hashedStr = BufferUtils.reverse(Buffer.from(hash, 'hex')).toString('hex');
  const inventoryBuffer = Buffer.from(
    '01000000eb951630aba498b9a0d10f72b5ea9e39d5ff04b03dc2231e662f52057f948aa1',
    'hex'
  );

  describe('@constructor', function() {
    it('create inventory', function() {
      const inventory = new Inventory({ type: Inventory.TYPE.TX, hash: hash });
      should.exist(inventory);
    });

    it('error with string hash', function() {
      (function() {
        const inventory = new Inventory({ type: Inventory.TYPE.TX, hash: hashedStr });
        should.not.exist(inventory);
      }).should.throw('Unexpected hash');
    });

  });

  describe('#forItem', function() {
    it('handle a string hash (reversed)', function() {
      const inventory = Inventory.forItem(Inventory.TYPE.TX, hashedStr);
      should.exist(inventory);
      inventory.hash.should.deep.equal(Buffer.from(hash, 'hex'));
    });

  });

  describe('#forBlock', function() {
    it('use correct block type', function() {
      const inventory = Inventory.forBlock(hash);
      should.exist(inventory);
      inventory.type.should.equal(Inventory.TYPE.BLOCK);
    });
  });

  describe('#forFilteredBlock', function() {
    it('use correct filtered block type', function() {
      const inventory = Inventory.forFilteredBlock(hash);
      should.exist(inventory);
      inventory.type.should.equal(Inventory.TYPE.FILTERED_BLOCK);
    });
  });

  describe('#forTransaction', function() {
    it('use correct filtered tx type', function() {
      const inventory = Inventory.forTransaction(hash);
      should.exist(inventory);
      inventory.type.should.equal(Inventory.TYPE.TX);
    });
  });

  describe('#toBuffer', function() {
    it('serialize correctly', function() {
      const inventory = Inventory.forTransaction(hash);
      const buffer = inventory.toBuffer();
      buffer.should.deep.equal(inventoryBuffer);
    });
  });

  describe('#toBufferWriter', function() {
    it('write to a buffer writer', function() {
      const bw = new BufferWriter();
      const inventory = Inventory.forTransaction(hash);
      inventory.toBufferWriter(bw);
      bw.concat().should.deep.equal(inventoryBuffer);
    });
  });

  describe('#fromBuffer', function() {
    it('deserialize a buffer', function() {
      const inventory = Inventory.fromBuffer(inventoryBuffer);
      should.exist(inventory);
      inventory.type.should.equal(Inventory.TYPE.TX);
      inventory.hash.should.deep.equal(hash);
    });
  });

  describe('#fromBufferWriter', function() {
    it('deserialize from a buffer reader', function() {
      const bw = new BufferReader(inventoryBuffer);
      const inventory = Inventory.fromBufferReader(bw);
      should.exist(inventory);
      inventory.type.should.equal(Inventory.TYPE.TX);
      inventory.hash.should.deep.equal(hash);
    });
  });

});
