import { execSync } from 'child_process';
import assert from 'assert';
import { getCommands } from '../src/cli-commands';
import { type IWallet } from '../types/wallet';
import { bitcoreLogo } from '../src/constants';
import { type ICliOptions } from 'types/cli';

describe('Option: --command', function() {
  const COMMANDS = getCommands({ wallet: {} as IWallet, opts: { command: 'any' } as ICliOptions });

  describe('NEW', function() {
    for (const cmd of COMMANDS.NEW) {
      it(cmd.value, function() {
        assert.throws(
          () => execSync(`node build/src/cli.js --command ${cmd.value} --help --verbose`, { encoding: 'utf-8' }),
          `Error: Running "${cmd.value}" directly is not supported. Use the interactive CLI`
        );
      });
    }
  });

  describe('BASIC', function() {
    for (const cmd of COMMANDS.BASIC) {
      it(cmd.value, function() {
        try {
          const output = execSync(`node build/src/cli.js wallet --command ${cmd.value} --help --verbose`, { encoding: 'utf-8' });
          assert.equal(output.includes(bitcoreLogo), true);
        } catch (err) {
          const error = err?.stdout || err;
          if (cmd['noCmd']) {
            assert.equal(error.includes(`Running "${cmd.value}" directly is not supported. Use the interactive CLI`), true);
          } else {
            throw new Error(error);
          }
        }
      });
    }
  });

  describe('ADVANCED', function() {
    for (const cmd of COMMANDS.ADVANCED) {
      it(cmd.value, function() {
        try {
          const output = execSync(`node build/src/cli.js wallet --command ${cmd.value} --help --verbose`, { encoding: 'utf-8' });
          assert.equal(output.includes(bitcoreLogo), true);
        } catch (err) {
          const error = err?.stdout || err;
          if (cmd['noCmd']) {
            assert.equal(error.includes(`Running "${cmd.value}" directly is not supported. Use the interactive CLI`), true);
          } else {
            throw new Error(error);
          }
        }
      });
    }
  });
});