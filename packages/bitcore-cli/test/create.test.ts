import { spawn } from 'child_process';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { Transform } from 'stream';
import * as helpers from './helpers';

describe('Create', function() {
  const { KEYSTROKES, WALLETS: { CLI_EXEC, COMMON_OPTS, TEMP_DIR } } = helpers.CONSTANTS;
  const commonOpts = [...COMMON_OPTS, '--dir', TEMP_DIR];

  function cleanupTempWallets() {
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmdirSync(TEMP_DIR, { recursive: true });
    }
  }

  before(async function() {
    cleanupTempWallets();
    await helpers.startBws();
  });

  after(async function() {
    await helpers.stopBws();
  });

  describe('Single Sig', function() {
    this.timeout(Math.max(this['_timeout'] || 0, 5000));
    const walletName = 'btc-temp';

    it('should create a BTC wallet', function(done) {
      const stepInputs = [
        [KEYSTROKES.ENTER], // Create Wallet
        [KEYSTROKES.ENTER], // Chain: btc
        ['regtest', KEYSTROKES.ENTER], // Network: regtest
        [KEYSTROKES.ENTER], // Multi-party? No
        [KEYSTROKES.ENTER], // Address Type: default
        ['testpassword', KEYSTROKES.ENTER], // Password
        [KEYSTROKES.ENTER], // View mnemonic
        [':', 'q', KEYSTROKES.ENTER] // vim input to quit viewing mnemonic
      ];
      let step = 0;
      const io = new Transform({
        encoding: 'utf-8',
        transform(chunk, encoding, respond) {
          chunk = chunk.toString();
          // Uncomment to see CLI output during test
          // process.stdout.write(chunk);

          const isStep = chunk.endsWith('└\n') || step == 7;
          if (isStep) {
            for (const input of stepInputs[step]) {
              this.push(input);
            }
            step++;
          } else if (chunk.includes('Error:')) {
            return respond(chunk);
          } else if (chunk.endsWith(' created successfully!\n\n')) {
            child.stdin.end(); // send EOF to child so it can exit cleanly
          }
          respond();
        }
      });
      const child = spawn('node', [CLI_EXEC, walletName, ...commonOpts]);
      child.stderr.pipe(process.stderr);
      child.stdout.pipe(io).pipe(child.stdin);
      let err;
      io.on('error', (e) => {
        err = e;
      });
      child.on('error', (e) => {
        err = e;
      });
      child.on('close', (code) => {
        assert.ifError(err);
        assert.equal(code, 0);
        const wallet = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, walletName + '.json'), 'utf-8'));
        // Ensure that sensitive wallet key properties are encrypted and not present in plaintext
        assert.ok(Object.hasOwn(wallet.key, 'mnemonicEncrypted'));
        assert.ok(!Object.hasOwn(wallet.key, 'mnemonic'));
        assert.ok(Object.hasOwn(wallet.key, 'xPrivKeyEncrypted'));
        assert.ok(!Object.hasOwn(wallet.key, 'xPrivKey'));
        assert.ok(Object.hasOwn(wallet.key, 'xPrivKeyEDDSAEncrypted'));
        assert.ok(!Object.hasOwn(wallet.key, 'xPrivKeyEDDSA'));
        done();
      });
    });
  });
});