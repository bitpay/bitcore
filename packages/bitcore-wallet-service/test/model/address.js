'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();

var { Address } = require('../../ts_build/lib/model/address');

describe('Address', function() {
  describe('#create', function() {
    it('should create livenet address', function() {
      var x = Address.create({
        address: '3KxttbKQQPWmpsnXZ3rB4mgJTuLnVR7frg',
        coin: 'btc',
        walletId: '123',
        isChange: false,
        path: 'm/0/1',
        publicKeys: ['123', '456'],
      });
      should.exist(x.createdOn);
      x.network.should.equal('livenet');
    });
    it('should create testnet address', function() {
      var x = Address.create({
        address: 'mp5xaa4uBj16DJt1fuA3D9fejHuCzeb7hj',
        coin: 'btc',
        walletId: '123',
        isChange: false,
        path: 'm/0/1',
        publicKeys: ['123', '456'],
      });
      x.network.should.equal('testnet');
    });
  });
  describe('#derive', function() {
    it('should derive multi-sig P2SH address', function() {
      var address = Address.derive('wallet-id', 'P2SH', [{
        xPubKey: 'xpub686v8eJUJEqxzAtkWPyQ9nvpBHfucVsB8Q8HQHw5mxYPQtBact2rmA8wRXFYaVESK8f7WrxeU4ayALaEhicdXCX5ZHktNeRFnvFeffztiY1'
        // PubKey(xPubKey/0/0) -> 03fe466ea829aa4c9a1c289f9ba61ebc26a61816500860c8d23f94aad9af152ecd
      }, {
        xPubKey: 'xpub68tpbrfk747AvDUCdtEUgK2yDPmtGKf7YXzEcUUqnF3jmAMeZgcpoZqgXwwoi8CpwDkyzVX6wxUktTw2wh9EhhVjh5S71MLL3FkZDGF5GeY'
        // PubKey(xPubKey/0/0) -> 03162179906dbe6a67979d4f8f46ee1db6ff81715f465e6615a4f5969478ad2171
      }], 'm/0/0', 1, 'btc', 'livenet', false);
      should.exist(address);
      address.walletId.should.equal('wallet-id');
      address.address.should.equal('3QN2CiSxcUsFuRxZJwXMNDQ2esnr5RXTvw');
      address.network.should.equal('livenet');
      address.isChange.should.be.false;
      address.path.should.equal('m/0/0');
      address.type.should.equal('P2SH');
    });
    it('should derive multi-sig P2WSH address', function() {
      var address = Address.derive('wallet-id', 'P2WSH', [{
        xPubKey: 'xpub686v8eJUJEqxzAtkWPyQ9nvpBHfucVsB8Q8HQHw5mxYPQtBact2rmA8wRXFYaVESK8f7WrxeU4ayALaEhicdXCX5ZHktNeRFnvFeffztiY1'
        // PubKey(xPubKey/0/0) -> 03fe466ea829aa4c9a1c289f9ba61ebc26a61816500860c8d23f94aad9af152ecd
      }, {
        xPubKey: 'xpub68tpbrfk747AvDUCdtEUgK2yDPmtGKf7YXzEcUUqnF3jmAMeZgcpoZqgXwwoi8CpwDkyzVX6wxUktTw2wh9EhhVjh5S71MLL3FkZDGF5GeY'
        // PubKey(xPubKey/0/0) -> 03162179906dbe6a67979d4f8f46ee1db6ff81715f465e6615a4f5969478ad2171
      }], 'm/0/0', 1, 'btc', 'livenet', false);
      should.exist(address);
      address.walletId.should.equal('wallet-id');
      address.address.should.equal('bc1qeg99m00dh3tl62dkaml5xma0kek2czwy65enlc7vnwgdddas9qks5se85m');
      address.network.should.equal('livenet');
      address.isChange.should.be.false;
      address.path.should.equal('m/0/0');
      address.type.should.equal('P2WSH');
    });
    it('should derive multi-sig P2WSH testnet address', function() {
      var address = Address.derive('wallet-id', 'P2WSH', [{
        xPubKey: 'xpub686v8eJUJEqxzAtkWPyQ9nvpBHfucVsB8Q8HQHw5mxYPQtBact2rmA8wRXFYaVESK8f7WrxeU4ayALaEhicdXCX5ZHktNeRFnvFeffztiY1'
        // PubKey(xPubKey/0/0) -> 03fe466ea829aa4c9a1c289f9ba61ebc26a61816500860c8d23f94aad9af152ecd
      }, {
        xPubKey: 'xpub68tpbrfk747AvDUCdtEUgK2yDPmtGKf7YXzEcUUqnF3jmAMeZgcpoZqgXwwoi8CpwDkyzVX6wxUktTw2wh9EhhVjh5S71MLL3FkZDGF5GeY'
        // PubKey(xPubKey/0/0) -> 03162179906dbe6a67979d4f8f46ee1db6ff81715f465e6615a4f5969478ad2171
      }], 'm/0/0', 1, 'btc', 'testnet', false);
      should.exist(address);
      address.walletId.should.equal('wallet-id');
      address.address.should.equal('tb1qeg99m00dh3tl62dkaml5xma0kek2czwy65enlc7vnwgdddas9qksrc0gw5');
      address.network.should.equal('testnet');
      address.isChange.should.be.false;
      address.path.should.equal('m/0/0');
      address.type.should.equal('P2WSH');
    });
    it('should derive 1-of-1 P2SH address', function() {
      var address = Address.derive('wallet-id', 'P2SH', [{
        xPubKey: 'xpub686v8eJUJEqxzAtkWPyQ9nvpBHfucVsB8Q8HQHw5mxYPQtBact2rmA8wRXFYaVESK8f7WrxeU4ayALaEhicdXCX5ZHktNeRFnvFeffztiY1'
        // PubKey(xPubKey/0/0) -> 03fe466ea829aa4c9a1c289f9ba61ebc26a61816500860c8d23f94aad9af152ecd
      }], 'm/0/0', 1, 'btc', 'livenet', false);
      should.exist(address);
      address.walletId.should.equal('wallet-id');
      address.address.should.equal('3BY4K8dfsHryhWh2MJ6XHxxsRfcvPAyseH');
      address.network.should.equal('livenet');
      address.isChange.should.be.false;
      address.path.should.equal('m/0/0');
      address.type.should.equal('P2SH');
    });
    it('should derive 1-of-1 P2PKH address', function() {
      var address = Address.derive('wallet-id', 'P2PKH', [{
        xPubKey: 'xpub686v8eJUJEqxzAtkWPyQ9nvpBHfucVsB8Q8HQHw5mxYPQtBact2rmA8wRXFYaVESK8f7WrxeU4ayALaEhicdXCX5ZHktNeRFnvFeffztiY1'
        // PubKey(xPubKey/1/2) -> 0232c09a6edd8e2189628132d530c038e0b15b414cf3984e532358cbcfb83a7bd7
      }], 'm/1/2', 1, 'btc', 'livenet', true);
      should.exist(address);
      address.walletId.should.equal('wallet-id');
      address.address.should.equal('1G4wgi9YzmSSwQaQVLXQ5HUVquQDgJf8oT');
      address.network.should.equal('livenet');
      address.isChange.should.be.true;
      address.path.should.equal('m/1/2');
      address.type.should.equal('P2PKH');
    });
    it('should derive 1-of-1 P2WPKH address', function() {
      var address = Address.derive('wallet-id', 'P2WPKH', [{
        xPubKey: 'xpub686v8eJUJEqxzAtkWPyQ9nvpBHfucVsB8Q8HQHw5mxYPQtBact2rmA8wRXFYaVESK8f7WrxeU4ayALaEhicdXCX5ZHktNeRFnvFeffztiY1'
      }], 'm/1/2', 1, 'btc', 'livenet', true);
      should.exist(address);
      address.walletId.should.equal('wallet-id');
      address.address.should.equal('bc1q54yvs7zxv7djqnxtlfpw9efw4kwlj7qzktnzzn');
      address.network.should.equal('livenet');
      address.isChange.should.be.true;
      address.path.should.equal('m/1/2');
      address.type.should.equal('P2WPKH');
    });
    it('should derive 1-of-1 P2WPKH testnet address', function() {
      var address = Address.derive('wallet-id', 'P2WPKH', [{
        xPubKey: 'xpub686v8eJUJEqxzAtkWPyQ9nvpBHfucVsB8Q8HQHw5mxYPQtBact2rmA8wRXFYaVESK8f7WrxeU4ayALaEhicdXCX5ZHktNeRFnvFeffztiY1'
      }], 'm/1/2', 1, 'btc', 'testnet', true);
      should.exist(address);
      address.walletId.should.equal('wallet-id');
      address.address.should.equal('tb1q54yvs7zxv7djqnxtlfpw9efw4kwlj7qzudg3eq');
      address.network.should.equal('testnet');
      address.isChange.should.be.true;
      address.path.should.equal('m/1/2');
      address.type.should.equal('P2WPKH');
    });
  });
});
