import { expect } from 'chai';
import { createLogger } from '../src/create';
import {
  LoggifyClass,
  LoggifyFunction,
  LoggifyObject,
  PerformanceTracker,
  SavePerformance,
  initLoggify
} from '../src/decorators';

describe('Decorators', () => {
  beforeEach(() => {
    // Clear performance tracker between tests
    for (const key of Object.keys(PerformanceTracker)) {
      delete PerformanceTracker[key];
    }
  });

  describe('initLoggify', () => {
    it('should warn when called more than once', () => {
      const logger = createLogger({ prefix: 'TEST' });
      const warnings: string[] = [];
      logger.warn = ((msg: string) => { warnings.push(msg); return logger; }) as any;

      initLoggify(logger, false);
      initLoggify(logger, false);

      expect(warnings).to.have.length(1);
      expect(warnings[0]).to.include('more than once');
    });
  });

  describe('SavePerformance', () => {
    it('should track performance for a new prefix', () => {
      const start = new Date(2026, 0, 1, 0, 0, 0, 0);
      const end = new Date(2026, 0, 1, 0, 0, 0, 100);
      SavePerformance('test::fn', start, end);

      expect(PerformanceTracker['test::fn']).to.deep.equal({
        time: 100,
        count: 1,
        avg: 100,
        max: 100
      });
    });

    it('should accumulate performance data across calls', () => {
      const start1 = new Date(2026, 0, 1, 0, 0, 0, 0);
      const end1 = new Date(2026, 0, 1, 0, 0, 0, 100);
      SavePerformance('test::fn', start1, end1);

      const start2 = new Date(2026, 0, 1, 0, 0, 0, 0);
      const end2 = new Date(2026, 0, 1, 0, 0, 0, 200);
      SavePerformance('test::fn', start2, end2);

      expect(PerformanceTracker['test::fn'].count).to.equal(2);
      expect(PerformanceTracker['test::fn'].time).to.equal(300);
      expect(PerformanceTracker['test::fn'].avg).to.equal(150);
      expect(PerformanceTracker['test::fn'].max).to.equal(200);
    });
  });

  describe('LoggifyFunction', () => {
    it('should return the original function when debug is disabled', () => {
      const logger = createLogger({ prefix: 'TEST' });
      initLoggify(logger, false);

      const fn = () => 42;
      const wrapped = LoggifyFunction(fn, 'test');
      expect(wrapped).to.equal(fn);
    });

    it('should wrap the function when debug is enabled', () => {
      const logger = createLogger({ prefix: 'TEST' });
      initLoggify(logger, true);

      const fn = () => 42;
      const wrapped = LoggifyFunction(fn, 'test');
      expect(wrapped).to.not.equal(fn);
      expect(wrapped()).to.equal(42);
    });

    it('should track performance when debug is enabled', () => {
      const logger = createLogger({ prefix: 'TEST' });
      initLoggify(logger, true);

      const fn = () => 'result';
      const wrapped = LoggifyFunction(fn, 'perf::test');
      wrapped();

      expect(PerformanceTracker['perf::test']).to.exist;
      expect(PerformanceTracker['perf::test'].count).to.equal(1);
    });
  });

  describe('LoggifyClass', () => {
    it('should return the class unchanged when debug is disabled', () => {
      const logger = createLogger({ prefix: 'TEST' });
      initLoggify(logger, false);

      class MyClass {
        greet() { return 'hello'; }
      }
      const Wrapped = LoggifyClass(MyClass);
      expect(Wrapped).to.equal(MyClass);
      expect(new Wrapped().greet()).to.equal('hello');
    });

    it('should return a subclass that wraps methods when debug is enabled', () => {
      const logger = createLogger({ prefix: 'TEST' });
      initLoggify(logger, true);

      class MyClass {
        greet() { return 'hello'; }
      }
      const Wrapped = LoggifyClass(MyClass);
      expect(Wrapped).to.not.equal(MyClass);
      const instance = new Wrapped();
      expect(instance.greet()).to.equal('hello');
    });
  });

  describe('LoggifyObject', () => {
    it('should return the object unchanged when debug is disabled', () => {
      const logger = createLogger({ prefix: 'TEST' });
      initLoggify(logger, false);

      const obj = { fn: () => 42 };
      const result = LoggifyObject(obj, 'test');
      expect(result.fn()).to.equal(42);
    });

    it('should wrap object methods when debug is enabled', () => {
      const logger = createLogger({ prefix: 'TEST' });
      initLoggify(logger, true);

      const obj = { fn: () => 42 };
      const original = obj.fn;
      LoggifyObject(obj, 'test');
      expect(obj.fn).to.not.equal(original);
      expect(obj.fn()).to.equal(42);
    });
  });
});
