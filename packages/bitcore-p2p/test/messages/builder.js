'use strict';

const should = require('chai').should();
const P2P = require('../../');
const bitcore = require('@bitpay-labs/bitcore-lib');

const builder = P2P.Messages.builder;

describe('Messages Builder', function() {

  describe('@constructor', function() {

    it('should return commands based on default', function() {
      // instantiate
      const b = builder();
      should.exist(b);
    });

    it('should return commands with customizations', function() {
      // instantiate
      const b = builder({
        network: bitcore.Networks.testnet,
        Block: bitcore.Block,
        Transaction: bitcore.Transaction
      });
      should.exist(b);
    });

  });

});
