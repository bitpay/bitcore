'use strict';

var should = require('chai').should();
var P2P = require('../../');
var builder = P2P.Messages.builder;
var bitcore = require('bitcore');

describe('Messages Builder', function() {

  describe('@constructor', function() {

    it('should return commands based on default', function() {
      // instantiate
      var b = builder();
      should.exist(b);
    });

    it('should return commands with customizations', function() {
      // instantiate
      var b = builder({
        magicNumber: 0xd9b4bef9,
        Block: bitcore.Block,
        Transaction: bitcore.Transaction
      });
      should.exist(b);
    });

  });

});
