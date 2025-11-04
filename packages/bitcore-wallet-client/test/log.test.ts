'use strict';

import chai from 'chai';
import sinon from 'sinon';
import log from '../src/lib/log';

const should = chai.should();

describe('log utils', function() {
  const sandbox = sinon.createSandbox();
  
  afterEach(function () {
    log.setLevel('info');
    sandbox.restore();
  });


  it('should log .warn', function () {
    const cw = sandbox.stub(console, 'warn');

    log.setLevel('debug');
    log.warn('hola');

    const arg = cw.getCall(0).args[0];
    // arg.should.contain('util.log.js');        /* Firefox does not include the stack track */
    arg.should.contain('hola');
  });


  it('should log .fatal', function () {
    const cl = sandbox.stub(console, 'log');

    log.setLevel('debug');
    log.fatal('hola', 'que', 'tal');

    const arg = cl.getCall(0).args[0];
    // arg.should.contain('util.log.js');        /* Firefox does not include the stack track */
    arg.should.contain('que');
  });


  it('should not log debug', function () {
    const cl = sandbox.stub(console, 'log');
    log.setLevel('info');
    log.debug('hola');
    cl.called.should.equal(false);
  });

  it('should log debug', function () {
    log.getLevels().debug.should.equal(0);
    log.getLevels().fatal.should.equal(5);
  });

  it('should log nothing if logLevel is set to silent', function () {
    const cl = sandbox.stub(console, 'log');

    log.setLevel('silent');
    log.debug('foo');
    log.info('foo');
    log.log('foo');
    log.warn('foo');
    log.error('foo');
    log.fatal('foo');

    cl.callCount.should.equal(0);
  });

  it('should not create a log.silent() method', function () {
    should.not.exist(log['silent']);
  });

});
