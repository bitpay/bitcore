'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var Copayer = require('../lib/model/copayer');


describe('Copayer', function() {

  describe('#getCurrentAddressPath', function() {
    it('return a valid BIP32 path for defaut copayer Index', function() {
      var c = new Copayer();
      c.getCurrentAddressPath(false).should.equal('m/45\'/0/0/0');
      c.getCurrentAddressPath(true).should.equal('m/45\'/0/1/0');
    });

    it('return a valid BIP32 path for given index', function() {
      var c = new Copayer({
        copayerIndex: 4
      });
      c.getCurrentAddressPath(false).should.equal('m/45\'/4/0/0');
      c.getCurrentAddressPath(true).should.equal('m/45\'/4/1/0');
    });
  });

});
