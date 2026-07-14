import assert from 'assert';
import fs from 'fs';
import path from 'path';
import sinon from 'sinon';
import * as prompt from '@clack/prompts';
import { FileStorage } from '../src/filestorage';
import { CONSTANTS } from './helpers';

describe('FileStorage', function() {
  const sandbox = sinon.createSandbox();
  const { TEMP_DIR } = CONSTANTS.WALLETS;

  before(function() {
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmdirSync(TEMP_DIR, { recursive: true });
    }
  });

  afterEach(function() {
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmdirSync(TEMP_DIR, { recursive: true });
    }
  });

  afterEach(function() {
    sandbox.restore();
  });

  // ─── constructor ─────────────────────────────────────────────────────────────

  describe('constructor', function() {
    it('should set filename from opts', function() {
      const filename = path.join(TEMP_DIR, 'test.json');
      const storage = new FileStorage({ filename });
      assert.strictEqual(storage.filename, filename);
    });

    it('should throw when filename is empty string', function() {
      assert.throws(() => new FileStorage({ filename: '' }), /Please set wallet filename/);
    });
  });

  // ─── getName ─────────────────────────────────────────────────────────────────

  describe('getName', function() {
    it('should return the filename', function() {
      const filename = path.join(TEMP_DIR, 'wallet.json');
      const storage = new FileStorage({ filename });
      assert.strictEqual(storage.getName(), filename);
    });
  });

  // ─── save ────────────────────────────────────────────────────────────────────

  describe('save', function() {
    it('should write data to the file', async function() {
      const filename = path.join(TEMP_DIR, 'wallet.json');
      const storage = new FileStorage({ filename });
      const data = JSON.stringify({ key: 'value' });
      await storage.save(data);
      const written = await fs.promises.readFile(filename, 'utf8');
      assert.strictEqual(written, data);
    });

    it('should create parent directories if they do not exist', async function() {
      const filename = path.join(TEMP_DIR, 'nested', 'deep', 'wallet.json');
      const storage = new FileStorage({ filename });
      await storage.save('{}');
      assert.ok(fs.existsSync(filename));
    });

    it('should overwrite an existing file', async function() {
      if (!fs.existsSync(TEMP_DIR))
        fs.mkdirSync(TEMP_DIR, { recursive: true });
      const filename = path.join(TEMP_DIR, 'wallet.json');
      await fs.promises.writeFile(filename, 'old data');
      const storage = new FileStorage({ filename });
      await storage.save('new data');
      const written = await fs.promises.readFile(filename, 'utf8');
      assert.strictEqual(written, 'new data');
    });
  });

  // ─── load ────────────────────────────────────────────────────────────────────

  describe('load', function() {
    it('should load and parse JSON from the file', async function() {
      if (!fs.existsSync(TEMP_DIR))
        fs.mkdirSync(TEMP_DIR, { recursive: true });
      const filename = path.join(TEMP_DIR, 'wallet.json');
      const obj = { name: 'testWallet', chain: 'btc' };
      await fs.promises.writeFile(filename, JSON.stringify(obj));
      const storage = new FileStorage({ filename });
      const result = await storage.load();
      assert.deepStrictEqual(result, obj);
    });

    it('should revive Buffer values from JSON', async function() {
      if (!fs.existsSync(TEMP_DIR))
        fs.mkdirSync(TEMP_DIR, { recursive: true });
      const filename = path.join(TEMP_DIR, 'wallet.json');
      const obj = { data: { type: 'Buffer', data: [1, 2, 3] } };
      await fs.promises.writeFile(filename, JSON.stringify(obj));
      const storage = new FileStorage({ filename });
      const result = await storage.load();
      assert.ok(result.data instanceof Buffer);
      assert.deepStrictEqual([...result.data], [1, 2, 3]);
    });

    it('should call Utils.die and return undefined when file does not exist', async function() {
      const exitStub = sandbox.stub(process, 'exit');
      const errorStub = sandbox.stub(prompt.log, 'error');
      const storage = new FileStorage({ filename: path.join(TEMP_DIR, 'nonexistent.json') });
      const result = await storage.load();
      assert.strictEqual(result, undefined);
      sinon.assert.calledWithExactly(errorStub, '!! Invalid input file');
      sinon.assert.calledWithExactly(exitStub, 1);
    });

    it('should call Utils.die on invalid JSON', async function() {
      if (!fs.existsSync(TEMP_DIR))
        fs.mkdirSync(TEMP_DIR, { recursive: true });
      const filename = path.join(TEMP_DIR, 'bad.json');
      await fs.promises.writeFile(filename, 'not valid json {{');
      const exitStub = sandbox.stub(process, 'exit');
      const errorStub = sandbox.stub(prompt.log, 'error');
      const storage = new FileStorage({ filename });
      const result = await storage.load();
      assert.strictEqual(result, undefined);
      sinon.assert.calledWithExactly(errorStub, '!! Invalid input file');
      sinon.assert.calledWithExactly(exitStub, 1);
    });
  });

  // ─── exists ──────────────────────────────────────────────────────────────────

  describe('exists', function() {
    it('should return true when the file exists', async function() {
      if (!fs.existsSync(TEMP_DIR))
        fs.mkdirSync(TEMP_DIR, { recursive: true });
      const filename = path.join(TEMP_DIR, 'wallet.json');
      await fs.promises.writeFile(filename, '{}');
      const storage = new FileStorage({ filename });
      assert.strictEqual(storage.exists(), true);
    });

    it('should return false when the file does not exist', function() {
      const storage = new FileStorage({ filename: path.join(TEMP_DIR, 'missing.json') });
      assert.strictEqual(storage.exists(), false);
    });

    it('should reflect the current filesystem state', async function() {
      if (!fs.existsSync(TEMP_DIR))
        fs.mkdirSync(TEMP_DIR, { recursive: true });
      const filename = path.join(TEMP_DIR, 'wallet.json');
      const storage = new FileStorage({ filename });
      assert.strictEqual(storage.exists(), false);
      await fs.promises.writeFile(filename, '{}');
      assert.strictEqual(storage.exists(), true);
    });
  });
});
