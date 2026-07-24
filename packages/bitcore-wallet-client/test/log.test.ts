'use strict';

import * as chai from 'chai';
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


  describe('individual log methods', function () {
    it('should log .debug when level is debug', function () {
      const cd = sandbox.stub(console, 'debug');
      log.setLevel('debug');
      log.debug('debug message');
      cd.called.should.equal(true);
      cd.getCall(0).args[0].should.contain('debug message');
    });

    it('should log .info when level is info', function () {
      const ci = sandbox.stub(console, 'info');
      log.setLevel('info');
      log.info('info message');
      ci.called.should.equal(true);
      ci.getCall(0).args[0].should.contain('info message');
    });

    it('should log .log when level is log', function () {
      const cl = sandbox.stub(console, 'log');
      log.setLevel('log');
      log.log('log message');
      cl.called.should.equal(true);
      cl.getCall(0).args[0].should.contain('log message');
    });

    it('should log .error when level is error', function () {
      const ce = sandbox.stub(console, 'error');
      log.setLevel('error');
      log.error('error message');
      ce.called.should.equal(true);
      ce.getCall(0).args[0].should.contain('error message');
    });
  });


  describe('message format', function () {
    it('should prefix .info message with [info]', function () {
      const ci = sandbox.stub(console, 'info');
      log.setLevel('info');
      log.info('test');
      ci.getCall(0).args[0].should.contain('[info]');
    });

    it('should prefix .warn message with [warn]', function () {
      const cw = sandbox.stub(console, 'warn');
      log.setLevel('info');
      log.warn('test');
      cw.getCall(0).args[0].should.contain('[warn]');
    });

    it('should prefix .error message with [error]', function () {
      const ce = sandbox.stub(console, 'error');
      log.setLevel('info');
      log.error('test');
      ce.getCall(0).args[0].should.contain('[error]');
    });

    it('should prefix .fatal message with [fatal] via console.log fallback', function () {
      const cl = sandbox.stub(console, 'log');
      log.setLevel('info');
      log.fatal('test');
      cl.getCall(0).args[0].should.contain('[fatal]');
    });
  });


  describe('level filtering', function () {
    it('should not log info when level is warn', function () {
      const ci = sandbox.stub(console, 'info');
      log.setLevel('warn');
      log.info('test');
      ci.called.should.equal(false);
    });

    it('should not log log when level is warn', function () {
      const cl = sandbox.stub(console, 'log');
      log.setLevel('warn');
      log.log('test');
      cl.called.should.equal(false);
    });

    it('should not log warn when level is error', function () {
      const cw = sandbox.stub(console, 'warn');
      log.setLevel('error');
      log.warn('test');
      cw.called.should.equal(false);
    });

    it('should not log error when level is fatal', function () {
      const ce = sandbox.stub(console, 'error');
      log.setLevel('fatal');
      log.error('test');
      ce.called.should.equal(false);
    });

    it('should log warn at warn level', function () {
      const cw = sandbox.stub(console, 'warn');
      log.setLevel('warn');
      log.warn('test');
      cw.called.should.equal(true);
    });

    it('should log error at warn level', function () {
      const ce = sandbox.stub(console, 'error');
      log.setLevel('warn');
      log.error('test');
      ce.called.should.equal(true);
    });

    it('should log fatal at warn level via console.log fallback', function () {
      const cl = sandbox.stub(console, 'log');
      log.setLevel('warn');
      log.fatal('test');
      cl.called.should.equal(true);
    });
  });


  describe('multiple arguments', function () {
    it('should pass extra args to console when console[levelName] exists', function () {
      const cw = sandbox.stub(console, 'warn');
      log.setLevel('info');
      log.warn('message', 'extra1', 'extra2');
      cw.calledOnce.should.equal(true);
      const args = cw.getCall(0).args;
      args[0].should.contain('[warn]');
      args[0].should.contain('message');
      args[1].should.equal('extra1');
      args[2].should.equal('extra2');
    });

    it('should serialize extra args into message string when console[levelName] does not exist', function () {
      const cl = sandbox.stub(console, 'log');
      log.setLevel('info');
      log.fatal('message', 'extra1', 'extra2');
      const arg = cl.getCall(0).args[0];
      arg.should.contain('[fatal]');
      arg.should.contain('message');
      arg.should.contain('extra1');
      arg.should.contain('extra2');
    });

    it('should not append extra args when there are none (fatal fallback)', function () {
      const cl = sandbox.stub(console, 'log');
      log.setLevel('info');
      log.fatal('only message');
      cl.calledOnce.should.equal(true);
      cl.getCall(0).args[0].should.equal('[fatal] only message');
    });
  });


  describe('getLevels', function () {
    it('should return all seven level definitions with correct numeric values', function () {
      const levels = log.getLevels();
      levels.should.have.property('silent').equal(-1);
      levels.should.have.property('debug').equal(0);
      levels.should.have.property('info').equal(1);
      levels.should.have.property('log').equal(2);
      levels.should.have.property('warn').equal(3);
      levels.should.have.property('error').equal(4);
      levels.should.have.property('fatal').equal(5);
    });
  });


  describe('setLevel', function () {
    it('should return the logger instance for chaining', function () {
      const result = log.setLevel('debug');
      result.should.equal(log);
    });

    it('should update the active log level', function () {
      const cw = sandbox.stub(console, 'warn');
      log.setLevel('error');
      log.warn('suppressed');
      cw.called.should.equal(false);
      log.setLevel('warn');
      log.warn('visible');
      cw.called.should.equal(true);
    });
  });


  describe('silent level suppresses individual console methods', function () {
    it('should suppress .warn at silent level', function () {
      const cw = sandbox.stub(console, 'warn');
      log.setLevel('silent');
      log.warn('foo');
      cw.called.should.equal(false);
    });

    it('should suppress .error at silent level', function () {
      const ce = sandbox.stub(console, 'error');
      log.setLevel('silent');
      log.error('foo');
      ce.called.should.equal(false);
    });

    it('should suppress .info at silent level', function () {
      const ci = sandbox.stub(console, 'info');
      log.setLevel('silent');
      log.info('foo');
      ci.called.should.equal(false);
    });

    it('should suppress .debug at silent level', function () {
      const cd = sandbox.stub(console, 'debug');
      log.setLevel('silent');
      log.debug('foo');
      cd.called.should.equal(false);
    });
  });


  describe('stack trace behavior', function () {
    it('should call console.trace when logger level is debug', function () {
      const ct = sandbox.stub(console, 'trace');
      sandbox.stub(console, 'debug');
      log.setLevel('debug');
      log.debug('trace test');
      ct.called.should.equal(true);
    });

    it('should call console.trace for any method when logger level is debug', function () {
      const ct = sandbox.stub(console, 'trace');
      sandbox.stub(console, 'warn');
      log.setLevel('debug');
      log.warn('warn at debug level');
      ct.called.should.equal(true);
    });

    it('should not call console.trace when logger level is not debug', function () {
      const ct = sandbox.stub(console, 'trace');
      sandbox.stub(console, 'info');
      log.setLevel('info');
      log.info('no trace');
      ct.called.should.equal(false);
    });

    it('should include caller info in message when console.trace throws', function () {
      const fakeStack = 'Error\n    at trace\n    at callerFile.ts:42:10\n    at runTest';
      sandbox.stub(console, 'trace').throws({ stack: fakeStack });
      const cd = sandbox.stub(console, 'debug');
      log.setLevel('debug');
      log.debug('stack test');
      cd.called.should.equal(true);
      const arg = cd.getCall(0).args[0];
      arg.should.contain('[debug');
      arg.should.contain('stack test');
      // caller info was extracted from the fake stack
      arg.should.contain('callerFile.ts');
    });

    it('should not call console.trace when Error.stackTraceLimit is falsy', function () {
      const original = (Error as any).stackTraceLimit;
      try {
        (Error as any).stackTraceLimit = 0;
        const ct = sandbox.stub(console, 'trace');
        sandbox.stub(console, 'debug');
        log.setLevel('debug');
        log.debug('no stack limit');
        ct.called.should.equal(false);
      } finally {
        (Error as any).stackTraceLimit = original;
      }
    });

    it('should restore Error.stackTraceLimit after trace capture', function () {
      const original = (Error as any).stackTraceLimit;
      sandbox.stub(console, 'trace');
      sandbox.stub(console, 'debug');
      log.setLevel('debug');
      log.debug('restore test');
      (Error as any).stackTraceLimit.should.equal(original);
    });
  });

});
