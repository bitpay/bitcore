'use strict';

const bitcore = require('../..');
const BN = require('../../lib/crypto/bn');
const BufferReader = bitcore.encoding.BufferReader;
const BufferWriter = bitcore.encoding.BufferWriter;

const BlockHeader = bitcore.BlockHeader;
const fs = require('fs');
const should = require('chai').should();

// Read from blkxxxxx.dat files
const genesisMetaHeader = Buffer.from([251, 192, 182, 219, 24, 1, 0, 0]); // Prod
const metaHeader = Buffer.from([253, 210, 200, 241, 124, 16, 0, 0]); // Testnet

const genesisBlockHex = '010000000000000000000000000000000000000000000000000000000000000000000000d9ced4ed1130f7b7faad9be25323ffafa33232a17c3edf6cfd97bee6bafbdd97b9aa8e4ef0ff0f1ecd513f7c0101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4804ffff001d0104404e592054696d65732030352f4f63742f32303131205374657665204a6f62732c204170706c65e280997320566973696f6e6172792c2044696573206174203536ffffffff0100f2052a010000004341040184710fa689ad5023690c80f3a49c8f13f8d45b8c857fbcbc8bc4a8e4d3eb4b10f4d4604fa08dce601aaf0f470216fe1b51850b4acf21b179c45070ac7b03a9ac00000000';
const rawGenesisBlock = Buffer.concat([genesisMetaHeader, Buffer.from(genesisBlockHex, 'hex')]);
const genesisBlockId = '12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2';


