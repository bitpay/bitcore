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
    const levelMethodPairs = [
      // [levelName, method, message]
      ['debug', 'debug', 'debug message'],
      ['info', 'info', 'info message'],
      ['log', 'log', 'log message'],
      ['error', 'error', 'error message'],
    ] as const;

    for (const [levelName, method, message] of levelMethodPairs) {
      it(`should log .${method} when level is ${levelName}`, function () {
        const stub = sandbox.stub(console, method as keyof globalThis.Console);
        log.setLevel(levelName as any);
        (log as any)[method](message);
        stub.called.should.equal(true);
        stub.getCall(0).args[0].should.contain(message);
      });
    }
  });


  describe('message format', function () {
    const prefixTests = [
      // [method, consoleMethod, prefix]
      ['info', 'info', '[info]'],
      ['warn', 'warn', '[warn]'],
      ['error', 'error', '[error]'],
      ['fatal', 'log', '[fatal]'],
    ] as const;

    for (const [method, consoleMethod, prefix] of prefixTests) {
      it(`should prefix .${method} message with ${prefix}`, function () {
        const stub = sandbox.stub(console, consoleMethod as keyof globalThis.Console);
        log.setLevel('info' as any);
        (log as any)[method]('test');
        stub.getCall(0).args[0].should.contain(prefix);
      });
    }
  });


  describe('level filtering', function () {
    const levelFilteringTests = [
      // [activeLevel, callMethod, shouldCall, consoleMethod]
      ['warn', 'info', false, 'info'],
      ['warn', 'log', false, 'log'],
      ['warn', 'warn', true, 'warn'],
      ['warn', 'error', true, 'error'],
      ['warn', 'fatal', true, 'log'],
      ['error', 'warn', false, 'warn'],
      ['error', 'error', true, 'error'],
      ['error', 'fatal', true, 'log'],
      ['fatal', 'error', false, 'error'],
      ['fatal', 'fatal', true, 'log'],
    ] as const;

    for (const [activeLevel, callMethod, shouldCall, consoleMethod] of levelFilteringTests) {
      const label = shouldCall
        ? `should log .${callMethod} at ${activeLevel} level`
        : `should not log .${callMethod} when level is ${activeLevel}`;
      it(label, function () {
        const stub = sandbox.stub(console, consoleMethod as keyof globalThis.Console);
        log.setLevel(activeLevel as any);
        (log as any)[callMethod]('test');
        stub.called.should.equal(shouldCall);
      });
    }
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
    const silentSuppressTests = [
      // [method, consoleMethod]
      ['warn', 'warn'],
      ['error', 'error'],
      ['info', 'info'],
      ['debug', 'debug'],
    ] as const;

    for (const [method, consoleMethod] of silentSuppressTests) {
      it(`should suppress .${method} at silent level`, function () {
        const stub = sandbox.stub(console, consoleMethod as keyof globalThis.Console);
        log.setLevel('silent');
        (log as any)[method]('foo');
        stub.called.should.equal(false);
      });
    }
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
