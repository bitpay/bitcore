import assert from 'assert';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import * as prompt from '@clack/prompts';
import { Utils } from '../src/utils';

describe('Utils', function() {
  const sandbox = sinon.createSandbox();

  afterEach(function() {
    Utils.setVerbose(false);
    sandbox.restore();
  });

  // ─── die ────────────────────────────────────────────────────────────────────

  describe('die', function() {
    it('should print error message and exit with code 1', function() {
      const exitStub = sandbox.stub(process, 'exit');
      const consoleErrorStub = sandbox.stub(prompt.log, 'error');
      const errorMessage = 'Test error message';
      Utils.die(errorMessage);
      sinon.assert.calledOnce(consoleErrorStub);
      sinon.assert.calledWithExactly(consoleErrorStub, '!! ' + errorMessage);
      sinon.assert.calledOnce(exitStub);
      sinon.assert.calledWithExactly(exitStub, 1);
    });

    it('should print error stack in verbose mode', function() {
      Utils.setVerbose(true);
      const exitStub = sandbox.stub(process, 'exit');
      const logErrorStub = sandbox.stub(prompt.log, 'error');
      const err = new Error('boom');
      Utils.die(err);
      sinon.assert.calledOnce(logErrorStub);
      const arg = logErrorStub.firstCall.args[0] as string;
      assert.ok(arg.startsWith('!! '));
      assert.ok(arg.includes(err.stack!));
      sinon.assert.calledWithExactly(exitStub, 1);
    });

    it('should print toString for Error without stack in verbose mode', function() {
      Utils.setVerbose(true);
      const exitStub = sandbox.stub(process, 'exit');
      const logErrorStub = sandbox.stub(prompt.log, 'error');
      const err = new Error('no stack');
      delete err.stack;
      Utils.die(err);
      sinon.assert.calledOnce(logErrorStub);
      assert.strictEqual(logErrorStub.firstCall.args[0], '!! ' + err.toString());
      sinon.assert.calledWithExactly(exitStub, 1);
    });

    it('should call goodbye and exit for ExitPromptError', function() {
      const exitStub = sandbox.stub(process, 'exit');
      const consoleLogStub = sandbox.stub(console, 'log');
      const err = new Error('user cancelled');
      err.name = 'ExitPromptError';
      Utils.die(err);
      sinon.assert.calledOnce(consoleLogStub);
      assert.ok((consoleLogStub.firstCall.args[0] as string).startsWith('👋'));
      sinon.assert.calledWithExactly(exitStub, 1);
    });

    it('should do nothing when called with no argument', function() {
      const exitStub = sandbox.stub(process, 'exit');
      const logErrorStub = sandbox.stub(prompt.log, 'error');
      Utils.die();
      sinon.assert.notCalled(exitStub);
      sinon.assert.notCalled(logErrorStub);
    });
  });

  // ─── goodbye ────────────────────────────────────────────────────────────────

  describe('goodbye', function() {
    it('should log a 👋 message to console', function() {
      const consoleLogStub = sandbox.stub(console, 'log');
      Utils.goodbye();
      sinon.assert.calledOnce(consoleLogStub);
      assert.ok((consoleLogStub.firstCall.args[0] as string).startsWith('👋 '));
    });
  });

  // ─── setVerbose ─────────────────────────────────────────────────────────────

  describe('setVerbose', function() {
    it('should coerce truthy value to true', function() {
      // Validated indirectly via die behaviour
      Utils.setVerbose(true);
      const exitStub = sandbox.stub(process, 'exit');
      const logErrorStub = sandbox.stub(prompt.log, 'error');
      const err = new Error('verbose error');
      Utils.die(err);
      const arg = logErrorStub.firstCall.args[0] as string;
      assert.ok(arg.includes(err.stack!));
      sinon.assert.calledWithExactly(exitStub, 1);
    });
  });

  // ─── getWalletFileName ───────────────────────────────────────────────────────

  describe('getWalletFileName', function() {
    it('should return the wallet JSON path', function() {
      const result = Utils.getWalletFileName('myWallet', '/home/user/wallets');
      assert.strictEqual(result, path.join('/home/user/wallets', 'myWallet.json'));
    });
  });

  // ─── colorText ───────────────────────────────────────────────────────────────

  describe('colorText', function() {
    it('should wrap text in green ANSI codes', function() {
      const result = Utils.colorText('hello', 'green');
      assert.strictEqual(result, '\x1b[32mhello\x1b[0m');
    });

    it('should wrap text in red ANSI codes', function() {
      const result = Utils.colorText('error', 'red');
      assert.strictEqual(result, '\x1b[31merror\x1b[0m');
    });

    it('should wrap text in yellow ANSI codes', function() {
      const result = Utils.colorText('warn', 'yellow');
      assert.strictEqual(result, '\x1b[33mwarn\x1b[0m');
    });
  });

  // ─── text decorators ─────────────────────────────────────────────────────────

  describe('boldText', function() {
    it('should wrap text in bold ANSI codes', function() {
      assert.strictEqual(Utils.boldText('hi'), '\x1b[1mhi\x1b[0m');
    });
  });

  describe('italicText', function() {
    it('should wrap text in italic ANSI codes', function() {
      assert.strictEqual(Utils.italicText('hi'), '\x1b[3mhi\x1b[0m');
    });
  });

  describe('underlineText', function() {
    it('should wrap text in underline ANSI codes', function() {
      assert.strictEqual(Utils.underlineText('hi'), '\x1b[4mhi\x1b[0m');
    });
  });

  describe('strikeText', function() {
    it('should wrap text in strikethrough ANSI codes', function() {
      assert.strictEqual(Utils.strikeText('hi'), '\x1b[9mhi\x1b[0m');
    });
  });

  // ─── capitalize ──────────────────────────────────────────────────────────────

  describe('capitalize', function() {
    it('should capitalize first letter', function() {
      assert.strictEqual(Utils.capitalize('hello'), 'Hello');
    });

    it('should leave already-capitalized string unchanged', function() {
      assert.strictEqual(Utils.capitalize('World'), 'World');
    });

    it('should handle single character', function() {
      assert.strictEqual(Utils.capitalize('a'), 'A');
    });

    it('should handle empty string', function() {
      assert.strictEqual(Utils.capitalize(''), '');
    });
  });

  // ─── shortID ─────────────────────────────────────────────────────────────────

  describe('shortID', function() {
    it('should return the last 4 characters of an ID', function() {
      assert.strictEqual(Utils.shortID('abcdef1234'), '1234');
    });

    it('should return the full string when length <= 4', function() {
      assert.strictEqual(Utils.shortID('abc'), 'abc');
    });
  });

  // ─── confirmationId ──────────────────────────────────────────────────────────

  describe('confirmationId', function() {
    it('should parse hex xPubKeySignature and return decimal string', function() {
      // substring(-4) in JS is equivalent to substring(0) — returns entire string
      const sig = 'ff';
      const expected = parseInt(sig, 16).toString();
      assert.strictEqual(Utils.confirmationId({ xPubKeySignature: sig }), expected);
    });
  });

  // ─── parseAmount ─────────────────────────────────────────────────────────────

  describe('parseAmount', function() {
    let exitStub: sinon.SinonStub;

    beforeEach(function() {
      exitStub = sandbox.stub(process, 'exit');
    });

    it('should parse sat amount', function() {
      assert.strictEqual(Utils.parseAmount('1000 sat'), 1000);
    });

    it('should default to sat when no unit is given', function() {
      assert.strictEqual(Utils.parseAmount('500'), 500);
    });

    it('should parse btc amount', function() {
      assert.strictEqual(Utils.parseAmount('1 btc'), 100000000);
    });

    it('should parse fractional btc amount', function() {
      assert.strictEqual(Utils.parseAmount('0.001 btc'), 100000);
    });

    it('should parse bit amount', function() {
      assert.strictEqual(Utils.parseAmount('1 bit'), 100);
    });

    it('should be case-insensitive for units', function() {
      assert.strictEqual(Utils.parseAmount('1 BTC'), 100000000);
    });

    it('should die on invalid amount string', function() {
      sandbox.stub(prompt.log, 'error');
      assert.throws(() => Utils.parseAmount('not_a_number btc'));
      sinon.assert.calledWithExactly(exitStub, 1);
    });
  });

  // ─── renderAmount ────────────────────────────────────────────────────────────

  describe('renderAmount', function() {
    it('should render BTC amount from satoshis', function() {
      assert.strictEqual(Utils.renderAmount('btc', 100000000), '1 BTC');
    });

    it('should render fractional BTC amount', function() {
      assert.strictEqual(Utils.renderAmount('btc', 100000), '0.001 BTC');
    });

    it('should uppercase the currency label', function() {
      const result = Utils.renderAmount('ltc', 1e8);
      assert.ok(result.endsWith(' LTC'));
    });
  });

  // ─── renderStatus ────────────────────────────────────────────────────────────

  describe('renderStatus', function() {
    it('should return "complete" as-is', function() {
      assert.strictEqual(Utils.renderStatus('complete'), 'complete');
    });

    it('should colorize non-complete statuses', function() {
      const result = Utils.renderStatus('pending');
      assert.ok(result.includes('pending'));
      assert.ok(result.includes('\x1b['));
    });
  });

  // ─── parseMN ─────────────────────────────────────────────────────────────────

  describe('parseMN', function() {
    it('should parse m-n format', function() {
      assert.deepStrictEqual(Utils.parseMN('2-3'), [2, 3]);
    });

    it('should parse mofn format', function() {
      assert.deepStrictEqual(Utils.parseMN('2of3'), [2, 3]);
    });

    it('should parse m-of-n format', function() {
      assert.deepStrictEqual(Utils.parseMN('2-of-3'), [2, 3]);
    });

    it('should parse 1-of-1', function() {
      assert.deepStrictEqual(Utils.parseMN('1-of-1'), [1, 1]);
    });

    it('should throw when m > n', function() {
      assert.throws(() => Utils.parseMN('3-2'), /Invalid m-n parameter/);
    });

    it('should throw when no parameter provided', function() {
      assert.throws(() => Utils.parseMN(''), /No m-n parameter/);
    });

    it('should throw on invalid format', function() {
      assert.throws(() => Utils.parseMN('abc'), /Invalid m-n parameter/);
    });
  });

  // ─── getSegwitInfo ───────────────────────────────────────────────────────────

  describe('getSegwitInfo', function() {
    it('should return native segwit for witnesspubkeyhash', function() {
      const info = Utils.getSegwitInfo('witnesspubkeyhash');
      assert.strictEqual(info.useNativeSegwit, true);
      assert.strictEqual(info.segwitVersion, 0);
    });

    it('should return native segwit for witnessscripthash', function() {
      const info = Utils.getSegwitInfo('witnessscripthash');
      assert.strictEqual(info.useNativeSegwit, true);
      assert.strictEqual(info.segwitVersion, 0);
    });

    it('should return native segwit v1 for taproot', function() {
      const info = Utils.getSegwitInfo('taproot');
      assert.strictEqual(info.useNativeSegwit, true);
      assert.strictEqual(info.segwitVersion, 1);
    });

    it('should return non-native segwit for pubkeyhash', function() {
      const info = Utils.getSegwitInfo('pubkeyhash');
      assert.strictEqual(info.useNativeSegwit, false);
      assert.strictEqual(info.segwitVersion, 0);
    });
  });

  // ─── getFeeUnit ──────────────────────────────────────────────────────────────

  describe('getFeeUnit', function() {
    it('should return sat/kB for btc', function() {
      assert.strictEqual(Utils.getFeeUnit('btc'), 'sat/kB');
    });

    it('should return sat/kB for bch', function() {
      assert.strictEqual(Utils.getFeeUnit('bch'), 'sat/kB');
    });

    it('should return sat/kB for doge', function() {
      assert.strictEqual(Utils.getFeeUnit('doge'), 'sat/kB');
    });

    it('should return sat/kB for ltc', function() {
      assert.strictEqual(Utils.getFeeUnit('ltc'), 'sat/kB');
    });

    it('should return drops for xrp', function() {
      assert.strictEqual(Utils.getFeeUnit('xrp'), 'drops');
    });

    it('should return lamports for sol', function() {
      assert.strictEqual(Utils.getFeeUnit('sol'), 'lamports');
    });

    it('should return gwei for eth (default)', function() {
      assert.strictEqual(Utils.getFeeUnit('eth'), 'gwei');
    });

    it('should be case-insensitive', function() {
      assert.strictEqual(Utils.getFeeUnit('BTC'), 'sat/kB');
    });
  });

  // ─── displayFeeRate ──────────────────────────────────────────────────────────

  describe('displayFeeRate', function() {
    it('should display sat/kB chains as sat/B', function() {
      assert.strictEqual(Utils.displayFeeRate('btc', 1000), '1 sat/B');
    });

    it('should display eth fee rate as Gwei', function() {
      assert.strictEqual(Utils.displayFeeRate('eth', 1e9), '1 Gwei');
    });

    it('should display xrp fee rate as drops', function() {
      assert.strictEqual(Utils.displayFeeRate('xrp', 100), '100 drops');
    });

    it('should display sol fee rate as lamports', function() {
      assert.strictEqual(Utils.displayFeeRate('sol', 5000), '5000 lamports');
    });
  });

  // ─── convertFeeRate ──────────────────────────────────────────────────────────

  describe('convertFeeRate', function() {
    it('should convert btc fee rate to sat/B', function() {
      assert.strictEqual(Utils.convertFeeRate('btc', 2000), 2);
    });

    it('should convert eth fee rate to Gwei', function() {
      assert.strictEqual(Utils.convertFeeRate('eth', 2e9), 2);
    });
  });

  // ─── amountFromSats ──────────────────────────────────────────────────────────

  describe('amountFromSats', function() {
    it('should convert sats to BTC', function() {
      assert.strictEqual(Utils.amountFromSats('btc', 100000000), '1');
    });

    it('should convert sats to fractional BTC', function() {
      assert.strictEqual(Utils.amountFromSats('btc', 100000), '0.001');
    });

    it('should convert sats to XRP', function() {
      assert.strictEqual(Utils.amountFromSats('xrp', 1000000), '1');
    });

    it('should convert sats to SOL', function() {
      assert.strictEqual(Utils.amountFromSats('sol', 1e9), '1');
    });

    it('should use token opts when decimals are provided', function() {
      const opts: any = { decimals: true, toSatoshis: 1e6, precision: 2 };
      assert.strictEqual(Utils.amountFromSats('usdc', 1000000, opts), 1);
    });

    it('should be case-insensitive for chain', function() {
      assert.strictEqual(Utils.amountFromSats('BTC', 100000000), '1');
    });
  });

  // ─── amountToSats ────────────────────────────────────────────────────────────

  describe('amountToSats', function() {
    it('should convert BTC to sats', function() {
      assert.strictEqual(Utils.amountToSats('btc', 1), BigInt(1e8));
    });

    it('should convert XRP to drops', function() {
      assert.strictEqual(Utils.amountToSats('xrp', 1), BigInt(1e6));
    });

    it('should convert SOL to lamports', function() {
      assert.strictEqual(Utils.amountToSats('sol', 1), BigInt(1e9));
    });

    it('should use token opts when provided', function() {
      const opts: any = { toSatoshis: 1e6 };
      assert.strictEqual(Utils.amountToSats('usdc', 1, opts), BigInt(1e6));
    });
  });

  // ─── maxLength ───────────────────────────────────────────────────────────────

  describe('maxLength', function() {
    it('should return short string unchanged', function() {
      assert.strictEqual(Utils.maxLength('short'), 'short');
    });

    it('should truncate long string with ellipsis', function() {
      const long = 'a'.repeat(55);
      const result = Utils.maxLength(long);
      const halfLength = Math.floor((50 - 2) / 2);
      assert.strictEqual(result, 'a'.repeat(halfLength) + '...' + 'a'.repeat(halfLength));
    });

    it('should respect custom maxLength', function() {
      const result = Utils.maxLength('hello world', 8);
      const halfLength = Math.floor((8 - 2) / 2);
      assert.strictEqual(result, 'hel' + '...' + 'rld');
      assert.ok(result.includes('...'));
    });

    it('should return string unchanged when exactly at maxLength', function() {
      const str = 'a'.repeat(50);
      assert.strictEqual(Utils.maxLength(str), str);
    });
  });

  // ─── jsonParseWithBuffer ─────────────────────────────────────────────────────

  describe('jsonParseWithBuffer', function() {
    it('should parse plain JSON', function() {
      const result = Utils.jsonParseWithBuffer('{"foo":"bar"}');
      assert.deepStrictEqual(result, { foo: 'bar' });
    });

    it('should revive Buffer objects', function() {
      const data = [1, 2, 3];
      const json = JSON.stringify({ buf: { type: 'Buffer', data } });
      const result = Utils.jsonParseWithBuffer(json);
      assert.ok(result.buf instanceof Buffer);
      assert.deepStrictEqual([...result.buf], data);
    });

    it('should leave non-Buffer objects unchanged', function() {
      const json = JSON.stringify({ num: 42, str: 'hello', arr: [1, 2] });
      const result = Utils.jsonParseWithBuffer(json);
      assert.deepStrictEqual(result, { num: 42, str: 'hello', arr: [1, 2] });
    });
  });

  // ─── compactString ───────────────────────────────────────────────────────────

  describe('compactString', function() {
    it('should return short string unchanged', function() {
      assert.strictEqual(Utils.compactString('hello', 10), 'hello');
    });

    it('should compact long string with ellipsis (even split)', function() {
      const str = 'abcdefghijklmnopqrstuvwxyz';
      assert.strictEqual(Utils.compactString(str, 11), 'abcd...wxyz');
    });

    it('should compact long string with ellipsis (odd split)', function() {
      const str = 'abcdefghijklmnopqrstuvwxyz';
      // length=10: pieceLen=(10-3)/2=3.5 → floor=3, ceil=4
      const result = Utils.compactString(str, 10);
      assert.strictEqual(result, 'abc...wxyz');
    });

    it('should use default length of 19', function() {
      const str = 'a'.repeat(30);
      const result = Utils.compactString(str);
      assert.ok(result.includes('...'));
      assert.ok(result.length <= 19);
    });

    it('should throw when length < 5', function() {
      assert.throws(() => Utils.compactString('hello', 4), /Length must be at least 5/);
    });
  });

  // ─── compactAddress ──────────────────────────────────────────────────────────

  describe('compactAddress', function() {
    it('should return first 8 and last 8 chars separated by ...', function() {
      const addr = '1234567890abcdef1234567890abcdef';
      const result = Utils.compactAddress(addr);
      assert.strictEqual(result, '12345678...90abcdef');
    });
  });

  // ─── formatDate ──────────────────────────────────────────────────────────────

  describe('formatDate', function() {
    it('should format a Date object to a non-empty string', function() {
      const result = Utils.formatDate(new Date('2024-01-15T12:00:00Z'));
      assert.ok(typeof result === 'string' && result.length > 0);
    });

    it('should accept a numeric timestamp', function() {
      const ts = Date.now();
      const result = Utils.formatDate(ts);
      assert.ok(typeof result === 'string' && result.length > 0);
    });

    it('should accept a date string', function() {
      const result = Utils.formatDate('2024-06-01');
      assert.ok(typeof result === 'string' && result.length > 0);
    });
  });

  // ─── formatDateCompact ───────────────────────────────────────────────────────

  describe('formatDateCompact', function() {
    it('should return a shorter formatted date string', function() {
      const full = Utils.formatDate(new Date('2024-01-15T12:00:00Z'));
      const compact = Utils.formatDateCompact(new Date('2024-01-15T12:00:00Z'));
      assert.ok(compact.length < full.length);
    });
  });

  // ─── replaceTilde ────────────────────────────────────────────────────────────

  describe('replaceTilde', function() {
    it('should replace leading ~ with home directory', function() {
      const result = Utils.replaceTilde('~/wallets/test.json');
      assert.strictEqual(result, path.join(os.homedir(), '/wallets/test.json'));
    });

    it('should leave paths without ~ unchanged', function() {
      const p = '/absolute/path/file.json';
      assert.strictEqual(Utils.replaceTilde(p), p);
    });

    it('should leave relative paths without ~ unchanged', function() {
      assert.strictEqual(Utils.replaceTilde('relative/path'), 'relative/path');
    });
  });

  // ─── getChainColor ───────────────────────────────────────────────────────────

  describe('getChainColor', function() {
    const cases: [string, string][] = [
      ['btc', 'orange'],
      ['bch', 'green'],
      ['doge', 'beige'],
      ['ltc', 'lightgray'],
      ['eth', 'blue'],
      ['matic', 'pink'],
      ['xrp', 'darkgray'],
      ['sol', 'purple'],
    ];

    for (const [chain, color] of cases) {
      it(`should return ${color} for ${chain}`, function() {
        assert.strictEqual(Utils.getChainColor(chain), color);
      });
    }

    it('should be case-insensitive', function() {
      assert.strictEqual(Utils.getChainColor('BTC'), 'orange');
    });
  });

  // ─── colorTextByChain ────────────────────────────────────────────────────────

  describe('colorTextByChain', function() {
    it('should return colored text for a known chain', function() {
      const result = Utils.colorTextByChain('btc', 'Bitcoin');
      assert.ok(result.includes('Bitcoin'));
      assert.ok(result.includes('\x1b['));
    });

    it('should return bold text for an unknown chain', function() {
      const result = Utils.colorTextByChain('unknown', 'Token');
      assert.strictEqual(result, Utils.boldText('Token'));
    });
  });

  // ─── colorizeChain ───────────────────────────────────────────────────────────

  describe('colorizeChain', function() {
    it('should colorize the chain name itself', function() {
      const result = Utils.colorizeChain('btc');
      assert.ok(result.includes('btc'));
      assert.ok(result.includes('\x1b['));
    });
  });
});