// https://bitpay.com/insight/#/LTC/testnet/block/07aef8bc5826099057d229b05e1628934bcececb6491d996d2f599ac763d1302
const blockHex = '00000020e59195311c30c9ddbee139847c201c1a7b206d6450a4776731089dd315d620b33a3bd83993332fadbd0bde0316da5829d5cb63090815e9541b4fab7b67a8215245576e60ffff0f1e00001a1d06010000000001010000000000000000000000000000000000000000000000000000000000000000ffffffff3103ff521c2cfabe6d6d798c2a708fef56140d1adbc0a36d2b0823c6854692bae8c0de03b3b34c6a39f30100000000000000ffffffff040000000000000000266a24aa21a9ed1067bc22ca763761a2d33cd31c7be27306966d24ccf783572e436dc3a4a756e9c1bc814a000000001976a914a6963d77623cd9ebeb584a7bcfda8089d63a4f8e88ac0100000000000000434104ffd03de44a6e11b9917f3a29f9443283d9871c9d743ef30d5eddcd37094b64d1b3d8090496b53256786bf5c82932ec23c3b74d9f05a6f95a8b5529352656664bac00000000000000002a6a28a05748f972fa31d59d34044b0cf62f799270cc27db4b4f9eb31dabfb16375710000000000000000001205b5032506f6f6c5d5b5032506f6f6c5d5b5032506f6f6c5d5b5032506f6f6c5d00000000020000000001073f20cb3cb1ce1c21234a1070860655fff64312eb1290a8709ac8a457e1ae0a5f020000006a4730440220516815099a259f34e061a4121cf734effede5a1221d11c481c8d9e6a5549b82002206f248e5731d9dcba7453c4ee3699b7a4793a82450fc92ffe72d31620242ae5350121021708325e00c5d1c29520d8a0e507e4dd006ea89d6e1028c04fbeace45bc2b35ffeffffff1b3d0559da6dad21655c79733cb2a7ff377e30d2daf6344d5ce94c7687cd27d9010000006a47304402204fa03677adcc963f5cf223a0355f443fde75b2d0b5043224bbe8d4c4e458e89802205d7b2692c84adba57a8deaacaf46953eeba393a75d0cdcdbe9ba2ce7d3fc494401210252c357274b1643ea6d9991636e691ce63a51220b40ea0eb62c520a2ba05f1114feffffff4a1902314517fcf93f3eecc534dff422b2206eb1c5ab32f7fc8fe44c8cba94d90400000017160014beb3fe1ac70251e4a3ced415aafeeffe6af3b1e5feffffffd1ef3bfc27466d88304dd24c4b9f6e2cc67b19f8d2e807959d30720b3bde33ea020000006a4730440220603d946b8198819d27d3607d5540c3b023e0c2f01d583353860e5cf673e681a20220349c5ae6533802b729678cc4f192748847cc446400f344ba37e7f18eaf376dd1012103a70136ca81a8b7341627c01e2c690817829af0d1a50955cdd532890dbab5d10dfeffffff6df71ba6c43e3e3a061675925efc9154172770c157b2a683a14ccd42e26ef7f2020000006a473044022028aa1610a77e76ef67765be1497c6464be873ae06b10fa5bb6283c9c533f3e8d02204e93897dc9f11b8c447c478adaee84f71084a027428b1ced7206dd76c8b5ead00121021708325e00c5d1c29520d8a0e507e4dd006ea89d6e1028c04fbeace45bc2b35ffeffffff1b3d0559da6dad21655c79733cb2a7ff377e30d2daf6344d5ce94c7687cd27d9000000006a4730440220712c4ea983ff67e7784238b82e220bb5ff92572f881b1eea85578a4ceb8e6d290220315fe4aa130c80ceecacd9c6e0a13cea2cc566abc2bef4783ac2f1e057f307bb012103a70136ca81a8b7341627c01e2c690817829af0d1a50955cdd532890dbab5d10dfeffffffad53d38fd3b28d4e2f8655c24c7867d3ece271d288200f45b811330570f744e2010000006a4730440220515fa3b2d53a1e50bc45bbb8ae07eaa8f0304a2dc0bca68e12635dee64c1546902206dfcdece891197a1da685bb301b9ffb162c3360ce7fe520e67d0287de41573930121039908ba12bf2c5c4fd7e37a2461b9fd55a36a309dcc25e69dae66852ece047276feffffff06cea70100000000001976a914f7d2e576639fc44344a73f64411c4f61fb0d858688ac689a0100000000001976a914b32cc47540544e4aa94c23bddc9c42284ea0df4888ac3aa50100000000001976a914bacb466c709cfd0af0b8a575d5022572f4937f8a88acb43210000000000017a9147f79d6c60dba5e0584b9a3df29c27629b549473c876d9d0100000000001976a91434e08da0889d977437fff7553e5a32004a3e2f1e88acba910100000000001976a9142306df3129eebb4ef44dc4a677c90187e7a26f3988ac000002473044022006662907aa14984ee494133f26a926eb80949261003fd2e91ab736eef3eb3edf0220529f281e93bce9f96b35ee794f2c4b7290d8379a50d1a4979091feedd9c68ab6012103058ab07f4342efbe5e71d91a5f83cc094f7254928c00aba408b02d3daa53bc5200000000fe521c0002000000000101ad53d38fd3b28d4e2f8655c24c7867d3ece271d288200f45b811330570f744e203000000171600143f05231dea1caba1f39faa852ee01975143cf017feffffff06be990100000000001976a914aa96a55e1bbbbfe426639e84f7cb5fbe0a95aeab88ac09a20100000000001976a9148f535a63d7e45f98b62042ef6c4be3565c3ba3d388ac69890f000000000017a914fd40a6b9a447e8f93be226f92eab49c63c4f6bcc87bfa80100000000001976a91472c1e50b7c762678092f53f8d99fa555b122531c88ac37950100000000001976a9147d61748d306421a53ebdf9000c3e855254c2d92388aca2ad0100000000001976a9143db645a223d02ecc67738b00377a0b92f90562eb88ac0247304402203efad34fb22da1bfd6a6af76f0d17ab8b18b5ea620350dd60c19bbeaceaaf1cd022057a4657b243890b58e27ea99fbb3f5efbc006458fae5a944f3e3300d0c0fa1ea012102c1c25940229f7d2b0c8aa409d0f2024481e754598673ae9c2554817729a3d4cefe521c00020000000001012d9a2a693a86eee545ff9e21cd843ec36b81200e00dfd826fc99a0b4a60ad32b0100000017160014b1ad8cc7e5bbe2ce724a86c91b95fb46cae4cef0ffffffff03102700000000000017a9147f5b40a96045b7a356c42b72af447e013b7c9ab187687bd9040000000017a914c088359f4acfd22211af6db5f172b11105d30d72870000000000000000536a4c507688457c42f44708a62d8268f19477e5483f8dcf05c7e5c5597bbdc3f6f699bc3adcfc073cd4fd3d57fc1121ad08884128086dcf2c5aa162123ff39404ee24c6a1090d1c240fee8fdcddd81cff3cb509024730440220093ff1d229f3f5babfe12b90adb20d6aa20282599971180247c5bded4b0f3dc802206289822b7a76eed66d652a4efd6dcb6e6e86d435c8ac061cc14765f5fb4a0c9f01210324f6822cd6092cc444dcd7390e3f32783c44585c1e98ec85fd493d14eeefc0f800000000010000000001027730ea1d40fc75b67f70c6dee9bbdb294d63de2347a92e5c4f608e902e245f410100000023220020bad0dceb70d4bc3650a8c1b65be84e53e74e38729336a71327d87a88caeda02dffffffffe5e9459d74ba0479c31dd8365bd28379127509d04d80523271e28b3f9c6c678b0100000023220020bad0dceb70d4bc3650a8c1b65be84e53e74e38729336a71327d87a88caeda02dffffffff02a0032b0e0000000017a914e8736004f64ade3696ada2fedbf7e4165a0c6e5c87ceab34000000000017a9147e957984b1e8c2dabe84f1d40b0b9015ad5b8675870400483045022100cc048e642d6f82cf7a78fb898adb80a5e50b978f3bf43595b8e495b2e51bcc60022070f0b474001a878c02625cd0ccc18abf77cbe4122499089991da4365dfbe902e01483045022100bda9d7795b4da12fe2f28dedd27c561019e589470b2990ea4e9696879f2200080220520128a95d66c3f72841c3f452fdbd2b843356585810ecdb0e457986adb794d00169522102cd7fa4dfbf4e109c8c44ce014effcfe2463abdea8f8c280ed71e8a37d7e485f62102e05ae05499d90195fe485695216023c67bea7c3fb09873d208d7816d2f1602b42103cbb1d3e332a48223bacea02f129efb4b711c414af205f5410f26534983e2e0f353ae0400483045022100b47878e639ba86d3ed31486c5e0a949174d5071b4c1978dcfb501c916892e26c022071b541477ed4dcc41fc5635745253ce205af95291065861ca1029749d4dac5d001483045022100ef0fd55f28a5471087cab671db1f920d2a38570d936aedb29f26246913f62d8a022077366a581c1f51c7ccca91123031d6cf2fd9ffa3fcc3b8001cf5740d80433a360169522102cd7fa4dfbf4e109c8c44ce014effcfe2463abdea8f8c280ed71e8a37d7e485f62102e05ae05499d90195fe485695216023c67bea7c3fb09873d208d7816d2f1602b42103cbb1d3e332a48223bacea02f129efb4b711c414af205f5410f26534983e2e0f353ae0000000001000000000103ad5fc3b86bc8996ecb8b1f1ce452129ec58bb2dffed7e4a4aa1d30f1e29627d4010000002322002070fb03ab540065ab480bbef95807bdee43f2c7d6bcecfa7d05577295b1b402b3ffffffff1e03339595194969dda08287ff4cd1ccabad3efb332590adbc9c35e6dde83385000000002322002070fb03ab540065ab480bbef95807bdee43f2c7d6bcecfa7d05577295b1b402b3ffffffffb31a4c4806d0dc6389c73158165bba36a4351e66aaa1d5952b474e3ee3090c620100000023220020876860bb3bddcb16992640f487379c2c44b40c5dfae48bf7e3acbf1904f1a82effffffff02409c71020000000017a914e8736004f64ade3696ada2fedbf7e4165a0c6e5c87423600000000000017a914280761d4ac795473244ba573414684f1c4f7a0478704004730440220258b275fcbe3803f6f0e3ee2c1659441876a8a3c532727f961280dc2287da9c0022072d7242f1bf5f9c592e9fe9933043a7166ed94f452b1e1127aa79ad72938064601483045022100eea41ffbbc8af651ccdec9d752212bafaa55e451200d356afac811991368cfd30220594923da45a74b047a6da71eab35cb84883cad9a7f65458f06c6d7f4d3ef2b9a016952210226ca8fb07e59b0cec7cae86d7b5dedeb93779e27fd088a0e8a490cdb620ee0062102bc52fabcc79d06229919401d0ad2f4fe4ee6c3deffa96eff4a7d39641a19d36721038ffc7401d1332e79a472f011004046acbd9c0735cbdc07f65c1ccb13a398597853ae0400473044022053b61e4177776beefd4596b9a01e2f786740643cd7fa09977df9fd085276c8f302201b003dbc5ea0a11cede26ee5d71b7dbdccea094ae1a35472e193546636739d980147304402207e3c55a15865d7634f8e1a699c33571ba9f9086670d3010e3b026563e67f65de0220032daf81887fa69a76bc4aa8098695746e421ab4a4338d5124547c1bba1b29e2016952210226ca8fb07e59b0cec7cae86d7b5dedeb93779e27fd088a0e8a490cdb620ee0062102bc52fabcc79d06229919401d0ad2f4fe4ee6c3deffa96eff4a7d39641a19d36721038ffc7401d1332e79a472f011004046acbd9c0735cbdc07f65c1ccb13a398597853ae04004730440220018e315708aa05da37d6104a39ecb02bb5b92d9fc304bd311b7574c30e146662022028a3f06f579579d5ee43611ec4909503af5f8c9ac39738190d78c0bee6f784260148304502210080a64520ca8d4cf5c532c095d5f34c6c4c80251db296cf6441e73260b9f8142402205e1d377e91ecaba506edc9fc020fb863d261a4f443025f596ead93da5ad5269f016952210304da432e8d5e26dddb3451480f0a0daef0caf7ac63779d282822b8ea051a51ec21030d96875baa67187d59ae321037052cb560a57b2c821597b0ebdee1b4572b261c2103cde6820e8005b45b5c8b794668825180ca3851353d1a9b1c84257805e385589d53ae00000000';
const rawBlock = Buffer.concat([metaHeader, Buffer.from(blockHex, 'hex')]);
const blockId = '07aef8bc5826099057d229b05e1628934bcececb6491d996d2f599ac763d1302';
const data = require('../data/blk1856255-testnet');

