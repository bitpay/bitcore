'use strict';

var _ = require('lodash');
var chai = chai || require('chai');
var sinon = sinon || require('sinon');
var should = chai.should();
var log = require('../lib/log');

describe('log utils', function() {
  afterEach(function() {
    log.setLevel('info');
  });

  it('should log .warn', function() {
    if (console.warn.restore)
      console.warn.restore();

    sinon.stub(console, 'warn');

    log.setLevel('debug');
    log.warn('hola');

    var arg = console.warn.getCall(0).args[0];
    //arg.should.contain('util.log.js');        /* Firefox does not include the stack track */
    arg.should.contain('hola');
    console.warn.restore();
  });


  it('should log .fatal', function() {
    if (console.log.restore)
      console.log.restore();

    sinon.stub(console, 'log');

    log.setLevel('debug');
    log.fatal('hola', "que", 'tal');

    var arg = console.log.getCall(0).args[0];
    //arg.should.contain('util.log.js');        /* Firefox does not include the stack track */
    arg.should.contain('que');
    console.log.restore();
  });


  it('should not log debug', function() {
    sinon.stub(console, 'log');
    log.setLevel('info');
    log.debug('hola');
    console.log.called.should.equal(false);
    console.log.restore();
  });

  it('should log debug', function() {
    log.getLevels().debug.should.equal(0);
    log.getLevels().fatal.should.equal(5);
  });

  it('should log nothing if logLevel is set to silent', function() {
    var sandbox = sinon.sandbox.create();
    var cl = sandbox.stub(console, 'log');

    log.setLevel('silent');
    log.debug('foo');
    log.info('foo');
    log.log('foo');
    log.warn('foo');
    log.error('foo');
    log.fatal('foo');

    cl.callCount.should.equal(0);
    sandbox.restore();
  });

  it('should not create a log.silent() method', function() {
    should.not.exist(log.silent);
  });

});
