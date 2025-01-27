import { describe, beforeEach, afterEach, it } from 'node:test';
import assert from 'assert';
import sinon from 'sinon';
import parseArgv from '../../../src/utils/parseArgv';

describe('parseArgv Util', () => {
  let argv;
  const sandbox = sinon.createSandbox();
  
  beforeEach(function() {
    argv = sandbox.stub(process, 'argv');
  });
  afterEach(function() {
    sandbox.restore();
  });

  describe('legacy (string) args', function() {
    it('should parse required legacy arg', function() {
      argv.value(['--DEBUG', '1']);
      const args = parseArgv(['DEBUG'], []);
      assert.strictEqual(!!args.DEBUG, true);
    });

    it('should parse required legacy arg with intuitively falsy value as true', function() {
      argv.value(['--DEBUG', '0']);
      const args = parseArgv(['DEBUG'], []);
      assert.strictEqual(!!args.DEBUG, true);
    });

    it('should parse required legacy arg with string value', function() {
      argv.value(['--CONFIG', '../hello/world']);
      const args = parseArgv(['CONFIG'], []);
      assert.strictEqual(!!args.CONFIG, true);
      assert.strictEqual(args.CONFIG, '../hello/world');
    });

    it('should parse required legacy arg without value', function() {
      argv.value(['--DEBUG']);
      assert.throws(() => parseArgv(['DEBUG'], []), { message: 'DEBUG is missing a value of string type' })
    });

    it('should parse optional legacy arg', function() {
      argv.value(['--DEBUG', '1']);
      const args = parseArgv([], ['DEBUG']);
      assert.strictEqual(!!args.DEBUG, true);
    });

    it('should parse optional legacy arg with intuitively falsy value as true', function() {
      argv.value(['--DEBUG', '0']);
      const args = parseArgv([], ['DEBUG']);
      assert.strictEqual(!!args.DEBUG, true);
    });

    it('should parse optional legacy arg without value', function() {
      argv.value(['--DEBUG']);
      assert.throws(() => parseArgv([], ['DEBUG']), { message: 'DEBUG is missing a value of string type' })
    });
  });

  describe('string', function() {
    it('should parse required arg', function() {
      argv.value(['--CONFIG', 'hello world!']);
      const args = parseArgv([{ arg: 'CONFIG', type: 'string' }], []);
      assert.strictEqual(args.CONFIG, 'hello world!');
    });

    it('should throw if missing required arg', function() {
      argv.value([]);
      assert.throws(() => parseArgv([{ arg: 'CONFIG', type: 'string' }], []), { message: 'CONFIG is a required command argument' });
    });

    it('should throw if required arg has missing val', function() {
      argv.value(['--CONFIG']);
      assert.throws(() => parseArgv([{ arg: 'CONFIG', type: 'string' }], []), { message: 'CONFIG is missing a value of string type' });
    });

    it('should parse optional arg', function() {
      argv.value(['--CONFIG', 'hello world!']);
      const args = parseArgv([], [{ arg: 'CONFIG', type: 'string' }]);
      assert.strictEqual(args.CONFIG, 'hello world!');
    });

    it('should throw if optional arg is missing val', function() {
      argv.value(['--CONFIG']);
      assert.throws(() => parseArgv([], [{ arg: 'CONFIG', type: 'string' }]), { message: 'CONFIG is missing a value of string type' });
    });

  });
  
  describe('boolean', function() {
    it('should parse optional arg', function() {
      argv.value(['--DEBUG', '1']);
      const args = parseArgv([], [{ arg: 'DEBUG', type: 'bool' }]);
      assert.strictEqual(args.DEBUG, true);
    });
  
    it('should parse optional arg with intuitively falsy value as false', function() {
      argv.value(['--DEBUG', '0']);
      const args = parseArgv([], [{ arg: 'DEBUG', type: 'bool' }]);
      assert.strictEqual(args.DEBUG, false);
    });
  
    it('should parse optional arg without value', function() {
      argv.value(['--DEBUG']);
      const args = parseArgv([], [{ arg: 'DEBUG', type: 'bool' }]);
      assert.strictEqual(args.DEBUG, true);
    });
  });

  describe('int', function() {
    it('should parse required arg', function() {
      argv.value(['--DAYS', '123']);
      const args = parseArgv([{ arg: 'DAYS', type: 'int' }], []);
      assert.strictEqual(args.DAYS, 123);
    });

    it('should throw if missing required arg', function() {
      argv.value([]);
      assert.throws(() => parseArgv([{ arg: 'DAYS', type: 'int' }], []), { message: 'DAYS is a required command argument' });
    });

    it('should throw if missing required arg value', function() {
      argv.value(['--DAYS']);
      assert.throws(() => parseArgv([{ arg: 'DAYS', type: 'int' }], []), { message: 'DAYS is missing a value of int type' });
    });

    it('should throw if required arg is the wrong type', function() {
      argv.value(['--DAYS', 'true']);
      assert.throws(() => parseArgv([{ arg: 'DAYS', type: 'int' }], []), { message: 'Invalid arg type. Expected int but got "true"' });
    });

    it('should parse optional arg', function() {
      argv.value(['--DAYS', '123.34']); // float gets parsed as an int
      const args = parseArgv([], [{ arg: 'DAYS', type: 'int' }]);
      assert.strictEqual(args.DAYS, 123);
    });

    it('should throw if missing arg value', function() {
      argv.value(['--DAYS']);
      assert.throws(() => parseArgv([{ arg: 'DAYS', type: 'int' }], []), { message: 'DAYS is missing a value of int type' });
    });

    it('should throw if arg is the wrong type', function() {
      argv.value(['--DAYS', 'true']);
      assert.throws(() => parseArgv([{ arg: 'DAYS', type: 'int' }], []), { message: 'Invalid arg type. Expected int but got "true"' });
    });
  });

  describe('float/number', function() {
    it('should parse required arg', function() {
      argv.value(['--DAYS', '123.23']);
      const args = parseArgv([{ arg: 'DAYS', type: 'number' }], []);
      assert.strictEqual(args.DAYS, 123.23);
    });

    it('should throw if missing required arg', function() {
      argv.value([]);
      assert.throws(() => parseArgv([{ arg: 'DAYS', type: 'number' }], []), { message: 'DAYS is a required command argument' });
    });

    it('should throw if missing required arg value', function() {
      argv.value(['--DAYS']);
      assert.throws(() => parseArgv([{ arg: 'DAYS', type: 'number' }], []), { message: 'DAYS is missing a value of number type' });
    });

    it('should throw if required arg is the wrong type', function() {
      argv.value(['--DAYS', 'true']);
      assert.throws(() => parseArgv([{ arg: 'DAYS', type: 'number' }], []), { message: 'Invalid arg type. Expected float but got "true"' });
    });

    it('should parse optional arg', function() {
      argv.value(['--DAYS', '123.34']);
      const args = parseArgv([], [{ arg: 'DAYS', type: 'number' }]);
      assert.strictEqual(args.DAYS, 123.34);
    });

    it('should throw if missing arg value', function() {
      argv.value(['--DAYS']);
      assert.throws(() => parseArgv([{ arg: 'DAYS', type: 'number' }], []), { message: 'DAYS is missing a value of number type' });
    });

    it('should throw if arg is the wrong type', function() {
      argv.value(['--DAYS', 'true']);
      assert.throws(() => parseArgv([{ arg: 'DAYS', type: 'number' }], []), { message: 'Invalid arg type. Expected float but got "true"' });
    });
  });
});
