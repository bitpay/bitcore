'use strict';

var should = require('chai').should();
var bitcore = require('../');

describe('Library', function() {
  it('should export primatives', function() {
    should.exist(bitcore.crypto);
    should.exist(bitcore.encoding);
    should.exist(bitcore.util);
    should.exist(bitcore.errors);
    should.exist(bitcore.Address);
    should.exist(bitcore.Block);
    should.exist(bitcore.MerkleBlock);
    should.exist(bitcore.BlockHeader);
    should.exist(bitcore.HDPrivateKey);
    should.exist(bitcore.HDPublicKey);
    should.exist(bitcore.Networks);
    should.exist(bitcore.Opcode);
    should.exist(bitcore.PrivateKey);
    should.exist(bitcore.PublicKey);
    should.exist(bitcore.Script);
    should.exist(bitcore.Transaction);
    should.exist(bitcore.URI);
    should.exist(bitcore.Unit);
  });
});
