import { spawn } from 'child_process';
import assert from 'assert';
import sinon from 'sinon';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Transform } from 'stream';
import { Encryption } from '@bitpay-labs/bitcore-wallet-client';
import * as helpers from './helpers';
import * as walletData from './data/walletsData';
import * as promptsModule from '../src/prompts';
import { Utils } from '../src/utils';
import { Wallet } from '../src/wallet';

describe('Wallet', function() {
  this.timeout(Math.max(this['_timeout'] || 0, 5000));
  const { KEYSTROKES, WALLETS, OUTPUT_END_SEQ } = helpers.CONSTANTS;
  const { CLI_EXEC, CLI_OPTS, COMMON_OPTS, DIR } = WALLETS;
  const cmdOpts = [...COMMON_OPTS, '--dir', DIR];

  before(async function() {
    await helpers.startBws();
    await helpers.loadWalletData(walletData.btcSingleSigWallet);
    sinon.stub(process, 'exit').throws(new Error('process.exit was called')); // prevent accidental exits during test
  });

  after(async function() {
    await helpers.stopBws();
    sinon.restore();
  });

  // ─── lockLoadedWallet ───────────────────────────────────────────────────────

  describe('lockLoadedWallet', function() {
    it('should lock the loaded wallet', function(done) {
      const expectedErrorLogs = [{
        regex: /EEXIST: file already exists/,
        assertMissMessage: 'Expected console.error to be called with EEXIST error for wallet lock file',
        isHit: false
      }];

      const stepInputs = [
        // Checkpoint1: Upon wallet load
        [KEYSTROKES.ARROW_UP], // Proposals -> Exit
        [KEYSTROKES.ENTER], // Exit
      ];
      let step = 0;
      let checkpointOutput = '';
      // stepInputs indexes corresponding to checkpoints in test flow where we want to assert on CLI output
      const checkpoints = new Set([0]);
      const io = new Transform({
        encoding: 'utf-8',
        transform: async function (chunk, encoding, respond) {
          try {
            chunk = chunk.toString();
            if (checkpoints.has(step)) {
              checkpointOutput += chunk;
            } else {
              checkpointOutput = '';
            }

            // Uncomment to see CLI output during test
            // process.stdout.write(chunk);

            const isStep = chunk.endsWith(OUTPUT_END_SEQ);
            if (isStep) {
              switch (step) {
                default:
                  break; // no-op for non-checkpoint steps
                case Array.from(checkpoints)[0]:
                  // Try to load the same wallet in a second process while the first one is still running, should get an error about wallet being locked
                  let secondOutput = '';
                  await new Promise<void>((resolve, reject) => {
                    const io2 = new Transform({
                      encoding: 'utf-8',
                      transform(chunk, encoding, respond) {
                        chunk = chunk.toString();
                        secondOutput += chunk;
                        // Uncomment to see CLI output during test
                        // process.stdout.write(chunk);

                        { // This block is a contingency in case this second wallet doesn't exit like it's supposed to
                          if (chunk.endsWith(OUTPUT_END_SEQ)) {
                            this.push(KEYSTROKES.ARROW_UP);
                            this.push(KEYSTROKES.ENTER);
                          };

                          if (chunk.includes('👋')) {
                            child2.stdin.end(); // send EOF to child so it can exit cleanly
                          }
                        }

                        respond();
                      }
                    });

                    const child2 = spawn('node', [CLI_EXEC, WALLETS.BTC.SINGLE_SIG, ...cmdOpts], CLI_OPTS);
                    child2.stderr.pipe(new Transform({
                      encoding: 'utf-8',
                      transform(chunk, encoding, respond) {
                        chunk = chunk.toString();
                        const expectedErrorLog = expectedErrorLogs.find(l => l.regex.test(chunk));
                        if (expectedErrorLog) {
                          expectedErrorLog.isHit = true;
                        }
                        respond();
                      }
                    }));
                    child2.stdout.pipe(io2).pipe(child2.stdin);
                    io2.on('close', () => {
                      try {
                        assert.match(secondOutput, /!! Wallet is already open in another process./);
                        resolve();
                      } catch (e) {
                        reject(e);
                      }
                    });
                  });
                  break;
              }

              for (const input of stepInputs[step]) {
                this.push(input);
              }
              step++;
            } else if (chunk.includes('Error:')) {
              return respond(chunk);
            }
            if (chunk.includes('👋')) {
              child.stdin.end(); // send EOF to child so it can exit cleanly
            }
            respond();
          } catch (e) {
            return respond(e);
          }
        }
      });
      const child = spawn('node', [CLI_EXEC, WALLETS.BTC.SINGLE_SIG, ...cmdOpts], CLI_OPTS);
      child.stderr.pipe(process.stderr);
      child.stdout.pipe(io).pipe(child.stdin);
      io.on('error', (e) => {
        done(e);
      });
      child.on('error', (e) => {
        done(e);
      });
      child.on('close', (code) => {
        try {
          assert.equal(code, 0);
          assert.equal(expectedErrorLogs.every(l => l.isHit), true, 'Some expected console.error logs were not hit: ' + JSON.stringify(expectedErrorLogs));
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it('should handle stale lock file', function(done) {
      const lockFileName = Utils.getWalletLockFileName(WALLETS.BTC.SINGLE_SIG, DIR);
      fs.writeFileSync(lockFileName, '999999', { mode: 0o444 }); // create a lock file with a PID that doesn't exist
      assert(fs.readFileSync(lockFileName, 'utf-8') === '999999', 'Failed to create lock file with test PID');

      const stepInputs = [
        // Checkpoint1: Upon wallet load
        [KEYSTROKES.ARROW_UP], // Proposals -> Exit
        [KEYSTROKES.ENTER], // Exit
      ];
      let step = 0;
      let checkpointOutput = '';
      // stepInputs indexes corresponding to checkpoints in test flow where we want to assert on CLI output
      const checkpoints = new Set([0]);
      const io = new Transform({
        encoding: 'utf-8',
        transform: async function (chunk, encoding, respond) {
          try {
            chunk = chunk.toString();
            if (checkpoints.has(step)) {
              checkpointOutput += chunk;
            } else {
              checkpointOutput = '';
            }

            // Uncomment to see CLI output during test
            // process.stdout.write(chunk);

            const isStep = chunk.endsWith(OUTPUT_END_SEQ);
            if (isStep) {
              switch (step) {
                default:
                  break; // no-op for non-checkpoint steps
                case Array.from(checkpoints)[0]:
                  const lines = helpers.decolor(checkpointOutput).split(os.EOL);
                  const mainmenuLine = lines.findIndex(l => l.match(`[  Main Menu - ${WALLETS.BTC.SINGLE_SIG}  ]`));
                  assert(mainmenuLine > -1, 'Did not reach main menu. Got: ' + checkpointOutput);
                  assert(fs.readFileSync(lockFileName, 'utf-8') === child.pid.toString(), 'Lock file does not match child PID');
                  break;
              }

              for (const input of stepInputs[step]) {
                this.push(input);
              }
              step++;
            } else if (chunk.includes('Error:')) {
              return respond(chunk);
            }
            if (chunk.includes('👋')) {
              child.stdin.end(); // send EOF to child so it can exit cleanly
            }
            respond();
          } catch (e) {
            return respond(e);
          }
        }
      });
      const child = spawn('node', [CLI_EXEC, WALLETS.BTC.SINGLE_SIG, ...cmdOpts], CLI_OPTS);
      child.stderr.pipe(process.stderr);
      child.stdout.pipe(io).pipe(child.stdin);
      io.on('error', (e) => {
        done(e);
      });
      child.on('error', (e) => {
        done(e);
      });
      child.on('close', (code) => {
        try {
          assert.equal(code, 0);
          done();
        } catch (e) {
          done(e);
        }
      });
    });

  });

  describe('save', function() {
    const { TEMP_DIR, BTC, PASSWORD } = WALLETS;
    let wallet: Wallet;
    const sandbox = sinon.createSandbox();

    beforeEach(async function() {
      helpers.cleanupTempWallets();
      fs.mkdirSync(TEMP_DIR, { recursive: true });
      fs.copyFileSync(path.join(DIR, BTC.SINGLE_SIG + '.json'), path.join(TEMP_DIR, BTC.SINGLE_SIG + '.json'));
      wallet = new Wallet({ name: BTC.SINGLE_SIG, dir: TEMP_DIR });
      await wallet.getClient({ mustExist: true, doNotComplete: true });
    });

    afterEach(function() {
      helpers.cleanupTempWallets();
      sandbox.restore();
    });

    it('should not expose sensitive key data in saved file', async function() {
      const saveStub = sandbox.stub(wallet.storage, 'save').resolves();
      try {
        await wallet.save();
        assert.ok(saveStub.calledOnce, 'storage.save should be called once');
        const saved = JSON.parse(saveStub.firstCall.args[0]);
        assert.ok(saved.credentials, 'saved data should include credentials');
        assert.ok(saved.key, 'saved data should include key');
        assert.strictEqual(saved.key.xPrivKey, null, 'xPrivKey must not be saved in plaintext');
        assert.strictEqual(saved.key.mnemonic, null, 'mnemonic must not be saved in plaintext');
        assert.ok(saved.key.xPrivKeyEncrypted, 'encrypted key material must be present');
      } finally {
        saveStub.restore();
      }
    });

    it('should write wallet data to disk', async function() {
      await wallet.save();
      const content = fs.readFileSync(path.join(TEMP_DIR, BTC.SINGLE_SIG + '.json'), 'utf-8');
      const saved = JSON.parse(content);
      assert.ok(saved.credentials, 'saved file should include credentials');
      assert.ok(saved.key, 'saved file should include key');
      assert.strictEqual(saved.key.xPrivKey, null, 'xPrivKey must not be written in plaintext');
    });

    it('should encrypt everything when encryptAll is true', async function() {
      sandbox.stub(promptsModule, 'getPassword').resolves(PASSWORD);
      await wallet.save({ encryptAll: true });
      const content = fs.readFileSync(path.join(TEMP_DIR, BTC.SINGLE_SIG + '.json'), 'utf-8');
      const saved = JSON.parse(content);
      assert.ok(saved.ct, 'saved file should be an encrypted blob');
      assert.ok(!saved.credentials, 'saved file should not include credentials');
      assert.ok(!saved.key, 'saved file should not include key');
      assert.strictEqual(saved.iter, 800000, 'exported file must be present with correct iteration count');
    });

    it('should call Utils.die if wallet data is not loaded', async function() {
      const unloadedWallet = new Wallet({ name: 'nonexistent', dir: TEMP_DIR });
      await assert.rejects(
        () => unloadedWallet.save(),
        /process.exit was called/
      );
    });
  });

  // ─── export ────────────────────────────────────────────────────────────────

  describe('export', function() {
    const { TEMP_DIR, BTC, PASSWORD } = WALLETS;
    const sandbox = sinon.createSandbox();
    let wallet: Wallet;
    let getPasswordStub: sinon.SinonStub;

    beforeEach(async function() {
      helpers.cleanupTempWallets();
      fs.mkdirSync(TEMP_DIR, { recursive: true });
      fs.copyFileSync(path.join(DIR, BTC.SINGLE_SIG + '.json'), path.join(TEMP_DIR, BTC.SINGLE_SIG + '.json'));
      wallet = new Wallet({ name: BTC.SINGLE_SIG, dir: TEMP_DIR });
      await wallet.getClient({ mustExist: true, doNotComplete: true });
      getPasswordStub = sandbox.stub(promptsModule, 'getPassword').callsFake(async function(_, opts) {
        opts.validate(PASSWORD);
      });
    });

    afterEach(function() {
      sandbox.restore();
      helpers.cleanupTempWallets();
    });

    it('should export wallet with decrypted key when no exportPassword', async function() {
      const exportFile = path.join(TEMP_DIR, 'export', 'wallet.json');
      await wallet.export({ filename: exportFile });
      assert.ok(fs.existsSync(exportFile), 'export file should exist');
      const exported = JSON.parse(fs.readFileSync(exportFile, 'utf-8'));
      assert.ok(exported.credentials, 'export should include credentials');
      assert.ok(exported.key, 'export should include key');
      assert.ok(exported.key.xPrivKey, 'exported key should have plaintext xPrivKey');
      assert.ok(!exported.key.xPrivKeyEncrypted, 'exported key should not retain the encrypted form');
    });

    it('should export wallet as encrypted blob when exportPassword is provided', async function() {
      const exportFile = path.join(TEMP_DIR, 'wallet-encrypted.json');
      const exportPassword = 'export-secret-456';
      await wallet.export({ filename: exportFile, exportPassword });
      assert.ok(fs.existsSync(exportFile), 'export file should exist');
      const raw = JSON.parse(fs.readFileSync(exportFile, 'utf-8'));
      assert.ok(raw.ct, 'exported file should be an encrypted blob');
      assert.ok(!raw.credentials, 'credentials must not be in plaintext');
      assert.strictEqual(raw.iter, 800000, 'exported file must be present with correct iteration count');
      const decrypted = JSON.parse(Encryption.decryptWithPassword(raw, exportPassword).toString());
      assert.ok(decrypted.credentials, 'decrypted export should have credentials');
      assert.ok(decrypted.key?.xPrivKey, 'decrypted key should have plaintext xPrivKey');
    });

    it('should export wallet as read-only with no key', async function() {
      const exportFile = path.join(TEMP_DIR, 'wallet-readonly.json');
      await wallet.export({ filename: exportFile, readOnly: true });
      assert.ok(fs.existsSync(exportFile), 'export file should exist');
      const exported = JSON.parse(fs.readFileSync(exportFile, 'utf-8'));
      assert.ok(exported.credentials, 'export should include credentials');
      assert.strictEqual(exported.key, undefined, 'read-only export should not include a key');
      assert.ok(!getPasswordStub.called, 'should not prompt for password on read-only export');
    });

    it('should create parent directories if they do not exist', async function() {
      const exportFile = path.join(TEMP_DIR, 'deep', 'nested', 'dirs', 'wallet.json');
      await wallet.export({ filename: exportFile, readOnly: true });
      assert.ok(fs.existsSync(exportFile), 'export file should be created even with missing parent dirs');
    });
  });
});