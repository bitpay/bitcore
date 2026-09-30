import { spawn } from 'child_process';
import assert from 'assert';
import sinon from 'sinon';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Transform } from 'stream';
import { Encryption, Key } from '@bitpay-labs/bitcore-wallet-client';
import * as prompt from '@clack/prompts';
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

  describe('updatePassword', function() {
    const { BTC, DIR, PASSWORD } = WALLETS;
    const newPassword = 'replacement-password';
    const sandbox = sinon.createSandbox();
    let wallet: Wallet;
    let tempDir: string;
    let walletFile: string;
    let stateDir: string;

    beforeEach(async function() {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bitcore-cli-password-'));
      walletFile = path.join(tempDir, BTC.SINGLE_SIG + '.json');
      fs.copyFileSync(path.join(DIR, BTC.SINGLE_SIG + '.json'), walletFile);
      wallet = new Wallet({ name: BTC.SINGLE_SIG, dir: tempDir });
      sandbox.stub(wallet as any, 'lockLoadedWallet');
      await wallet.getClient({ mustExist: true, doNotComplete: true });
      stateDir = await wallet.storage.getStatePath();
    });

    afterEach(function() {
      sandbox.restore();
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('re-encrypts the saved key and state files with the new password', async function() {
      const stateFile = path.join(stateDir, 'proposal.json');
      const stateData = Buffer.from('transaction proposal state');
      fs.writeFileSync(stateFile, JSON.stringify(Encryption.encryptWithPassword(stateData, PASSWORD)));
      fs.mkdirSync(path.join(stateDir, 'subdirectory'));

      await wallet.updatePassword(PASSWORD, newPassword, { silent: true });

      const saved = JSON.parse(fs.readFileSync(walletFile, 'utf-8'));
      const savedKey = new Key({ seedType: 'object', seedData: saved.key });
      assert.strictEqual(saved.key.xPrivKey, null);
      assert.strictEqual(saved.key.mnemonic, null);
      assert.strictEqual(savedKey.checkPassword(newPassword), true);
      assert.strictEqual(savedKey.checkPassword(PASSWORD), false);
      const updatedState = fs.readFileSync(stateFile, 'utf-8');
      assert.deepStrictEqual(Encryption.decryptWithPassword(updatedState, newPassword), stateData);
      assert.throws(() => Encryption.decryptWithPassword(updatedState, PASSWORD));
    });

    it('re-encrypts both ECDSA and EDDSA keys for a SOL wallet', async function() {
      const solName = 'sol-password';
      const solFile = path.join(tempDir, solName + '.json');
      const key = new Key({
        seedType: 'mnemonic',
        seedData: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        password: PASSWORD,
        encryptionOpts: { iter: 1000 }
      });
      const credentials = key.createCredentials(PASSWORD, {
        coin: 'sol',
        chain: 'sol',
        network: 'testnet',
        account: 0,
        n: 1
      });
      const originalEddsaKey = key.get(PASSWORD, 'EDDSA').xPrivKey;
      fs.writeFileSync(solFile, JSON.stringify({ key: key.toObj(), credentials: credentials.toObj() }));
      wallet = new Wallet({ name: solName, dir: tempDir });
      sandbox.stub(wallet as any, 'lockLoadedWallet');
      await wallet.getClient({ mustExist: true, doNotComplete: true });

      assert.strictEqual(wallet.chain, 'sol');
      await wallet.updatePassword(PASSWORD, newPassword, { silent: true });

      const saved = JSON.parse(fs.readFileSync(solFile, 'utf-8'));
      const savedKey = new Key({ seedType: 'object', seedData: saved.key });
      assert.ok(saved.key.xPrivKeyEncrypted);
      assert.ok(saved.key.xPrivKeyEDDSAEncrypted);
      assert.ok(saved.key.xPrivKey == null);
      assert.ok(saved.key.xPrivKeyEDDSA == null);
      assert.strictEqual(savedKey.checkPassword(newPassword, 'ECDSA'), true);
      assert.strictEqual(savedKey.checkPassword(newPassword, 'EDDSA'), true);
      assert.strictEqual(savedKey.checkPassword(PASSWORD, 'ECDSA'), false);
      assert.strictEqual(savedKey.checkPassword(PASSWORD, 'EDDSA'), false);
      assert.strictEqual(savedKey.get(newPassword, 'EDDSA').xPrivKey, originalEddsaKey);
      assert.strictEqual(savedKey.get(newPassword, 'EDDSA').mnemonic,
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
    });

    it('leaves the wallet and state files unchanged when the current password is wrong', async function() {
      const stateFile = path.join(stateDir, 'proposal.json');
      fs.writeFileSync(stateFile, JSON.stringify(Encryption.encryptWithPassword('state', PASSWORD)));
      const originalWallet = fs.readFileSync(walletFile, 'utf-8');
      const originalState = fs.readFileSync(stateFile, 'utf-8');

      await assert.rejects(() => wallet.updatePassword('wrong-password', newPassword, { silent: true }), /Could not decrypt/);

      assert.strictEqual(fs.readFileSync(walletFile, 'utf-8'), originalWallet);
      assert.strictEqual(fs.readFileSync(stateFile, 'utf-8'), originalState);
    });

    it('keeps the original state file when writing its replacement fails', async function() {
      const stateFile = path.join(stateDir, 'proposal.json');
      const tempFile = stateFile + '-temp';
      const stateData = 'transaction proposal state';
      fs.writeFileSync(stateFile, JSON.stringify(Encryption.encryptWithPassword(stateData, PASSWORD)));
      const originalState = fs.readFileSync(stateFile, 'utf-8');
      const writeFile = fs.writeFileSync;
      const writeStub = sandbox.stub(fs, 'writeFileSync').callsFake((filename) => {
        writeFile(filename, 'partial encrypted data');
        throw new Error('ENOSPC: disk full');
      });
      const warn = sandbox.stub(prompt.log, 'warn');

      await wallet.updatePassword(PASSWORD, newPassword, { silent: true });

      assert.strictEqual(writeStub.callCount, 1);
      assert.strictEqual(writeStub.firstCall.args[0], tempFile);
      assert.strictEqual(fs.readFileSync(stateFile, 'utf-8'), originalState);
      assert.strictEqual(Encryption.decryptWithPassword(originalState, PASSWORD).toString(), stateData);
      assert.strictEqual(fs.existsSync(tempFile), false);
      assert.strictEqual(warn.callCount, 1);
      assert.ok(warn.firstCall.args[0].includes(stateFile));
      assert.match(warn.firstCall.args[0], /ENOSPC: disk full/);
    });

    it('warns about a state file it cannot decrypt and continues with the other files', async function() {
      const badFile = path.join(stateDir, 'bad.json');
      const goodFile = path.join(stateDir, 'good.json');
      fs.writeFileSync(badFile, 'invalid encrypted data');
      fs.writeFileSync(goodFile, JSON.stringify(Encryption.encryptWithPassword('state', PASSWORD)));
      const warn = sandbox.stub(prompt.log, 'warn');

      await wallet.updatePassword(PASSWORD, newPassword, { silent: true });

      assert.strictEqual(fs.readFileSync(badFile, 'utf-8'), 'invalid encrypted data');
      assert.strictEqual(Encryption.decryptWithPassword(fs.readFileSync(goodFile, 'utf-8'), newPassword).toString(), 'state');
      assert.strictEqual(warn.callCount, 1);
      assert.match(warn.firstCall.args[0], /Failed to re-encrypt state file/);
      assert.ok(warn.firstCall.args[0].includes(badFile));
    });
  });
});
