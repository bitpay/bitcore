'use strict';

var should =  require('chai').should();
var sinon = require('sinon');
var bitcore = require('bitcore');
var path = require('path');
var proxyquire = require('proxyquire');

describe('Bitcore Node Service', function() {

  describe('#start', function() {

    it('will create a log directory if it doesn\'t exist', function(done) {
      var node = {
        network: bitcore.Networks.testnet,
        datadir: './testdir',
        port: 3001
      };
      var mkdirpSync = sinon.stub();
      var Service = proxyquire('../bitcorenode', {
        fs: {
          existsSync: sinon.stub().returns(false),
          openSync: sinon.stub()
        },
        child_process: {
          spawn: sinon.stub()
        },
        mkdirp: {
          sync: mkdirpSync
        }
      });
      var node = {
        network: bitcore.Networks.testnet,
        datadir: './testdir',
        port: 3001
      };
      var service = new Service({node: node});

      service.start(function() {
        mkdirpSync.callCount.should.equal(1);
        mkdirpSync.args[0][0].should.equal(path.resolve(node.datadir, './bws-logs'));
        done();
      });
    });

    it('will call spawn with the correct arguments', function(done) {
      var spawnCallCount = 0;
      var basePath = path.resolve(__dirname, '../');

      var expectedScripts = [
        path.resolve(basePath, 'locker/locker.js'),
        path.resolve(basePath, 'messagebroker/messagebroker.js'),
        path.resolve(basePath, 'bcmonitor/bcmonitor.js'),
        path.resolve(basePath, 'emailservice/emailservice.js'),
        path.resolve(basePath, 'bws.js'),
      ];

      var baseConfig = require('../config');
      baseConfig.blockchainExplorerOpts = {
        testnet: {
          provider: 'insight',
          url: 'http://localhost:3001',
          apiPrefix: '/insight-api'
        }
      };

      var expectedArgs = [
        undefined,
        undefined,
        JSON.stringify(baseConfig),
        JSON.stringify(baseConfig),
        JSON.stringify(baseConfig)
      ];

      var spawn = function(program, args, options) {
        program.should.equal('node');
        args.length.should.equal(2);
        args[0].should.equal(expectedScripts[spawnCallCount]);
        should.equal(args[1], expectedArgs[spawnCallCount]);
        options.stdio.length.should.equal(3);
        options.stdio[0].should.equal('ignore');
        options.stdio[1].should.equal(fileStream);
        options.stdio[2].should.equal(fileStream);
        options.cwd.should.equal(path.resolve(__dirname, '..'));
        should.equal(process.env, options.env);
        spawnCallCount++;
      };
      var mkdirpSync = sinon.stub().returns(true);
      var existsSync = sinon.stub();
      var fileStream = {};
      var openSync = sinon.stub().returns(fileStream);
      var Service = proxyquire('../bitcorenode', {
        fs: {
          existsSync: existsSync,
          openSync: openSync
        },
        child_process: {
          spawn: spawn
        },
        mkdirp: {
          sync: mkdirpSync
        }
      });

      var node = {
        network: bitcore.Networks.testnet,
        datadir: './testdir',
        port: 3001
      };
      var service = new Service({node: node});

      service.start(function() {
        service.children.length.should.equal(5);
        done();
      });

    });

    it('will give an error with unknown network', function(done) {
      var Service = proxyquire('../bitcorenode', {
        fs: {
          existsSync: sinon.stub(),
          openSync: sinon.stub()
        },
        child_process: {
          spawn: sinon.stub()
        },
        mkdirp: {
          sync: sinon.stub()
        }
      });

      var node = {
        network: 'unknown',
        datadir: './testdir',
        port: 3001
      };
      var service = new Service({node: node});

      service.start(function(err) {
        err.message.should.equal('Unknown network');
        done();
      });

    });

    it('will use livenet', function(done) {
      var baseConfig = require('../config');
      baseConfig.blockchainExplorerOpts = {
        livenet: {
          provider: 'insight',
          url: 'http://localhost:3001',
          apiPrefix: '/insight-api'
        }
      };

      var spawnCallCount = 0;
      var expectedArgs = [
        undefined,
        undefined,
        JSON.stringify(baseConfig),
        JSON.stringify(baseConfig),
        JSON.stringify(baseConfig)
      ];
      var spawn = function(program, args, options) {
        should.equal(args[1], expectedArgs[spawnCallCount]);
        spawnCallCount++;
      };
      var Service = proxyquire('../bitcorenode', {
        fs: {
          existsSync: sinon.stub(),
          openSync: sinon.stub()
        },
        child_process: {
          spawn: spawn
        },
        mkdirp: {
          sync: sinon.stub()
        }
      });

      var node = {
        network: bitcore.Networks.livenet,
        datadir: './testdir',
        port: 3001
      };
      var service = new Service({node: node});

      service.start(function() {
        spawnCallCount.should.equal(5);
        done();
      });

    });

  });

  describe('#stop', function() {
    it('will call kill an each process', function() {
      var Service = proxyquire('../bitcorenode', {});
      var node = {
        network: bitcore.Networks.testnet,
        datadir: './testdir',
        port: 3001
      };
      var service = new Service({node: node});
      var childProcess = {
        kill: sinon.stub()
      };
      service.children = [childProcess];
      service.stop(function() {
        childProcess.kill.callCount.should.equal(1);
      });
    });
  });

});
