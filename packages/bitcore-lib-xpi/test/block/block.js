'use strict';

var bitcore = require('../..');
var BN = require('../../lib/crypto/bn');
var BufferReader = bitcore.encoding.BufferReader;
var BufferWriter = bitcore.encoding.BufferWriter;
var BlockHeader = bitcore.BlockHeader;
var Block = bitcore.Block;
var chai = require('chai');
var fs = require('fs');
var should = chai.should();
var Transaction = bitcore.Transaction;

// https://test-insight.bitpay.com/block/000000000b99b16390660d79fcc138d2ad0c89a0d044c4201a02bdf1f61ffa11
var dataRawBlockBuffer = fs.readFileSync('test/data/blk15290-testnet.dat');
var dataRawBlockBinary = fs.readFileSync('test/data/blk15290-testnet.dat', 'binary');
var dataJson = fs.readFileSync('test/data/blk15290-testnet.json').toString();
var data = require('../data/blk15290-testnet');
var dataBlocks = require('../data/bitcoind/blocks');

describe('Block', function () {
  var blockhex;
  var blockbuf;
  var bh;
  var txs = [];
  var json;
  var genesishex;
  var genesisbuf;
  var genesisidhex;
  var blockOneHex;
  var blockOneBuf;
  var blockOneId;

  before(function () {
    blockhex = data.blockhex;
    blockbuf = Buffer.from(blockhex, 'hex');
    bh = BlockHeader.fromBuffer(Buffer.from(data.blockheaderhex, 'hex'));
    txs = [];
    JSON.parse(dataJson).transactions.forEach(function (tx) {
      txs.push(new Transaction().fromObject(tx));
    });
    json = dataJson;

    genesishex = '00000000000000000000000000000000000000000000000000000000000000000000101cf407d06000000000ab78287d559f2c63017b0100000000000000000000000000000000000000000000000000000000000000000000000000000000004cf30ab9dc2797f3a4fe5f6b2dbf11670bf97e5aa266d3a6adcd708fd892f3371406e05881e299367766d313e26c05564ec91bf721d31726bd6e46e60689539a000101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff28274a6f686e20313a3120496e2074686520626567696e6e696e672077617320746865204c6f676f73ffffffff0280a4bf0700000000296a056c6f676f730020ffe330c4b7643e554c62adcbe0b80537435d888b5c33d5e29a70cdd743e3a09380a4bf0700000000434104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5fac00000000';
    genesisbuf = Buffer.from(genesishex, 'hex');
    genesisidhex = '000000000abc0cde58ee7e919d3d4de183e6844add1fd5d14b4eac89d958f470';
    blockOneHex = '70f458d989ac4e4bd1d51fdd4a84e683e14d3d9d917eee58de0cbc0a000000000000101c0408d0600000000046d65c540000000001c202000000000001000000000000000000000000000000000000000000000000000000000000000000000037c6a4c3ab117941d1d3254fd67a5595581197ee9ed81873d71cccd89ecfeae91406e05881e299367766d313e26c05564ec91bf721d31726bd6e46e60689539a000102000000010000000000000000000000000000000000000000000000000000000000000000ffffffff020000ffffffff0f0000000000000000086a056c6f676f735180a4bf07000000001976a91452668d450b08e868d520605f8e891c34e3a9f95f88ac809698000000000017a914b6c79031b71d86ab0d617e1e1e706ec4ee34b07f8780969800000000001976a914b8ae1c47effb58f72f7bca819fe7fc252f9e852e88ac80969800000000001976a914b50b86a893d80c9e2ee72b199612374b7b4c1cd888ac80969800000000001976a914da76a31b6760dcb90aa469c15965da6e80096e4588ac80969800000000001976a9141325d2d8ba6e8c7d99ff66d21530917cc73429d288ac80969800000000001976a9146a171891ab9443020bd2755ef79c6e59efc5926588ac80969800000000001976a91419e8d8d0edab6ec43f04b656bff72af78d63ff6588ac80969800000000001976a914c6492d4e44dcd0051e60a8add6af02b2f291b2aa88ac80969800000000001976a914b5aeafec9f2972110c4c6af9508a3c41e1d3c73b88ac80969800000000001976a9147c28aa91b93faf8aee0a6520a0a83f42dbc4a45b88ac80969800000000001976a914b18eb08c4978e73480743b1598061d3cf38e10a888ac80969800000000001976a9147d0893d1a278bab27e7ad92ed88bd7dceafd83a588ac80969800000000001976a9144b869f9a55c57003df178bdc801184109d904f8b88ac00000000';
    blockOneBuf = Buffer.from(blockOneHex, 'hex');
    blockOneId = '00000000090ac785b348fc296a84ec2e45ee5fed25419a8557d868152c880049';

  });

  it('should make a new block', function () {
    var b = Block(blockbuf);
    b.toBuffer().toString('hex').should.equal(blockhex);
  });

  it('should not make an empty block', function () {
    (function () {
      return new Block();
    }).should.throw('Unrecognized argument for Block');
  });

  describe('#constructor', function () {

    it('should set these known values', function () {
      var b = new Block({
        header: bh,
        metadata: 0,
        transactions: txs
      });
      should.exist(b.header);
      should.exist(b.transactions);
    });

    it('should properly deserialize blocks', function () {
      dataBlocks.forEach(function (block) {
        var b = Block.fromBuffer(Buffer.from(block.data, 'hex'));
        b.transactions.length.should.equal(block.transactions);
      });
    });

  });

  describe('#fromRawBlock', function () {

    it('should instantiate from a raw block binary', function () {
      var x = Block.fromRawBlock(dataRawBlockBinary);
      x.header.version.should.equal(1);
      new BN(x.header.bits).toString('hex').should.equal('1b3e2220');
    });

    it('should instantiate from raw block buffer', function () {
      var x = Block.fromRawBlock(dataRawBlockBuffer);
      x.header.version.should.equal(1);
      new BN(x.header.bits).toString('hex').should.equal('1b3e2220');
    });

  });

  describe('#fromJSON', function () {

    it('should set these known values', function () {
      var block = Block.fromObject(JSON.parse(json));
      should.exist(block.header);
      should.exist(block.transactions);
    });

    it('should set these known values', function () {
      var block = new Block(JSON.parse(json));
      should.exist(block.header);
      should.exist(block.transactions);
    });

  });

  describe('#toJSON', function () {

    it('should recover these known values', function () {
      var block = Block.fromObject(JSON.parse(json));
      var b = block.toJSON();
      should.exist(b.header);
      should.exist(b.transactions);
    });

  });

  describe('#fromString/#toString', function () {

    it('should output/input a block hex string', function () {
      var b = Block.fromString(blockhex);
      b.toString().should.equal(blockhex);
    });

  });

  describe('#fromBuffer', function () {

    it('should make a block from this known buffer', function () {
      var block = Block.fromBuffer(blockbuf);
      block.toBuffer().toString('hex').should.equal(blockhex);
    });

    it('should instantiate from block buffer from the network', function () {
      var networkBlock = '70f458d989ac4e4bd1d51fdd4a84e683e14d3d9d917eee58de0cbc0a000000000000101c0408d0600000000046d65c540000000001c202000000000001000000000000000000000000000000000000000000000000000000000000000000000037c6a4c3ab117941d1d3254fd67a5595581197ee9ed81873d71cccd89ecfeae91406e05881e299367766d313e26c05564ec91bf721d31726bd6e46e60689539a000102000000010000000000000000000000000000000000000000000000000000000000000000ffffffff020000ffffffff0f0000000000000000086a056c6f676f735180a4bf07000000001976a91452668d450b08e868d520605f8e891c34e3a9f95f88ac809698000000000017a914b6c79031b71d86ab0d617e1e1e706ec4ee34b07f8780969800000000001976a914b8ae1c47effb58f72f7bca819fe7fc252f9e852e88ac80969800000000001976a914b50b86a893d80c9e2ee72b199612374b7b4c1cd888ac80969800000000001976a914da76a31b6760dcb90aa469c15965da6e80096e4588ac80969800000000001976a9141325d2d8ba6e8c7d99ff66d21530917cc73429d288ac80969800000000001976a9146a171891ab9443020bd2755ef79c6e59efc5926588ac80969800000000001976a91419e8d8d0edab6ec43f04b656bff72af78d63ff6588ac80969800000000001976a914c6492d4e44dcd0051e60a8add6af02b2f291b2aa88ac80969800000000001976a914b5aeafec9f2972110c4c6af9508a3c41e1d3c73b88ac80969800000000001976a9147c28aa91b93faf8aee0a6520a0a83f42dbc4a45b88ac80969800000000001976a914b18eb08c4978e73480743b1598061d3cf38e10a888ac80969800000000001976a9147d0893d1a278bab27e7ad92ed88bd7dceafd83a588ac80969800000000001976a9144b869f9a55c57003df178bdc801184109d904f8b88ac00000000';
      var x = Block.fromBuffer(networkBlock);
      x.toBuffer().toString('hex').should.equal(networkBlock);
    });

  });

  describe('#fromBufferReader', function () {

    it('should make a block from this known buffer', function () {
      var block = Block.fromBufferReader(BufferReader(blockbuf));
      block.toBuffer().toString('hex').should.equal(blockhex);
    });

  });

  describe('#toBuffer', function () {

    it('should recover a block from this known buffer', function () {
      var block = Block.fromBuffer(blockbuf);
      block.toBuffer().toString('hex').should.equal(blockhex);
    });

  });

  describe('#toBufferWriter', function () {

    it('should recover a block from this known buffer', function () {
      var block = Block.fromBuffer(blockbuf);
      block.toBufferWriter().concat().toString('hex').should.equal(blockhex);
    });

    it('doesn\'t create a bufferWriter if one provided', function () {
      var writer = new BufferWriter();
      var block = Block.fromBuffer(blockbuf);
      block.toBufferWriter(writer).should.equal(writer);
    });

  });

  describe('#toObject', function () {

    it('should recover a block from genesis block buffer', function () {
      var block = Block.fromBuffer(blockOneBuf);
      block.id.should.equal(blockOneId);
      block.toObject().should.deep.equal({
        header: {
          hash: '00000000090ac785b348fc296a84ec2e45ee5fed25419a8557d868152c880049',
          version: 1,
          size: 706,
          reserved: 0,
          height: 1,
          prevHash: '000000000abc0cde58ee7e919d3d4de183e6844add1fd5d14b4eac89d958f470',
          merkleRoot: 'e9eacf9ed8cc1cd77318d89eee97115895557ad64f25d3d1417911abc3a4c637',
          epochBlock: '0000000000000000000000000000000000000000000000000000000000000000',
          extendedMetadata: '9a538906e6466ebd2617d321f71bc94e56056ce213d366773699e28158e00614',
          time: 1624246276,
          bits: 470810624,
          nonce: "1415370310"
        },
        metadata: 0,
        transactions: [
          {
            "txid": "324ae664aeb1a060a99a6700f64b6a08204d7c4937dad5864f32c6e89c9f8e32",
            "hash": "b2864e420421a1d221924218b598e0afcf12488fa9873f9815c92b960a7008d5",
            "version": 2,
            "nLockTime": 0,
            "inputs": [
              {
                "prevTxId": "0000000000000000000000000000000000000000000000000000000000000000",
                "outputIndex": 4294967295,
                "script": "0000",
                "sequenceNumber": 4294967295
              }
            ],
            "outputs": [
              {
                "satoshis": 0,
                "script": "6a056c6f676f7351",
              },
              {
                "satoshis": 130000000,
                "script": "76a91452668d450b08e868d520605f8e891c34e3a9f95f88ac",
              },
              {
                "satoshis": 10000000,
                "script": "a914b6c79031b71d86ab0d617e1e1e706ec4ee34b07f87"
              },
              {
                "satoshis": 10000000,
                "script": "76a914b8ae1c47effb58f72f7bca819fe7fc252f9e852e88ac"
              },
              {
                "satoshis": 10000000,
                "script": "76a914b50b86a893d80c9e2ee72b199612374b7b4c1cd888ac"
              },
              {
                "satoshis": 10000000,
                "script": "76a914da76a31b6760dcb90aa469c15965da6e80096e4588ac"
              },
              {
                "satoshis": 10000000,
                "script": "76a9141325d2d8ba6e8c7d99ff66d21530917cc73429d288ac"
              },
              {
                "satoshis": 10000000,
                "script": "76a9146a171891ab9443020bd2755ef79c6e59efc5926588ac"
              },
              {
                "satoshis": 10000000,
                "script": "76a91419e8d8d0edab6ec43f04b656bff72af78d63ff6588ac"
              },
              {
                "satoshis": 10000000,
                "script": "76a914c6492d4e44dcd0051e60a8add6af02b2f291b2aa88ac"
              },
              {
                "satoshis": 10000000,
                "script": "76a914b5aeafec9f2972110c4c6af9508a3c41e1d3c73b88ac"
              },
              {
                "satoshis": 10000000,
                "script": "76a9147c28aa91b93faf8aee0a6520a0a83f42dbc4a45b88ac"
              },
              {
                "satoshis": 10000000,
                "script": "76a914b18eb08c4978e73480743b1598061d3cf38e10a888ac"
              },
              {
                "satoshis": 10000000,
                "script": "76a9147d0893d1a278bab27e7ad92ed88bd7dceafd83a588ac"
              },
              {
                "satoshis": 10000000,
                "script": "76a9144b869f9a55c57003df178bdc801184109d904f8b88ac"
              }
            ]
          }
        ]
      });

      it('roundtrips correctly', function () {
        var block = Block.fromBuffer(blockOneBuf);
        var obj = block.toObject();
        var block2 = Block.fromObject(obj);
        block2.toObject().should.deep.equal(block.toObject());
      });

    });

    describe('#_getHash', function () {

      it('should return the correct hash of the genesis block', function () {
        var block = Block.fromBuffer(genesisbuf);
        var blockhash = Buffer.from(Array.apply([], Buffer.from(genesisidhex, 'hex')).reverse());
        block._getHash().toString('hex').should.equal(blockhash.toString('hex'));
      });
    });

    describe('#id', function () {

      it('should return the correct id of the genesis block', function () {
        var block = Block.fromBuffer(genesisbuf);
        block.id.should.equal(genesisidhex);
      });
      it('"hash" should be the same as "id"', function () {
        var block = Block.fromBuffer(genesisbuf);
        block.id.should.equal(block.hash);
      });

    });

    describe('#inspect', function () {

      it('should return the correct inspect of the genesis block', function () {
        var block = Block.fromBuffer(genesisbuf);
        block.inspect().should.equal('<Block ' + genesisidhex + '>');
      });

    });

    describe('#merkleRoot', function () {

      it('should describe as valid merkle root', function () {
        var x = Block.fromRawBlock(dataRawBlockBinary);
        var valid = x.validMerkleRoot();
        valid.should.equal(true);
      });

      it('should describe as invalid merkle root', function () {
        var x = Block.fromRawBlock(dataRawBlockBinary);
        x.transactions.push(new Transaction());
        var valid = x.validMerkleRoot();
        valid.should.equal(false);
      });

      it('should get a null hash merkle root', function () {
        var x = Block.fromRawBlock(dataRawBlockBinary);
        x.transactions = []; // empty the txs
        var mr = x.getMerkleRoot();
        mr.should.deep.equal(Block.Values.NULL_HASH);
      });

    });

  });
})
