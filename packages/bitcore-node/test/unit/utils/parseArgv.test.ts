import { expect } from 'chai';
import { describe } from 'mocha';
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
      expect(!!args.DEBUG).to.equal(true);
    });

    it('should parse required legacy arg with intuitively falsy value as true', function() {
      argv.value(['--DEBUG', '0']);
      const args = parseArgv(['DEBUG'], []);
      expect(!!args.DEBUG).to.equal(true);
    });

    it('should parse required legacy arg with string value', function() {
      argv.value(['--CONFIG', '../hello/world']);
      const args = parseArgv(['CONFIG'], []);
      expect(!!args.CONFIG).to.equal(true);
      expect(args.CONFIG).to.equal('../hello/world');
    });

    it('should parse required legacy arg without value', function() {
      argv.value(['--DEBUG']);
      try {
        parseArgv(['DEBUG'], []);
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('DEBUG is missing a value of string type');
      }
    });

    it('should parse optional legacy arg', function() {
      argv.value(['--DEBUG', '1']);
      const args = parseArgv([], ['DEBUG']);
      expect(!!args.DEBUG).to.equal(true);
    });

    it('should parse optional legacy arg with intuitively falsy value as true', function() {
      argv.value(['--DEBUG', '0']);
      const args = parseArgv([], ['DEBUG']);
      expect(!!args.DEBUG).to.equal(true);
    });

    it('should parse optional legacy arg without value', function() {
      argv.value(['--DEBUG']);
      try {
        parseArgv([], ['DEBUG']);
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('DEBUG is missing a value of string type');
      }
    });
  });

  describe('string', function() {
    it('should parse required arg', function() {
      argv.value(['--CONFIG', 'hello world!']);
      const args = parseArgv([{ arg: 'CONFIG', type: 'string' }], []);
      expect(args.CONFIG).to.equal('hello world!');
    });

    it('should throw if missing required arg', function() {
      argv.value([]);
      try {
        parseArgv([{ arg: 'CONFIG', type: 'string' }], []);
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('CONFIG is a required command argument');
      }
    });

    it('should throw if required arg has missing val', function() {
      argv.value(['--CONFIG']);
      try {
        parseArgv([{ arg: 'CONFIG', type: 'string' }], []);
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('CONFIG is missing a value of string type');
      }
    });

    it('should parse optional arg', function() {
      argv.value(['--CONFIG', 'hello world!']);
      const args = parseArgv([], [{ arg: 'CONFIG', type: 'string' }]);
      expect(args.CONFIG).to.equal('hello world!');
    });

    it('should throw if optional arg is missing val', function() {
      argv.value(['--CONFIG']);
      try {
        parseArgv([], [{ arg: 'CONFIG', type: 'string' }]);
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('CONFIG is missing a value of string type');
      }
    });

  });
  
  describe('boolean', function() {
    it('should parse optional arg', function() {
      argv.value(['--DEBUG', '1']);
      const args = parseArgv([], [{ arg: 'DEBUG', type: 'bool' }]);
      expect(args.DEBUG).to.equal(true);
    });
  
    it('should parse optional arg with intuitively falsy value as false', function() {
      argv.value(['--DEBUG', '0']);
      const args = parseArgv([], [{ arg: 'DEBUG', type: 'bool' }]);
      expect(args.DEBUG).to.equal(false);
    });
  
    it('should parse optional arg without value', function() {
      argv.value(['--DEBUG']);
      const args = parseArgv([], [{ arg: 'DEBUG', type: 'bool' }]);
      expect(args.DEBUG).to.equal(true);
    });
  });

  describe('int', function() {
    it('should parse required arg', function() {
      argv.value(['--DAYS', '123']);
      const args = parseArgv([{ arg: 'DAYS', type: 'int' }], []);
      expect(args.DAYS).to.equal(123);
    });

    it('should throw if missing required arg', function() {
      argv.value([]);
      try {
        parseArgv([{ arg: 'DAYS', type: 'int' }], []);
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('DAYS is a required command argument');
      }
    });

    it('should throw if missing required arg value', function() {
      argv.value(['--DAYS']);
      try {
        parseArgv([{ arg: 'DAYS', type: 'int' }], []);
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('DAYS is missing a value of int type');
      }
    });

    it('should throw if required arg is the wrong type', function() {
      argv.value(['--DAYS', 'true']);
      try {
        parseArgv([{ arg: 'DAYS', type: 'int' }], []);
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('Invalid arg type. Expected int but got "true"');
      }
    });

    it('should parse optional arg', function() {
      argv.value(['--DAYS', '123.34']); // float gets parsed as an int
      const args = parseArgv([], [{ arg: 'DAYS', type: 'int' }]);
      expect(args.DAYS).to.equal(123);
    });

    it('should throw if missing arg value', function() {
      argv.value(['--DAYS']);
      try {
        parseArgv([{ arg: 'DAYS', type: 'int' }], []);
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('DAYS is missing a value of int type');
      }
    });

    it('should throw if arg is the wrong type', function() {
      argv.value(['--DAYS', 'true']);
      try {
        parseArgv([{ arg: 'DAYS', type: 'int' }], []);
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('Invalid arg type. Expected int but got "true"');
      }
    });
  });

  describe('float/number', function() {
    it('should parse required arg', function() {
      argv.value(['--DAYS', '123.23']);
      const args = parseArgv([{ arg: 'DAYS', type: 'number' }], []);
      expect(args.DAYS).to.equal(123.23);
    });

    it('should throw if missing required arg', function() {
      argv.value([]);
      try {
        parseArgv([{ arg: 'DAYS', type: 'number' }], []);
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('DAYS is a required command argument');
      }
    });

    it('should throw if missing required arg value', function() {
      argv.value(['--DAYS']);
      try {
        parseArgv([{ arg: 'DAYS', type: 'number' }], []);
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('DAYS is missing a value of number type');
      }
    });

    it('should throw if required arg is the wrong type', function() {
      argv.value(['--DAYS', 'true']);
      try {
        parseArgv([{ arg: 'DAYS', type: 'number' }], []);
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('Invalid arg type. Expected float but got "true"');
      }
    });

    it('should parse optional arg', function() {
      argv.value(['--DAYS', '123.34']);
      const args = parseArgv([], [{ arg: 'DAYS', type: 'number' }]);
      expect(args.DAYS).to.equal(123.34);
    });

    it('should throw if missing arg value', function() {
      argv.value(['--DAYS']);
      try {
        parseArgv([{ arg: 'DAYS', type: 'number' }], []);
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('DAYS is missing a value of number type');
      }
    });

    it('should throw if arg is the wrong type', function() {
      argv.value(['--DAYS', 'true']);
      try {
        parseArgv([{ arg: 'DAYS', type: 'number' }], []);
        throw new Error('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('Invalid arg type. Expected float but got "true"');
      }
    });
  });
});
