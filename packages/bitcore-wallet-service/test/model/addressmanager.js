'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var { AddressManager } = require('../../ts_build/lib/model/addressmanager');


describe('AddressManager', function() {
  describe('#create', function() {
    it('should create BIP45 address manager by default', function() {
      var am = AddressManager.create();
      am.derivationStrategy.should.equal('BIP45');
    });
  });
  describe('#fromObj', function() {
    it('should assume legacy address manager uses BIP45', function() {
      var obj = {
        version: '1.0.0',
        receiveAddressIndex: 2,
        changeAddressIndex: 0,
        copayerIndex: 4
      };
      var am = AddressManager.fromObj(obj);
      am.derivationStrategy.should.equal('BIP45');
      am.getCurrentAddressPath(false).should.equal('m/4/0/2');
    });
  });
  describe('#supportsCopayerBranches', function() {
    it('should return true for BIP45 & false for BIP44', function() {
      AddressManager.supportsCopayerBranches('BIP45').should.be.true;
      AddressManager.supportsCopayerBranches('BIP44').should.be.false;
    });
  });
  describe('BIP45', function() {
    describe('#getCurrentAddressPath', function() {
      it('should return a valid BIP32 path for given index', function() {
        var am = AddressManager.create({
          copayerIndex: 4,
        });
        am.getCurrentAddressPath(false).should.equal('m/4/0/0');
        am.getCurrentAddressPath(true).should.equal('m/4/1/0');
      });
    });
    it('should return a valid BIP32 path for defaut Index', function() {
      var am = AddressManager.create({});
      am.getCurrentAddressPath(false).should.equal('m/2147483647/0/0');
      am.getCurrentAddressPath(true).should.equal('m/2147483647/1/0');
    });
    describe('#getNewAddressPath', function() {
      it('should return a new valid BIP32 path for given index', function() {
        var am = AddressManager.create({
          copayerIndex: 2,
        });
        am.getNewAddressPath(false).should.equal('m/2/0/0');
        am.getNewAddressPath(true).should.equal('m/2/1/0');
        am.getNewAddressPath(false).should.equal('m/2/0/1');
        am.getNewAddressPath(true).should.equal('m/2/1/1');
      });
    });
    describe('#rewindIndex', function() {
      it('should rewind main index', function() {
        var am = AddressManager.create({});
        am.getNewAddressPath(false).should.equal('m/2147483647/0/0');
        am.getNewAddressPath(false).should.equal('m/2147483647/0/1');
        am.getNewAddressPath(false).should.equal('m/2147483647/0/2');
        am.rewindIndex(false, 2);
        am.getNewAddressPath(false).should.equal('m/2147483647/0/1');
      });
      it('should rewind change index', function() {
        var am = AddressManager.create({});
        am.getNewAddressPath(true).should.equal('m/2147483647/1/0');
        am.rewindIndex(false, 1);
        am.getNewAddressPath(true).should.equal('m/2147483647/1/1');
        am.rewindIndex(true, 2);
        am.getNewAddressPath(true).should.equal('m/2147483647/1/0');
      });
      it('should stop at 0', function() {
        var am = AddressManager.create({});
        am.getNewAddressPath(false).should.equal('m/2147483647/0/0');
        am.rewindIndex(false, 20);
        am.getNewAddressPath(false).should.equal('m/2147483647/0/0');
      });
    });
  });
  describe('BIP44', function() {
    describe('#getCurrentAddressPath', function() {
      it('should return first address path', function() {
        var am = AddressManager.create({
          derivationStrategy: 'BIP44',
        });
        am.getCurrentAddressPath(false).should.equal('m/0/0');
        am.getCurrentAddressPath(true).should.equal('m/1/0');
      });
      it('should return address path independently of copayerIndex', function() {
        var am = AddressManager.create({
          derivationStrategy: 'BIP44',
          copayerIndex: 4,
        });
        am.getCurrentAddressPath(false).should.equal('m/0/0');
        am.getCurrentAddressPath(true).should.equal('m/1/0');
      });
    });
    describe('#getNewAddressPath', function() {
      it('should return a new path', function() {
        var am = AddressManager.create({
          derivationStrategy: 'BIP44',
        });
        am.getNewAddressPath(false).should.equal('m/0/0');
        am.getNewAddressPath(true).should.equal('m/1/0');
        am.getNewAddressPath(false).should.equal('m/0/1');
        am.getNewAddressPath(true).should.equal('m/1/1');
      });
    });
    describe('#rewindIndex', function() {
      it('should rewind main index', function() {
        var am = AddressManager.create({
          derivationStrategy: 'BIP44',
        });
        am.getNewAddressPath(false).should.equal('m/0/0');
        am.getNewAddressPath(false).should.equal('m/0/1');
        am.getNewAddressPath(false).should.equal('m/0/2');
        am.rewindIndex(false, 2);
        am.getNewAddressPath(false).should.equal('m/0/1');
      });
      it('should rewind change index', function() {
        var am = AddressManager.create({
          derivationStrategy: 'BIP44',
        });
        am.getNewAddressPath(true).should.equal('m/1/0');
        am.rewindIndex(false, 1);
        am.getNewAddressPath(true).should.equal('m/1/1');
        am.rewindIndex(true, 2);
        am.getNewAddressPath(true).should.equal('m/1/0');
      });
      it('should stop at 0', function() {
        var am = AddressManager.create({
          derivationStrategy: 'BIP44',
        });
        am.getNewAddressPath(false).should.equal('m/0/0');
        am.rewindIndex(false, 20);
        am.getNewAddressPath(false).should.equal('m/0/0');
      });
    });
  });
});
