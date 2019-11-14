'use strict';

var expect = require('chai').expect;
var should = require('chai').should();
var bitcore = require('..');
var networks = bitcore.Networks;

describe('Networks', function() {

  var customnet;

  it('should contain all Networks', function() {
    should.exist(networks.livenet);
    should.exist(networks.testnet);
    should.exist(networks.defaultNetwork);
  });

  it('should be able to define a custom Network', function() {
    var custom = {
      name: 'customnet',
      alias: 'mynet',
      pubkeyhash: 0x10,
      privatekey: 0x90,
      scripthash: 0x08,
      xpubkey: 0x0278b20e,
      xprivkey: 0x0278ade4,
      networkMagic: 0xe7beb4d4,
      port: 20001,
      dnsSeeds: [
        'localhost',
        'mynet.localhost'
      ]
    };
    networks.add(custom);
    customnet = networks.get('customnet');
    for (var key in custom) {
      if (key !== 'networkMagic') {
        customnet[key].should.equal(custom[key]);
      } else {
        var expected = Buffer.from('e7beb4d4', 'hex');
        customnet[key].should.deep.equal(expected);
      }
    }
  });

  it('should have network magic for testnet', function() {
    var testnet = networks.get('testnet');
    var buffUtil = require('../lib/util/buffer');
    buffUtil.isBuffer(testnet.networkMagic).should.equal(true);
  });

  it('can remove a custom network', function() {
    networks.remove(customnet);
    var net = networks.get('customnet');
    should.equal(net, undefined);
  });

  it('should not set a network map for an undefined value', function() {
    var custom = {
      name: 'somenet',
      pubkeyhash: 0x13,
      privatekey: 0x93,
      scripthash: 0x11,
      xpubkey: 0x0278b20f,
      xprivkey: 0x0278ade5,
      networkMagic: 0xe7beb4d5,
      port: 20008,
      dnsSeeds: [
        'somenet.localhost'
      ]
    };
    networks.add(custom);
    var network = networks.get(undefined);
    should.not.exist(network);
    var somenet = networks.get('somenet');
    should.exist(somenet);
    somenet.name.should.equal('somenet');
    networks.remove(somenet);
  });

  var constants = ['name', 'alias', 'pubkeyhash', 'scripthash', 'xpubkey', 'xprivkey'];

  constants.forEach(function(key){
    it('should have constant '+key+' for livenet and testnet', function(){
      networks.testnet.hasOwnProperty(key).should.equal(true);
      networks.livenet.hasOwnProperty(key).should.equal(true);
    });
  });

  it('tests only for the specified key', function() {
    expect(networks.get(0x6f, 'pubkeyhash')).to.equal(networks.testnet);
    expect(networks.get(0x6f, 'privatekey')).to.equal(undefined);
  });

  it('can test for multiple keys', function() {
    expect(networks.get(0x6f, ['pubkeyhash', 'scripthash'])).to.equal(networks.testnet);
    expect(networks.get(0xc4, ['pubkeyhash', 'scripthash'])).to.equal(networks.testnet);
    expect(networks.get(0x6f, ['privatekey', 'port'])).to.equal(undefined);
  });

  it('should have regtest network', function() {
    expect(networks.get('regtest').name).to.equal('regtest');
  });

  it('should have testnet network', function() {
    expect(networks.get('testnet').name).to.equal('testnet');
  });

  it('should have livenet network', function() {
    expect(networks.get('livenet').name).to.equal('livenet');
  });

  it('should have bchtest prefix', function() {
    expect(networks.get('testnet').prefix).to.equal('bchtest');
  });

  it('should have bchreg prefix', function() {
    expect(networks.get('regtest').prefix).to.equal('bchreg');
  });

  it('#DEPRECATED should not have bchreg prefix after enableRegtest is called', function() {
    var network = networks.get('testnet');
    networks.enableRegtest();
    expect(network.prefix).to.equal('bchtest');
  });

  it('should have bchtest prefix after disableRegtest is called', function() {
    var network = networks.get('testnet');
    networks.disableRegtest();
    expect(network.prefix).to.equal('bchtest');
  });


  it('converts to string using the "name" property', function() {
    networks.livenet.toString().should.equal('livenet');
  });

  it('network object should be immutable', function() {
    expect(networks.testnet.name).to.equal('testnet')
    var fn = function() { networks.testnet.name = 'livenet' }
    expect(fn).to.throw(TypeError)
  });

});
