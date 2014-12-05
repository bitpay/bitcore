'use strict';

var chai = require('chai');
var bitcore = require('../..');

var should = chai.should();

var PeerManager = bitcore.transport.PeerManager;

describe('PeerManager', function() {
  it('should be able to create class', function() {
    should.exist(PeerManager);
  });

  it('should be able to create instance', function() {
    var pm = new PeerManager();
    should.exist(pm);
  });

  it('should be able to start instance', function() {
    var pm = new PeerManager();
    pm.start.bind(pm).should.not.throw();
  });

  it('should be able to stop instance', function() {
    var pm = new PeerManager();
    pm.start();
    pm.stop.bind(pm).should.not.throw();
  });

  it('should extend default config with passed config', function() {
    var pm = new PeerManager({ 
      proxy: { 
        host: 'localhost', 
        port: 9050 
      } 
    });

    should.exist(pm.config.network);
    should.exist(pm.config.proxy);
  });
});
