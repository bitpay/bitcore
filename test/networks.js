'use strict';

var expect = require('chai').expect;
var should = require('chai').should();
var bitcore = require('..');
var networks = bitcore.Networks;

describe('Networks', function() {

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
      xpubkey:  0x0278b20e,
      xprivkey: 0x0278ade4,
      networkMagic: 0xe7beb4d4,
      port: 20001,
      dnsSeeds: [
        'localhost',
        'mynet.localhost'
      ]
    };
    networks.add(custom);
    var customnet = networks.get('customnet');
    for (var key in custom) {
      if (key !== 'networkMagic') {
        customnet[key].should.equal(custom[key]);
      } else {
        var expected = new Buffer('e7beb4d4', 'hex');
        customnet[key].should.deep.equal(expected);
      }
    }
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

  it('converts to string using the "name" property', function() {
    networks.livenet.toString().should.equal('livenet');
  });

});
