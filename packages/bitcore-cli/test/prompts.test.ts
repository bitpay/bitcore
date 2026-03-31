import assert from 'assert';
import os from 'os';
import * as prompts from '../src/prompts';
import { UserCancelled } from '../src/errors';
import { CONSTANTS } from './helpers';

const { KEYSTROKES } = CONSTANTS;

describe('prompts', function() {
  afterEach(function() {
    delete process.env['BITCORE_CLI_CHAIN'];
    delete process.env['BITCORE_CLI_NETWORK'];
    delete process.env['BITCORE_CLI_MULTIPARTY_M_N'];
    delete process.env['BITCORE_CLI_MULTIPARTY'];
    delete process.env['BITCORE_CLI_MULTIPARTY_SCHEME'];
    delete process.env['BITCORE_CLI_COPAYER_NAME'];
    delete process.env['BITCORE_CLI_ADDRESS_TYPE'];
  });

  // ─── getChain ───────────────────────────────────────────────────────────────

  describe('getChain', function() {
    it('should return default chain (btc) on ENTER', async function() {
      const promise = prompts.getChain();
      process.stdin.push(KEYSTROKES.ENTER);
      assert.strictEqual(await promise, 'btc');
    });

    it('should use BITCORE_CLI_CHAIN env var as default', async function() {
      process.env['BITCORE_CLI_CHAIN'] = 'eth';
      const promise = prompts.getChain();
      process.stdin.push(KEYSTROKES.ENTER);
      assert.strictEqual(await promise, 'eth');
    });

    it('should throw UserCancelled when user cancels', async function() {
      const promise = prompts.getChain();
      process.stdin.push(KEYSTROKES.CTRL_C);
      await assert.rejects(() => promise, UserCancelled);
    });

    it('validate: should reject an invalid chain (prompt stays open)', async function() {
      const promise = prompts.getChain();
      process.stdin.push('notachain');
      process.stdin.push(KEYSTROKES.ENTER); // validation error — prompt stays open
      process.stdin.push(KEYSTROKES.CTRL_C);
      await assert.rejects(() => promise, UserCancelled);
    });

    it('validate: should accept a valid chain', async function() {
      const promise = prompts.getChain();
      process.stdin.push('eth');
      process.stdin.push(KEYSTROKES.ENTER);
      assert.strictEqual(await promise, 'eth');
    });
  });

  // ─── getNetwork ─────────────────────────────────────────────────────────────

  describe('getNetwork', function() {
    it('should return livenet on default ENTER', async function() {
      const promise = prompts.getNetwork();
      process.stdin.push(KEYSTROKES.ENTER);
      assert.strictEqual(await promise, 'livenet');
    });

    it('should return testnet when env var is testnet', async function() {
      process.env['BITCORE_CLI_NETWORK'] = 'testnet';
      const promise = prompts.getNetwork();
      process.stdin.push(KEYSTROKES.ENTER);
      assert.strictEqual(await promise, 'testnet');
    });

    it('should return regtest when env var is regtest', async function() {
      process.env['BITCORE_CLI_NETWORK'] = 'regtest';
      const promise = prompts.getNetwork();
      process.stdin.push(KEYSTROKES.ENTER);
      assert.strictEqual(await promise, 'regtest');
    });

    it('should throw UserCancelled when user cancels', async function() {
      const promise = prompts.getNetwork();
      process.stdin.push(KEYSTROKES.CTRL_C);
      await assert.rejects(() => promise, UserCancelled);
    });

    it('validate: should reject an invalid network', async function() {
      const promise = prompts.getNetwork();
      process.stdin.push('badnet');
      process.stdin.push(KEYSTROKES.ENTER); // validation error — prompt stays open
      process.stdin.push(KEYSTROKES.CTRL_C);
      await assert.rejects(() => promise, UserCancelled);
    });
  });

  // ─── getPassword ────────────────────────────────────────────────────────────

  describe('getPassword', function() {
    it('should return the entered password', async function() {
      const promise = prompts.getPassword();
      process.stdin.push('s3cr3t');
      process.stdin.push(KEYSTROKES.ENTER);
      assert.strictEqual(await promise, 's3cr3t');
    });

    it('should throw UserCancelled when user cancels', async function() {
      const promise = prompts.getPassword();
      process.stdin.push(KEYSTROKES.CTRL_C);
      await assert.rejects(() => promise, UserCancelled);
    });

    it('validate: should reject a password shorter than minLength', async function() {
      const promise = prompts.getPassword(undefined, { minLength: 8 });
      process.stdin.push('short'); // 5 chars — fails minLength 8
      process.stdin.push(KEYSTROKES.ENTER); // validation error — prompt stays open
      process.stdin.push(KEYSTROKES.CTRL_C);
      await assert.rejects(() => promise, UserCancelled);
    });

    it('validate: should accept a password meeting minLength', async function() {
      const promise = prompts.getPassword(undefined, { minLength: 4 });
      process.stdin.push('validpw');
      process.stdin.push(KEYSTROKES.ENTER);
      assert.strictEqual(await promise, 'validpw');
    });
  });

  // ─── getMofN ────────────────────────────────────────────────────────────────

  describe('getMofN', function() {
    it('should return default m-n on ENTER', async function() {
      const promise = prompts.getMofN();
      process.stdin.push(KEYSTROKES.ENTER);
      assert.strictEqual(await promise, '2-3');
    });

    it('should use BITCORE_CLI_MULTIPARTY_M_N env var as default', async function() {
      process.env['BITCORE_CLI_MULTIPARTY_M_N'] = '3-5';
      const promise = prompts.getMofN();
      process.stdin.push(KEYSTROKES.ENTER);
      assert.strictEqual(await promise, '3-5');
    });

    it('should throw UserCancelled when user cancels', async function() {
      const promise = prompts.getMofN();
      process.stdin.push(KEYSTROKES.CTRL_C);
      await assert.rejects(() => promise, UserCancelled);
    });

    it('validate: should reject m > n', async function() {
      const promise = prompts.getMofN();
      process.stdin.push('3-2');
      process.stdin.push(KEYSTROKES.ENTER); // validation error — prompt stays open
      process.stdin.push(KEYSTROKES.CTRL_C);
      await assert.rejects(() => promise, UserCancelled);
    });

    it('validate: should reject n < 2', async function() {
      const promise = prompts.getMofN();
      process.stdin.push('1-1');
      process.stdin.push(KEYSTROKES.ENTER); // validation error — prompt stays open
      process.stdin.push(KEYSTROKES.CTRL_C);
      await assert.rejects(() => promise, UserCancelled);
    });

    it('validate: should show help text and not accept "help" as a value', async function() {
      const promise = prompts.getMofN();
      process.stdin.push('help');
      process.stdin.push(KEYSTROKES.ENTER); // returns help text as error — prompt stays open
      process.stdin.push(KEYSTROKES.CTRL_C);
      await assert.rejects(() => promise, UserCancelled);
    });
  });

  // ─── getIsMultiParty ────────────────────────────────────────────────────────

  describe('getIsMultiParty', function() {
    it('should return false by default on ENTER', async function() {
      const promise = prompts.getIsMultiParty();
      process.stdin.push(KEYSTROKES.ENTER);
      assert.strictEqual(await promise, false);
    });

    it('should return true when env var sets initial value to true', async function() {
      process.env['BITCORE_CLI_MULTIPARTY'] = 'true';
      const promise = prompts.getIsMultiParty();
      process.stdin.push(KEYSTROKES.ENTER); // confirms the initialValue (true)
      assert.strictEqual(await promise, true);
    });

    it('should throw UserCancelled when user cancels', async function() {
      const promise = prompts.getIsMultiParty();
      process.stdin.push(KEYSTROKES.CTRL_C);
      await assert.rejects(() => promise, UserCancelled);
    });
  });

  // ─── getMultiPartyScheme ────────────────────────────────────────────────────

  describe('getMultiPartyScheme', function() {
    it('should return multisig (first option) on ENTER', async function() {
      const promise = prompts.getMultiPartyScheme();
      process.stdin.push(KEYSTROKES.ENTER);
      assert.strictEqual(await promise, 'multisig');
    });

    it('should return tss on ARROW_DOWN + ENTER', async function() {
      const promise = prompts.getMultiPartyScheme();
      process.stdin.push(KEYSTROKES.ARROW_DOWN);
      process.stdin.push(KEYSTROKES.ENTER);
      assert.strictEqual(await promise, 'tss');
    });

    it('should return tss when env var sets initial value to tss', async function() {
      process.env['BITCORE_CLI_MULTIPARTY_SCHEME'] = 'tss';
      const promise = prompts.getMultiPartyScheme();
      process.stdin.push(KEYSTROKES.ENTER); // confirms the initialValue (tss)
      assert.strictEqual(await promise, 'tss');
    });

    it('should throw UserCancelled when user cancels', async function() {
      const promise = prompts.getMultiPartyScheme();
      process.stdin.push(KEYSTROKES.CTRL_C);
      await assert.rejects(() => promise, UserCancelled);
    });
  });

  // ─── getCopayerName ─────────────────────────────────────────────────────────

  describe('getCopayerName', function() {
    it('should return name from env var default on ENTER', async function() {
      process.env['BITCORE_CLI_COPAYER_NAME'] = 'Alice';
      const promise = prompts.getCopayerName();
      process.stdin.push(KEYSTROKES.ENTER);
      assert.strictEqual(await promise, 'Alice');
    });

    it('should throw UserCancelled when user cancels', async function() {
      const promise = prompts.getCopayerName();
      process.stdin.push(KEYSTROKES.CTRL_C);
      await assert.rejects(() => promise, UserCancelled);
    });
  });

  // ─── getAddressType ─────────────────────────────────────────────────────────

  describe('getAddressType', function() {
    it('should return default for unknown chain without prompting', async function() {
      const result = await prompts.getAddressType({ chain: 'unknown_chain' });
      assert.strictEqual(result, 'pubkeyhash');
    });

    it('should return first address type for btc singleSig on ENTER', async function() {
      const promise = prompts.getAddressType({ chain: 'btc', network: 'livenet' });
      process.stdin.push(KEYSTROKES.ENTER);
      const result = await promise;
      assert.ok(typeof result === 'string' && result.length > 0);
    });

    it('should return first address type for btc multiSig on ENTER', async function() {
      const promise = prompts.getAddressType({ chain: 'btc', network: 'livenet', isMultiSig: true });
      process.stdin.push(KEYSTROKES.ENTER);
      const result = await promise;
      assert.ok(typeof result === 'string' && result.length > 0);
    });

    it('should return first address type for btc tss on ENTER', async function() {
      const promise = prompts.getAddressType({ chain: 'btc', network: 'livenet', isTss: true });
      process.stdin.push(KEYSTROKES.ENTER);
      const result = await promise;
      assert.ok(typeof result === 'string' && result.length > 0);
    });

    it('should use BITCORE_CLI_ADDRESS_TYPE env var as initial value', async function() {
      process.env['BITCORE_CLI_ADDRESS_TYPE'] = 'pubkeyhash';
      const promise = prompts.getAddressType({ chain: 'btc', network: 'livenet' });
      process.stdin.push(KEYSTROKES.ENTER); // confirms the initialValue (pubkeyhash)
      assert.strictEqual(await promise, 'pubkeyhash');
    });

    it('should throw UserCancelled when user cancels', async function() {
      const promise = prompts.getAddressType({ chain: 'btc', network: 'livenet' });
      process.stdin.push(KEYSTROKES.CTRL_C);
      await assert.rejects(() => promise, UserCancelled);
    });
  });

  // ─── getAction ──────────────────────────────────────────────────────────────

  describe('getAction', function() {
    it('should return menu by default on ENTER', async function() {
      const promise = prompts.getAction();
      process.stdin.push(KEYSTROKES.ENTER);
      assert.strictEqual(await promise, 'menu');
    });

    it('should return exit on ARROW_DOWN + ENTER (proves exit option exists)', async function() {
      const promise = prompts.getAction();
      process.stdin.push(KEYSTROKES.ARROW_DOWN);
      process.stdin.push(KEYSTROKES.ENTER);
      assert.strictEqual(await promise, 'exit');
    });

    it('should return exit when initialValue is exit', async function() {
      const promise = prompts.getAction({ initialValue: 'exit' });
      process.stdin.push(KEYSTROKES.ENTER);
      assert.strictEqual(await promise, 'exit');
    });

    it('should include and return a custom extra option', async function() {
      const promise = prompts.getAction({ options: [{ label: 'Custom', value: 'custom' }], initialValue: 'custom' });
      process.stdin.push(KEYSTROKES.ENTER);
      assert.strictEqual(await promise, 'custom');
    });
  });

  // ─── getFileName ────────────────────────────────────────────────────────────

  describe('getFileName', function() {
    it('should return the initialValue on ENTER', async function() {
      const promise = prompts.getFileName({ defaultValue: '/tmp/wallet.json' });
      process.stdin.push(KEYSTROKES.ENTER);
      assert.strictEqual(await promise, '/tmp/wallet.json');
    });

    it('should expand a leading tilde in the returned path', async function() {
      const promise = prompts.getFileName({ defaultValue: '~/wallets/test.json' });
      process.stdin.push(KEYSTROKES.ENTER);
      assert.strictEqual(await promise, os.homedir() + '/wallets/test.json');
    });

    it('should throw UserCancelled when user cancels', async function() {
      const promise = prompts.getFileName({ defaultValue: '/tmp/x.json' });
      process.stdin.push(KEYSTROKES.CTRL_C);
      await assert.rejects(() => promise, UserCancelled);
    });
  });
});