describe('BlockHeader', function() {

  var version = data.version;
  var prevblockidbuf = Buffer.from(data.prevblockidhex, 'hex');
  var merklerootbuf = Buffer.from(data.merkleroothex, 'hex');
  var time = data.time;
  var bits = data.bits;
  var nonce = data.nonce;
  var bh = new BlockHeader({
    version: version,
    prevHash: prevblockidbuf,
    merkleRoot: merklerootbuf,
    time: time,
    bits: bits,
    nonce: nonce
  });
  var b = bitcore.Block.fromString(blockHex);
  var bhhex = b.header.toString();
  var bhbuf = Buffer.from(bhhex, 'hex');

  it('should make a new blockheader', function() {
    BlockHeader(bhbuf).toBuffer().toString('hex').should.equal(bhhex);
  });

  it('should not make an empty block', function() {
    (function() {
      BlockHeader();
    }).should.throw('Unrecognized argument for BlockHeader');
  });

  describe('#constructor', function() {

    it('should set all the variables', function() {
      var bh = new BlockHeader({
        version: version,
        prevHash: prevblockidbuf,
        merkleRoot: merklerootbuf,
        time: time,
        bits: bits,
        nonce: nonce
      });
      should.exist(bh.version);
      should.exist(bh.prevHash);
      should.exist(bh.merkleRoot);
      should.exist(bh.time);
      should.exist(bh.bits);
      should.exist(bh.nonce);
    });

    it('will throw an error if the argument object hash property doesn\'t match', function() {
      (function() {
        var bh = new BlockHeader({
          hash: '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f',
          version: version,
          prevHash: prevblockidbuf,
          merkleRoot: merklerootbuf,
          time: time,
          bits: bits,
          nonce: nonce
        });
      }).should.throw('Argument object hash property does not match block hash.');
    });

  });

  describe('version', function() {
    it('is interpreted as an int32le', function() {
      var hex = 'ffffffff00000000000000000000000000000000000000000000000000000000000000004141414141414141414141414141414141414141414141414141414141414141010000000200000003000000';
      var header = BlockHeader.fromBuffer(Buffer.from(hex, 'hex'));
      header.version.should.equal(-1);
      header.timestamp.should.equal(1);
    });
  });

  
  describe('#fromObject', function() {

    it('should set all the variables', function() {
      var bh = BlockHeader.fromObject({
        version: version,
        prevHash: prevblockidbuf.toString('hex'),
        merkleRoot: merklerootbuf.toString('hex'),
        time: time,
        bits: bits,
        nonce: nonce
      });
      should.exist(bh.version);
      should.exist(bh.prevHash);
      should.exist(bh.merkleRoot);
      should.exist(bh.time);
      should.exist(bh.bits);
      should.exist(bh.nonce);
    });

  });

  describe('#toJSON', function() {

    it('should set all the variables', function() {
      var json = bh.toJSON();
      should.exist(json.version);
      should.exist(json.prevHash);
      should.exist(json.merkleRoot);
      should.exist(json.time);
      should.exist(json.bits);
      should.exist(json.nonce);
    });

  });

  describe('#fromJSON', function() {

    it('should parse this known json string', function() {

      var jsonString = JSON.stringify({
        version: version,
        prevHash: prevblockidbuf,
        merkleRoot: merklerootbuf,
        time: time,
        bits: bits,
        nonce: nonce
      });

      var json = new BlockHeader(JSON.parse(jsonString));
      should.exist(json.version);
      should.exist(json.prevHash);
      should.exist(json.merkleRoot);
      should.exist(json.time);
      should.exist(json.bits);
      should.exist(json.nonce);
    });

  });

  describe('#fromString/#toString', function() {

    it('should output/input a block hex string', function() {
      var b = BlockHeader.fromString(bhhex);
      b.toString().should.equal(bhhex);
    });

  });

  describe('#fromBuffer', function() {

    it('should parse this known buffer', function() {
      BlockHeader.fromBuffer(bhbuf).toBuffer().toString('hex').should.equal(bhhex);
    });

  });

  describe('#fromBufferReader', function() {

    it('should parse this known buffer', function() {
      BlockHeader.fromBufferReader(BufferReader(bhbuf)).toBuffer().toString('hex').should.equal(bhhex);
    });

  });

  describe('#toBuffer', function() {

    it('should output this known buffer', function() {
      BlockHeader.fromBuffer(bhbuf).toBuffer().toString('hex').should.equal(bhhex);
    });

  });

  describe('#toBufferWriter', function() {

    it('should output this known buffer', function() {
      BlockHeader.fromBuffer(bhbuf).toBufferWriter().concat().toString('hex').should.equal(bhhex);
    });

    it('doesn\'t create a bufferWriter if one provided', function() {
      var writer = new BufferWriter();
      var blockHeader = BlockHeader.fromBuffer(bhbuf);
      blockHeader.toBufferWriter(writer).should.equal(writer);
    });

  });

  describe('#inspect', function() {

    it('should return the correct inspect of the genesis block', function() {
      var block = BlockHeader.fromRawBlock(rawGenesisBlock);
      block.inspect().should.equal('<BlockHeader '+genesisBlockId+'>');
    });

    it('should return the correct inspect of testnet block 1856255', function() {
      var block = BlockHeader.fromRawBlock(rawBlock);
      block.inspect().should.equal('<BlockHeader '+blockId+'>');
    });

  });

  describe('#fromRawBlock', function() {

    it('should instantiate from a raw block binary', function() {
      var x = BlockHeader.fromRawBlock(rawBlock.toString('binary'));
      x.version.should.equal(data.version);
      x.bits.should.equal(data.bits);
    });

    it('should instantiate from raw block buffer', function() {
      var x = BlockHeader.fromRawBlock(rawBlock);
      x.version.should.equal(data.version);
      x.bits.should.equal(data.bits);
    });


    it('should instantiate from raw block with verification', function() {
      var x = BlockHeader.fromRawBlock(rawBlock, true);
      x.version.should.equal(data.version);
      x.bits.should.equal(data.bits);
    });

    it('should fail network verification from raw block', function() {
      const invalidMetaHeader = Buffer.from([255, 255, 255, 255, 0, 0, 0, 0]);
      const invalidRawBlock = Buffer.concat([invalidMetaHeader, Buffer.from(blockHex, 'hex')]);
      try {
        BlockHeader.fromRawBlock(invalidRawBlock, true);
      } catch (err) {
        err.message.should.equal('Invalid state: Block network is invalid');
      }
    });

  });

  describe('#validTimestamp', function() {

    var x = BlockHeader.fromRawBlock(rawBlock);

    it('should validate timestamp as true', function() {
      var valid = x.validTimestamp(x);
      valid.should.equal(true);
    });


    it('should validate timestamp as false', function() {
      x.time = Math.round(new Date().getTime() / 1000) + BlockHeader.Constants.MAX_TIME_OFFSET + 100;
      var valid = x.validTimestamp(x);
      valid.should.equal(false);
    });

  });

  describe('#validProofOfWork', function() {

    it('should validate proof-of-work as true', function() {
      var x = BlockHeader.fromRawBlock(rawBlock);
      var valid = x.validProofOfWork(x);
      valid.should.equal(true);

    });

    it('should validate proof of work as false because incorrect proof of work', function() {
      var x = BlockHeader.fromRawBlock(rawBlock);
      var nonce = x.nonce;
      x.nonce = 0;
      var valid = x.validProofOfWork(x);
      valid.should.equal(false);
      x.nonce = nonce;
    });

  });

  describe('#getDifficulty', function() {
    it('should get the correct difficulty for block 1856255', function() {
      var x = BlockHeader.fromRawBlock(rawBlock);
      x.bits.should.equal(0x1E0FFFFF);
      x.getDifficulty().should.equal(data.difficulty);
    });

    it('should get the correct difficulty for testnet block 552065', function() {
      var x = new BlockHeader({
        bits: 0x1d3fffc0
      });
      x.getDifficulty().should.equal(0.015625);
    });

    it('should get the correct difficulty for livenet block 373043', function() {
      var x = new BlockHeader({
        bits: 0x1b6767af
      });
      x.getDifficulty().should.equal(633.7700411303292);
    });

    it('should get the correct difficulty for livenet block 340000', function() {
      var x = new BlockHeader({
        bits: 0x1c00aec9
      });
      x.getDifficulty().should.equal(374.94602748910495);
    });

    it('should use exponent notation if difficulty is larger than Javascript number', function() {
      var x = new BlockHeader({
        bits: 0x0900c2a8
      });
      x.getDifficulty().should.equal(1.9220482782645836 * 1e48);
    });
  });

  it('coverage: caches the "_id" property', function() {
    var blockHeader = BlockHeader.fromRawBlock(rawBlock);
    blockHeader.id.should.equal(blockHeader.id);
  });

});
