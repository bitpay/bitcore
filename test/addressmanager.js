'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var AddressManager = require('../lib/model/addressmanager');


describe('AddressManager', function() {
  describe('#getCurrentAddressPath', function() {
    it('should return a valid BIP32 path for given index', function() {
      var am = AddressManager.create({
        copayerIndex: 4
      });
      am.getCurrentAddressPath(false).should.equal('m/4/0/0');
      am.getCurrentAddressPath(true).should.equal('m/4/1/0');
    });
  });
  describe('#getCurrentAddressPath', function() {
    it('should return a valid BIP32 path for defaut Index', function() {
      var am = AddressManager.create();
      am.getCurrentAddressPath(false).should.equal('m/2147483647/0/0');
      am.getCurrentAddressPath(true).should.equal('m/2147483647/1/0');
    });
  });
  describe('#getNewAddressPath', function() {
    it('should return a new valid BIP32 path for given index', function() {
      var am = AddressManager.create({
        copayerIndex: 2
      });
      am.getNewAddressPath(false).should.equal('m/2/0/0');
      am.getNewAddressPath(true).should.equal('m/2/1/0');
    });
  });
});
