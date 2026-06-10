import { spawn } from 'child_process';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { Transform } from 'stream';
import { EventEmitter } from 'events';
import * as helpers from './helpers';
import { Wallet } from '../src/wallet';
import { startTssWallets, TssTransform } from './tssCoordinator';

describe('Create', function() {
  this.timeout(Math.max(this['_timeout'] || 0, 5000));

  const { KEYSTROKES, WALLETS, OUTPUT_END_SEQ } = helpers.CONSTANTS;
  const { CLI_EXEC, CLI_OPTS, COMMON_OPTS, TEMP_DIR } = WALLETS;
  const commonOpts = [...COMMON_OPTS, '--dir', TEMP_DIR];

  before(async function() {
    helpers.cleanupTempWallets();
    await helpers.startBws();
  });

  after(async function() {
    await helpers.stopBws();
  });

  describe('Single Sig', function() {
    it('should create a BTC wallet', function(done) {
      const walletName = 'btc-temp';
      const stepInputs = [
        [KEYSTROKES.ENTER], // Create Wallet
        [KEYSTROKES.ENTER], // Chain: btc
        ['testnet', KEYSTROKES.ENTER], // Network: testnet
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
          try {
            chunk = chunk.toString();
            // Uncomment to see CLI output during test
            // process.stdout.write(chunk);

            const isStep = chunk.endsWith(OUTPUT_END_SEQ) || step == stepInputs.length - 1; // viewing mnemonic (vim)
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
          } catch (e) {
            respond(e);
          }
        }
      });
      const child = spawn('node', [CLI_EXEC, walletName, ...commonOpts], CLI_OPTS);
      child.stderr.pipe(helpers.filterStderr()).pipe(process.stderr);
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
          const wallet = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, walletName + '.json'), 'utf-8'));
          assert.strictEqual(wallet.credentials.chain, 'btc');
          assert.strictEqual(wallet.credentials.network, 'testnet');
          // Ensure that sensitive wallet key properties are encrypted and not present in plaintext
          assert.ok(Object.hasOwn(wallet.key, 'mnemonicEncrypted'));
          assert.ok(!Object.hasOwn(wallet.key, 'mnemonic'));
          assert.ok(Object.hasOwn(wallet.key, 'xPrivKeyEncrypted'));
          assert.ok(!Object.hasOwn(wallet.key, 'xPrivKey'));
          assert.ok(Object.hasOwn(wallet.key, 'xPrivKeyEDDSAEncrypted'));
          assert.ok(!Object.hasOwn(wallet.key, 'xPrivKeyEDDSA'));
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it('should create an ETH wallet', function(done) {
      const walletName = 'eth-temp';
      const stepInputs = [
        [KEYSTROKES.ENTER], // Create Wallet
        ['eth', KEYSTROKES.ENTER], // Chain: eth
        ['testnet', KEYSTROKES.ENTER], // Network: testnet
        [KEYSTROKES.ENTER], // Multi-party? No
        // [KEYSTROKES.ENTER], // Address Type: default
        ['testpassword', KEYSTROKES.ENTER], // Password
        [KEYSTROKES.ENTER], // View mnemonic
        [':', 'q', KEYSTROKES.ENTER] // vim input to quit viewing mnemonic
      ];
      let step = 0;
      const io = new Transform({
        encoding: 'utf-8',
        transform(chunk, encoding, respond) {
          try {
            chunk = chunk.toString();
            // Uncomment to see CLI output during test
            // process.stdout.write(chunk);

            const isStep = chunk.endsWith(OUTPUT_END_SEQ) || step == stepInputs.length - 1; // viewing mnemonic (vim)
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
          } catch (e) {
            respond(e);
          }
        }
      });
      const child = spawn('node', [CLI_EXEC, walletName, ...commonOpts], CLI_OPTS);
      child.stderr.pipe(helpers.filterStderr()).pipe(process.stderr);
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
          const wallet = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, walletName + '.json'), 'utf-8'));
          assert.strictEqual(wallet.credentials.chain, 'eth');
          assert.strictEqual(wallet.credentials.network, 'testnet');
          // Ensure that sensitive wallet key properties are encrypted and not present in plaintext
          assert.ok(Object.hasOwn(wallet.key, 'mnemonicEncrypted'));
          assert.ok(!Object.hasOwn(wallet.key, 'mnemonic'));
          assert.ok(Object.hasOwn(wallet.key, 'xPrivKeyEncrypted'));
          assert.ok(!Object.hasOwn(wallet.key, 'xPrivKey'));
          assert.ok(Object.hasOwn(wallet.key, 'xPrivKeyEDDSAEncrypted'));
          assert.ok(!Object.hasOwn(wallet.key, 'xPrivKeyEDDSA'));
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it('should create an XRP wallet', function(done) {
      const walletName = 'xrp-temp';
      const stepInputs = [
        [KEYSTROKES.ENTER], // Create Wallet
        ['xrp', KEYSTROKES.ENTER], // Chain: xrp
        ['testnet', KEYSTROKES.ENTER], // Network: testnet
        [KEYSTROKES.ENTER], // Multi-party? No
        // [KEYSTROKES.ENTER], // Address Type: default
        ['testpassword', KEYSTROKES.ENTER], // Password
        [KEYSTROKES.ENTER], // View mnemonic
        [':', 'q', KEYSTROKES.ENTER] // vim input to quit viewing mnemonic
      ];
      let step = 0;
      const io = new Transform({
        encoding: 'utf-8',
        transform(chunk, encoding, respond) {
          try {
            chunk = chunk.toString();
            // Uncomment to see CLI output during test
            // process.stdout.write(chunk);

            const isStep = chunk.endsWith(OUTPUT_END_SEQ) || step == stepInputs.length - 1; // viewing mnemonic (vim)
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
          } catch (e) {
            respond(e);
          }
        }
      });
      const child = spawn('node', [CLI_EXEC, walletName, ...commonOpts], CLI_OPTS);
      child.stderr.pipe(helpers.filterStderr()).pipe(process.stderr);
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
          const wallet = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, walletName + '.json'), 'utf-8'));
          assert.strictEqual(wallet.credentials.chain, 'xrp');
          assert.strictEqual(wallet.credentials.network, 'testnet');
          // Ensure that sensitive wallet key properties are encrypted and not present in plaintext
          assert.ok(Object.hasOwn(wallet.key, 'mnemonicEncrypted'));
          assert.ok(!Object.hasOwn(wallet.key, 'mnemonic'));
          assert.ok(Object.hasOwn(wallet.key, 'xPrivKeyEncrypted'));
          assert.ok(!Object.hasOwn(wallet.key, 'xPrivKey'));
          assert.ok(Object.hasOwn(wallet.key, 'xPrivKeyEDDSAEncrypted'));
          assert.ok(!Object.hasOwn(wallet.key, 'xPrivKeyEDDSA'));
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it('should create a SOL wallet', function(done) {
      const walletName = 'sol-temp';
      const stepInputs = [
        [KEYSTROKES.ENTER], // Create Wallet
        ['sol', KEYSTROKES.ENTER], // Chain: sol
        ['testnet', KEYSTROKES.ENTER], // Network: testnet
        // [KEYSTROKES.ENTER], // Multi-party? No
        // [KEYSTROKES.ENTER], // Address Type: default
        ['testpassword', KEYSTROKES.ENTER], // Password
        [KEYSTROKES.ENTER], // View mnemonic
        [':', 'q', KEYSTROKES.ENTER] // vim input to quit viewing mnemonic
      ];
      let step = 0;
      const io = new Transform({
        encoding: 'utf-8',
        transform(chunk, encoding, respond) {
          try {
            chunk = chunk.toString();
            // Uncomment to see CLI output during test
            // process.stdout.write(chunk);

            const isStep = chunk.endsWith(OUTPUT_END_SEQ) || step == stepInputs.length - 1; // viewing mnemonic (vim)
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
          } catch (e) {
            respond(e);
          }
        }
      });
      const child = spawn('node', [CLI_EXEC, walletName, ...commonOpts], CLI_OPTS);
      child.stderr.pipe(helpers.filterStderr()).pipe(process.stderr);
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
          const wallet = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, walletName + '.json'), 'utf-8'));
          assert.strictEqual(wallet.credentials.chain, 'sol');
          assert.strictEqual(wallet.credentials.network, 'testnet');
          // Ensure that sensitive wallet key properties are encrypted and not present in plaintext
          assert.ok(Object.hasOwn(wallet.key, 'mnemonicEncrypted'));
          assert.ok(!Object.hasOwn(wallet.key, 'mnemonic'));
          assert.ok(Object.hasOwn(wallet.key, 'xPrivKeyEncrypted'));
          assert.ok(!Object.hasOwn(wallet.key, 'xPrivKey'));
          assert.ok(Object.hasOwn(wallet.key, 'xPrivKeyEDDSAEncrypted'));
          assert.ok(!Object.hasOwn(wallet.key, 'xPrivKeyEDDSA'));
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  });

  describe('Multi Sig', function() {
    describe('BTC', function() {
      let secret: string;
      const walletName1 = 'btc-multisig-temp1';
      const walletName2 = 'btc-multisig-temp2';

      it('should create a multi-sig BTC wallet - copayer1', function(done) {
        const stepInputs = [
          [KEYSTROKES.ENTER], // Create Wallet
          [KEYSTROKES.ENTER], // Chain: btc
          ['testnet', KEYSTROKES.ENTER], // Network: testnet
          [KEYSTROKES.ARROW_LEFT, KEYSTROKES.ENTER], // Multi-party? Yes
          [KEYSTROKES.ENTER], // Which scheme? MultiSig (default)
          ['2-2', KEYSTROKES.ENTER], // M-N: 2-2
          ['copayer1', KEYSTROKES.ENTER], // Copayer name
          [KEYSTROKES.ENTER], // Address Type: default
          ['testpassword', KEYSTROKES.ENTER], // Password
          [KEYSTROKES.ENTER], // Done sharing -- (checkpoint1)
          // Checkpoint1: Get secret to share with copayer 2
          [KEYSTROKES.ENTER], // View mnemonic
          [':', 'q', KEYSTROKES.ENTER] // vim input to quit viewing mnemonic
        ];
        let step = 0;
        let checkpointOutput = '';
        // stepInputs indexes corresponding to checkpoints in test flow where we want to assert on CLI output
        const checkpoints = new Set([10]);
        const io = new Transform({
          encoding: 'utf-8',
          transform(chunk, encoding, respond) {
            try {
              chunk = chunk.toString();
              if (checkpoints.has(step)) {
                checkpointOutput += chunk;
              } else {
                checkpointOutput = '';
              }
              // Uncomment to see CLI output during test
              // process.stdout.write(chunk);

              const isStep = chunk.endsWith(OUTPUT_END_SEQ) || step == stepInputs.length - 1; // viewing mnemonic
              if (isStep) {
                switch (step) {
                  default:
                    break; // no-op for non-checkpoint steps
                  case Array.from(checkpoints)[0]:
                    const lines = checkpointOutput.split('\n');
                    const startIdx = lines.findIndex(l => l.includes('Share this secret with the other participants:'));
                    const endIdx = lines.findIndex(l => l.includes('Done'));
                    assert.ok(startIdx > -1, 'Did not find expected prompt to share secret with other participants. Output was: ' + checkpointOutput);
                    // secret may be across multiple lines due to terminal width, so join all lines between start and end indexes and remove any CLI formatting before asserting on it
                    secret = helpers.decolor(lines.slice(startIdx + 1, endIdx).map(l => l.replace('│', '').trim()).join(''));
                    assert.match(secret, /^[0-9A-z]{64,}$/); // base58 string at least 64 chars long
                    assert.ok(secret.endsWith('Tbtc'), 'Secret should end with Tbtc for testnet btc. Got: ' + secret); // testnet btc
                    checkpointOutput = '';
                    break;
                }
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
            } catch (e) {
              respond(e);
            }
          }
        });
        const child = spawn('node', [CLI_EXEC, walletName1, ...commonOpts], CLI_OPTS);
        child.stderr.pipe(helpers.filterStderr()).pipe(process.stderr);
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
            const wallet = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, walletName1 + '.json'), 'utf-8'));
            assert.strictEqual(wallet.credentials.chain, 'btc');
            assert.strictEqual(wallet.credentials.network, 'testnet');
            assert.strictEqual(wallet.credentials.m, 2);
            assert.strictEqual(wallet.credentials.n, 2);
            // Ensure that sensitive wallet key properties are encrypted and not present in plaintext
            assert.ok(Object.hasOwn(wallet.key, 'mnemonicEncrypted'));
            assert.ok(!Object.hasOwn(wallet.key, 'mnemonic'));
            assert.ok(Object.hasOwn(wallet.key, 'xPrivKeyEncrypted'));
            assert.ok(!Object.hasOwn(wallet.key, 'xPrivKey'));
            assert.ok(Object.hasOwn(wallet.key, 'xPrivKeyEDDSAEncrypted'));
            assert.ok(!Object.hasOwn(wallet.key, 'xPrivKeyEDDSA'));
            done();
          } catch (e) {
            done(e);
          }
        });
      });

      it('should not load incomplete multi-sig wallet - copayer1', function(done) {
        let checkpointOutput = '';
        const io = new Transform({
          encoding: 'utf-8',
          transform(chunk, encoding, respond) {
            try {
              chunk = chunk.toString();
              checkpointOutput += chunk;
              respond();
            } catch (e) {
              respond(e);
            }
          }
        });
        const child = spawn('node', [CLI_EXEC, walletName1, ...commonOpts], CLI_OPTS);
        child.stderr.pipe(helpers.filterStderr()).pipe(process.stderr);
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
            const lines = checkpointOutput.split('\n').filter(l => l.trim() !== '');
            const expectedMessage = 'This multisig wallet is not fully set up yet. You need to wait for all copayers to join.';
            // Uncomment to see CLI output during test
            // console.log(lines);
            assert.ok(lines[lines.length - 1].includes(expectedMessage), 'Did not find expected message about multisig wallet not being fully set up.');
            done();
          } catch (e) {
            done(e);
          }
        });
      });

      it('should create a multi-sig BTC wallet - copayer2', function(done) {
        const stepInputs = [
          [KEYSTROKES.ARROW_DOWN], // Create Wallet -> Join Wallet
          [KEYSTROKES.ENTER], // Join Wallet
          [KEYSTROKES.ENTER], // Chain: btc
          [KEYSTROKES.ENTER], // Which scheme? MultiSig (default)
          [secret, KEYSTROKES.ENTER], // Enter secret created by copayer 1
          ['copayer2', KEYSTROKES.ENTER], // Copayer name
          ['testpassword', KEYSTROKES.ENTER], // Password
          [KEYSTROKES.ENTER], // View mnemonic
          [':', 'q', KEYSTROKES.ENTER] // vim input to quit viewing mnemonic
        ];
        let step = 0;
        let checkpointOutput = '';
        // stepInputs indexes corresponding to checkpoints in test flow where we want to assert on CLI output
        const checkpoints = new Set([]);
        const io = new Transform({
          encoding: 'utf-8',
          transform(chunk, encoding, respond) {
            try {
              chunk = chunk.toString();
              if (checkpoints.has(step)) {
                checkpointOutput += chunk;
              } else {
                checkpointOutput = '';
              }
              // Uncomment to see CLI output during test
              // process.stdout.write(chunk);

              const isStep = chunk.endsWith(OUTPUT_END_SEQ) || step == stepInputs.length - 1; // viewing mnemonic (vim)
              if (isStep) {
                switch (step) {
                  default:
                    break; // no-op for non-checkpoint steps
                  case Array.from(checkpoints)[0]:
                    return respond(new Error('No checkpoints expected'));
                }
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
            } catch (e) {
              respond(e);
            }
          }
        });
        const child = spawn('node', [CLI_EXEC, walletName2, ...commonOpts], CLI_OPTS);
        child.stderr.pipe(helpers.filterStderr()).pipe(process.stderr);
        child.stdout.pipe(io).pipe(child.stdin);
        io.on('error', (e) => {
          done(e);
        });
        child.on('error', (e) => {
          done(e);
        });
        child.on('close', async (code) => {
          try {
            assert.equal(code, 0);
            const wallet = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, walletName2 + '.json'), 'utf-8'));
            assert.strictEqual(wallet.credentials.chain, 'btc');
            assert.strictEqual(wallet.credentials.network, 'testnet');
            assert.strictEqual(wallet.credentials.m, 2);
            assert.strictEqual(wallet.credentials.n, 2);
            assert.strictEqual(wallet.credentials.publicKeyRing.length, 2);
            // Ensure that sensitive wallet key properties are encrypted and not present in plaintext
            assert.ok(Object.hasOwn(wallet.key, 'mnemonicEncrypted'));
            assert.ok(!Object.hasOwn(wallet.key, 'mnemonic'));
            assert.ok(Object.hasOwn(wallet.key, 'xPrivKeyEncrypted'));
            assert.ok(!Object.hasOwn(wallet.key, 'xPrivKey'));
            assert.ok(Object.hasOwn(wallet.key, 'xPrivKeyEDDSAEncrypted'));
            assert.ok(!Object.hasOwn(wallet.key, 'xPrivKeyEDDSA'));
            
            // Check that copayer1's wallet file gets updated with copayer2's public key info
            const copayer1_beforeLoad = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, walletName1 + '.json'), 'utf-8'));
            assert.strictEqual(copayer1_beforeLoad.credentials.publicKeyRing.length, 1);
            const w = new Wallet({ name: walletName1, dir: TEMP_DIR, host: commonOpts[commonOpts.indexOf('--host') + 1] });
            // Calls w.load() which should update wallet with client.openWallet() response
            await w.getClient({ mustExist: true });
            const copayer1_afterLoad = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, walletName1 + '.json'), 'utf-8'));
            assert.strictEqual(copayer1_afterLoad.credentials.publicKeyRing.length, 2);
            done();
          } catch (e) {
            done(e);
          }
        });
      });

      it('should load complete multi-sig wallet after copayer2 joins - copayer1', function(done) {
        const stepInputs = [
          [KEYSTROKES.ARROW_UP], // Main Menu -> Exit
          [KEYSTROKES.ENTER], // Exit
        ];
        let step = 0;
        let checkpointOutput = '';
        const io = new Transform({
          encoding: 'utf-8',
          transform(chunk, encoding, respond) {
            try {
              chunk = chunk.toString();
              checkpointOutput += chunk;
              
              // Uncomment to see CLI output during test
              // process.stdout.write(chunk);

              const isStep = chunk.endsWith(OUTPUT_END_SEQ);
              if (isStep) {
                switch (step) {
                  default:
                    break; // no-op for non-checkpoint steps
                }
                for (const input of stepInputs[step]) {
                  this.push(input);
                }
                step++;
              } else if (chunk.includes('Error:')) {
                return respond(chunk);
              } else if (chunk.includes('👋')) {
                child.stdin.end(); // send EOF to child so it can exit cleanly
              }
              respond();
            } catch (e) {
              respond(e);
            }
          }
        });
        const child = spawn('node', [CLI_EXEC, walletName1, ...commonOpts], CLI_OPTS);
        child.stderr.pipe(helpers.filterStderr()).pipe(process.stderr);
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
            assert.ok(!checkpointOutput.includes('This multisig wallet is not fully set up yet.'), 'Expected multisig wallet to be completed');
            done();
          } catch (e) {
            done(e);
          }
        });
      });
    });

    describe('Non-multisig Chains', function() {
      for (const chain of ['eth', 'xrp']) { // sol is not tested since no multi-party option is offered at all for it
        it(`should not offer MultiSig option for ${chain.toUpperCase()}`, function(done) {
          const walletName = `${chain}-multisig-temp`;
          const stepInputs = [
            [KEYSTROKES.ENTER], // Create Wallet
            [chain, KEYSTROKES.ENTER], // Chain: <chain>
            ['testnet', KEYSTROKES.ENTER], // Network: testnet
            [KEYSTROKES.ARROW_LEFT, KEYSTROKES.ENTER], // Multi-party? Yes
            // Checkpoint1: Verify that MultiSig is not presented as an option
            [KEYSTROKES.CTRL_C], // M-N (cancel out) -- (checkpoint1)
          ];
          let step = 0;
          let checkpointOutput = '';
          // stepInputs indexes corresponding to checkpoints in test flow where we want to assert on CLI output
          const checkpoints = new Set([4]);
          const io = new Transform({
            encoding: 'utf-8',
            transform(chunk, encoding, respond) {
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
                      // Asked if it's multi-party
                      assert.match(checkpointOutput, /Is this a multi-party wallet\?/);
                      // Asked for m-n
                      assert.match(checkpointOutput, /M-N:/);
                      // Should NOT have prompted multi-party scheme options (MultiSig, TSS, etc)
                      assert.doesNotMatch(checkpointOutput, /MultiSig|TSS/);
                      checkpointOutput = '';
                      break;
                  }
                  for (const input of stepInputs[step]) {
                    this.push(input);
                  }
                  step++;
                } else if (chunk.includes('Error:')) {
                  assert.match(chunk, /Error: Cancelled by user/);
                  assert.ok(step > stepInputs.length - 1); // Ensure that flow was cancelled at end of steps
                  child.stdin.end(); // send EOF to child so it can exit cleanly
                }
                respond();
              } catch (e) {
                respond(e);
              }
            }
          });
          const child = spawn('node', [CLI_EXEC, walletName, ...commonOpts], CLI_OPTS);
          child.stderr.pipe(helpers.filterStderr()).pipe(process.stderr);
          child.stdout.pipe(io).pipe(child.stdin);
          io.on('error', (e) => {
            done(e);
          });
          child.on('error', (e) => {
            done(e);
          });
          child.on('close', (code) => {
            try {
              assert.equal(code, 1); // Exit code 1 since flow is cancelled with ctrl+c
              // No wallet file should have been created or saved
              assert.ok(!fs.existsSync(path.join(TEMP_DIR, walletName + '.json')));
              done();
            } catch (e) {
              done(e);
            }
          });
        });
      }
    });
  });

  describe('Threshold Sig', function() {
    this.timeout(Math.max(this['_timeout'] || 0, 20000));
    
    describe('BTC', function() {
      const walletName1 = 'btc-tss-temp1';
      const walletName2 = 'btc-tss-temp2';

      it('should create a threshold BTC wallet', function(done) {
        let copayer2PubKey: string;
        let joinCode: string;
        const emitter = new EventEmitter();
        const copayer2PubKeySet = new Promise(r => emitter.once('copayer2PubKey', r));
        const joinCodeSet = new Promise(r => emitter.once('joinCode', r));

        const stepInputsC1 = [
          [KEYSTROKES.ENTER], // Create Wallet
          [KEYSTROKES.ENTER], // Chain: btc
          ['testnet', KEYSTROKES.ENTER], // Network: testnet
          [KEYSTROKES.ARROW_LEFT, KEYSTROKES.ENTER], // Multi-party? Yes
          [KEYSTROKES.ARROW_DOWN], // Which scheme? MultiSig -> TSS
          [KEYSTROKES.ENTER], // Which scheme? TSS
          ['2-2', KEYSTROKES.ENTER], // M-N: 2-2
          ['copayer1', KEYSTROKES.ENTER], // Copayer name
          [KEYSTROKES.ENTER], // Address Type: default
          ['testpassword', KEYSTROKES.ENTER], // Password
          // Checkpoint1: Wait for copayer2's pubkey
          [copayer2PubKey, KEYSTROKES.ENTER], // Done sharing -- (checkpoint1)
          // Checkpoint2: Extract join code to share with copayer2
          [KEYSTROKES.ENTER], // Done sharing -- (checkpoint2)
          [KEYSTROKES.ENTER], // Yes, continue with keyshare export
          [...Array(50).fill(KEYSTROKES.BACKSPACE), `${TEMP_DIR}/${walletName1}-export.json`, KEYSTROKES.ENTER], // Export keyshare backup file to temp dir
          ['exportpassword', KEYSTROKES.ENTER], // Password for exported keyshare backup file
          ['testpassword', KEYSTROKES.ENTER], // Unlock wallet
        ];
        const stepInputsC2 = [
          [KEYSTROKES.ARROW_DOWN], // Create Wallet -> Join Wallet
          [KEYSTROKES.ENTER], // Join Wallet
          [KEYSTROKES.ENTER], // Chain: btc
          [KEYSTROKES.ARROW_DOWN], // Which scheme? MultiSig -> TSS
          [KEYSTROKES.ENTER], // Which scheme? TSS
          ['testnet', KEYSTROKES.ENTER], // Network: testnet
          ['copayer2', KEYSTROKES.ENTER], // Copayer name
          ['testpassword', KEYSTROKES.ENTER], // Password
          // Checkpoint1: Extract pubkey to give to session leader (copayer1)
          [KEYSTROKES.ENTER], // Done sharing -- (checkpoint1)
          // Checkpoint2: Wait for and enter join code from copayer1 to join session
          [joinCode, KEYSTROKES.ENTER], // Enter session code from leader (copayer1)
          [KEYSTROKES.ENTER], // Confirm decoded join code looks correct
          [KEYSTROKES.ENTER], // Yes, continue with keyshare export
          [...Array(50).fill(KEYSTROKES.BACKSPACE), `${TEMP_DIR}/${walletName2}-export.json`, KEYSTROKES.ENTER], // Export keyshare backup file to temp dir
          ['exportpassword', KEYSTROKES.ENTER], // Password for exported keyshare backup file
          ['testpassword', KEYSTROKES.ENTER], // Unlock wallet
        ];
        const step = {
          [walletName1]: 0,
          [walletName2]: 0
        };
        const checkpointOutput = {
          [walletName1]: '',
          [walletName2]: ''
        };
        // stepInputs indexes corresponding to checkpoints in test flow where we want to assert on CLI output
        const checkpoints = {
          [walletName1]: new Set([10, 11]),
          [walletName2]: new Set([8, 9])
        };
        function pushInputs(walletName, stepInputs) {
          for (const input of stepInputs) {
            this.push(JSON.stringify({ walletName, chunk: input }));
          }
        }
        const io = new TssTransform({
          encoding: 'utf-8',
          transform: async function(data, encoding, respond) {
            try {
              data = JSON.parse(data.toString());
              const { walletName, chunk } = data;
              if (checkpoints[walletName].has(step[walletName])) {
                checkpointOutput[walletName] += chunk;
              } else {
                checkpointOutput[walletName] = '';
              }
              // Uncomment to see CLI output during test
              // walletName === walletName1 && process.stdout.write(chunk);
              const stepInputs = walletName === walletName1 ? stepInputsC1 : stepInputsC2;

              const isStep = chunk.endsWith(OUTPUT_END_SEQ);
              if (isStep) {
                const lines = checkpointOutput[walletName].split('\n');
                switch (step[walletName]) {
                  default:
                    pushInputs.call(this, walletName, stepInputs[step[walletName]]);
                    break; // no-op for non-checkpoint steps
                  case Array.from(checkpoints[walletName])[0]:
                    if (walletName === walletName1) {
                      const startIdx = lines.findIndex(l => l.includes('Enter party 1\'s public key:'));
                      assert.ok(startIdx > -1);
                      const cachedStep = step[walletName]; // cache the step num so it's preserved for the promise handler
                      copayer2PubKeySet.then(() => {
                        stepInputs[cachedStep][0] = copayer2PubKey;
                        pushInputs.call(this, walletName, stepInputs[cachedStep]);
                      });
                    } else {
                      const startIdx = lines.findIndex(l => l.includes('Give the following public key to the session leader:'));
                      const endIdx = lines.findIndex(l => l.includes('Done'));
                      assert.ok(startIdx > -1, 'Did not find expected prompt to share public key with session leader. Output was: ' + checkpointOutput);
                      copayer2PubKey = helpers.decolor(lines.slice(startIdx + 1, endIdx).map(l => l.replace('│', '').trim()).join(''));
                      assert.match(copayer2PubKey, /^[0-9a-f]{66}$/, 'Invalid copayer2 public key. Got: ' + copayer2PubKey); // 66 byte hex pubkey string
                      emitter.emit('copayer2PubKey');
                      pushInputs.call(this, walletName, stepInputs[step[walletName]]);
                    }
                    checkpointOutput[walletName] = '';
                    break;
                  case Array.from(checkpoints[walletName])[1]:
                    if (walletName === walletName1) {
                      const startIdx = lines.findIndex(l => l.includes('Join code for party 1:'));
                      const endIdx = lines.findIndex(l => l.includes('Continue'));
                      assert.ok(startIdx > -1, 'Did not find expected prompt to share join code with session leader. Output was: ' + checkpointOutput);
                      joinCode = helpers.decolor(lines.slice(startIdx + 1, endIdx).map(l => l.replace('│', '').trim()).join(''));
                      assert.match(joinCode, /^[0-9a-f]{400,500}$/, 'Invalid join code. Got: ' + joinCode); // hex string between 400-500 chars long (expected to be around 418 chars. Length is just a sanity check. If any data is added to join code it'll need to be adjusted)
                      emitter.emit('joinCode');
                      pushInputs.call(this, walletName, stepInputs[step[walletName]]);
                    } else {
                      const startIdx = lines.findIndex(l => l.includes('Enter the join code from the session leader:'));
                      assert.ok(startIdx > -1);
                      const cachedStep = step[walletName]; // cache the step num so it's preserved for the promise handler
                      joinCodeSet.then(() => {
                        stepInputs[cachedStep][0] = joinCode;
                        pushInputs.call(this, walletName, stepInputs[cachedStep]);
                      });
                    }
                    checkpointOutput[walletName] = '';
                    break;
                }
                
                step[walletName]++;
              } else if (chunk.includes('Error:')) {
                return respond(chunk);
              } else if (chunk.endsWith(' created successfully!\n\n')) {
                this.push(JSON.stringify({ walletName, endIt: true })); // send EOF to child so it can exit cleanly
              }

              respond();
            } catch (e) {
              respond(e);
            }
          }
        });

        startTssWallets(io, [walletName1, walletName2], commonOpts);
        io.on('error', (e) => {
          done(e);
        });
        io.on('allClosed', (exitCodes: number[]) => {
          try {
            assert.deepEqual(exitCodes, [0, 0]);
            // Wallet 1
            const wallet1 = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, walletName1 + '.json'), 'utf-8'));
            assert.strictEqual(wallet1.credentials.chain, 'btc');
            assert.strictEqual(wallet1.credentials.network, 'testnet');
            // Still treated as single sig wallet
            assert.strictEqual(wallet1.credentials.m, 1);
            assert.strictEqual(wallet1.credentials.n, 1);
            // Ensure that sensitive wallet key properties are encrypted and not present in plaintext
            assert.ok(Object.hasOwn(wallet1.key, 'mnemonicEncrypted'));
            assert.ok(!Object.hasOwn(wallet1.key, 'mnemonic'));
            assert.ok(Object.hasOwn(wallet1.key, 'xPrivKeyEncrypted'));
            assert.ok(!Object.hasOwn(wallet1.key, 'xPrivKey'));
            assert.ok(Object.hasOwn(wallet1.key, 'xPrivKeyEDDSAEncrypted'));
            assert.ok(!Object.hasOwn(wallet1.key, 'xPrivKeyEDDSA'));
            // Ensure TSS fields are present and encrypted
            assert.ok(Object.hasOwn(wallet1, 'key'), 'No key property found on wallet');
            assert.ok(Object.hasOwn(wallet1.key, 'keychain'), 'No key.keychain property found on wallet');
            assert.strictEqual(typeof wallet1.key.keychain.commonKeyChain, 'string');
            assert.ok(wallet1.key.keychain.privateKeyShare == null, 'privateKeyShare should not be present on wallet keychain');
            assert.strictEqual(typeof wallet1.key.keychain.privateKeyShareEncrypted, 'string');
            assert.ok(wallet1.key.keychain.privateKeyShareEncrypted.startsWith('{"iv":"'), 'privateKeyShareEncrypted should be encrypted');
            assert.ok(wallet1.key.keychain.reducedPrivateKeyShare == null, 'reducedPrivateKeyShare should not be present on wallet keychain');
            assert.strictEqual(typeof wallet1.key.keychain.reducedPrivateKeyShareEncrypted, 'string');
            assert.ok(wallet1.key.keychain.reducedPrivateKeyShareEncrypted.startsWith('{"iv":"'), 'reducedPrivateKeyShareEncrypted should be encrypted');
            assert.ok(Object.hasOwn(wallet1.key, 'metadata'), 'No key.metadata property found on wallet');
            assert.strictEqual(typeof wallet1.key.metadata.id, 'string');
            assert.strictEqual(wallet1.key.metadata.m, 2);
            assert.strictEqual(wallet1.key.metadata.n, 2);

            // Wallet 2
            const wallet2 = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, walletName2 + '.json'), 'utf-8'));
            assert.strictEqual(wallet2.credentials.chain, 'btc');
            assert.strictEqual(wallet2.credentials.network, 'testnet');
            // Still treated as single sig wallet
            assert.strictEqual(wallet2.credentials.m, 1);
            assert.strictEqual(wallet2.credentials.n, 1);
            // Ensure that sensitive wallet key properties are encrypted and not present in plaintext
            assert.ok(Object.hasOwn(wallet2.key, 'mnemonicEncrypted'));
            assert.ok(!Object.hasOwn(wallet2.key, 'mnemonic'));
            assert.ok(Object.hasOwn(wallet2.key, 'xPrivKeyEncrypted'));
            assert.ok(!Object.hasOwn(wallet2.key, 'xPrivKey'));
            assert.ok(Object.hasOwn(wallet2.key, 'xPrivKeyEDDSAEncrypted'));
            assert.ok(!Object.hasOwn(wallet2.key, 'xPrivKeyEDDSA'));
            // Ensure TSS fields are present and encrypted
            assert.ok(Object.hasOwn(wallet2, 'key'), 'No key property found on wallet');
            assert.ok(Object.hasOwn(wallet2.key, 'keychain'), 'No key.keychain property found on wallet');
            assert.strictEqual(typeof wallet2.key.keychain.commonKeyChain, 'string');
            assert.ok(wallet2.key.keychain.privateKeyShare == null, 'privateKeyShare should not be present on wallet keychain');
            assert.strictEqual(typeof wallet2.key.keychain.privateKeyShareEncrypted, 'string');
            assert.ok(wallet2.key.keychain.privateKeyShareEncrypted.startsWith('{"iv":"'), 'privateKeyShareEncrypted should be encrypted');
            assert.ok(wallet2.key.keychain.reducedPrivateKeyShare == null, 'reducedPrivateKeyShare should not be present on wallet keychain');
            assert.strictEqual(typeof wallet2.key.keychain.reducedPrivateKeyShareEncrypted, 'string');
            assert.ok(wallet2.key.keychain.reducedPrivateKeyShareEncrypted.startsWith('{"iv":"'), 'reducedPrivateKeyShareEncrypted should be encrypted');
            assert.ok(Object.hasOwn(wallet2.key, 'metadata'), 'No key.metadata property found on wallet');
            assert.strictEqual(typeof wallet2.key.metadata.id, 'string');
            assert.strictEqual(wallet2.key.metadata.m, 2);
            assert.strictEqual(wallet2.key.metadata.n, 2);

            // Check wallets are copayers of the same wallet
            assert.strictEqual(wallet1.credentials.walletId, wallet2.credentials.walletId, 'Wallet IDs do not match');
            assert.strictEqual(wallet1.key.metadata.id, wallet2.key.metadata.id, 'Key metadata IDs do not match');
            assert.strictEqual(wallet1.key.keychain.commonKeyChain, wallet2.key.keychain.commonKeyChain, 'Common key chains do not match');

            // Check keyshare backup files
            const keyshareBackup1 = path.join(TEMP_DIR, walletName1 + '-export.json');
            assert.ok(fs.existsSync(keyshareBackup1), 'Keyshare backup file not found for wallet 1');
            const keyshare1 = JSON.parse(fs.readFileSync(keyshareBackup1, 'utf-8'));
            assert.ok(keyshare1.iv && keyshare1.mode && keyshare1.cipher && keyshare1.ct, 'Keyshare backup 1 does not appear to be encrypted');
            assert.strictEqual(keyshare1.cipher + keyshare1.mode, 'aesgcm', 'Expected keyshare backup 1 to be encrypted with AES-GCM');
            const keyshareBackup2 = path.join(TEMP_DIR, walletName2 + '-export.json');
            assert.ok(fs.existsSync(keyshareBackup2), 'Keyshare backup file not found for wallet 2');
            const keyshare2 = JSON.parse(fs.readFileSync(keyshareBackup2, 'utf-8'));
            assert.ok(keyshare2.iv && keyshare2.mode && keyshare2.cipher && keyshare2.ct, 'Keyshare backup 2 does not appear to be encrypted');
            assert.strictEqual(keyshare2.cipher + keyshare2.mode, 'aesgcm', 'Expected keyshare backup 2 to be encrypted with AES-GCM');

            done();
          } catch (e) {
            done(e);
          }
        });
      });
    });

    describe('ETH', function() {
      const walletName1 = 'eth-tss-temp1';
      const walletName2 = 'eth-tss-temp2';

      it('should create a threshold ETH wallet', function(done) {
        let copayer2PubKey: string;
        let joinCode: string;
        const emitter = new EventEmitter();
        const copayer2PubKeySet = new Promise(r => emitter.once('copayer2PubKey', r));
        const joinCodeSet = new Promise(r => emitter.once('joinCode', r));

        const stepInputsC1 = [
          [KEYSTROKES.ENTER], // Create Wallet
          ['eth', KEYSTROKES.ENTER], // Chain: eth
          ['testnet', KEYSTROKES.ENTER], // Network: testnet
          [KEYSTROKES.ARROW_LEFT, KEYSTROKES.ENTER], // Multi-party?
          // No scheme prompt since TSS is the only option for ETH
          ['2-2', KEYSTROKES.ENTER], // M-N: 2-2
          ['copayer1', KEYSTROKES.ENTER], // Copayer name
          // No address type prompt here since ETH only has 1 address type
          ['testpassword', KEYSTROKES.ENTER], // Password
          // Checkpoint1: Wait for copayer2's pubkey
          [copayer2PubKey, KEYSTROKES.ENTER], // Done sharing -- (checkpoint1)
          // Checkpoint2: Extract join code to share with copayer2
          [KEYSTROKES.ENTER], // Done sharing -- (checkpoint2)
          [KEYSTROKES.ENTER], // Yes, continue with keyshare export
          [...Array(50).fill(KEYSTROKES.BACKSPACE), `${TEMP_DIR}/${walletName1}-export.json`, KEYSTROKES.ENTER], // Export keyshare backup file to temp dir
          ['exportpassword', KEYSTROKES.ENTER], // Password for exported keyshare backup file
          ['testpassword', KEYSTROKES.ENTER], // Unlock wallet
        ];
        const stepInputsC2 = [
          [KEYSTROKES.ARROW_DOWN], // Create Wallet -> Join Wallet
          [KEYSTROKES.ENTER], // Join Wallet
          ['eth', KEYSTROKES.ENTER], // Chain: eth
          // No scheme prompt since TSS is the only option for ETH
          ['testnet', KEYSTROKES.ENTER], // Network: testnet
          ['copayer2', KEYSTROKES.ENTER], // Copayer name
          ['testpassword', KEYSTROKES.ENTER], // Password
          // Checkpoint1: Extract pubkey to give to session leader (copayer1)
          [KEYSTROKES.ENTER], // Done sharing -- (checkpoint1)
          // Checkpoint2: Wait for and enter join code from copayer1 to join session
          [joinCode, KEYSTROKES.ENTER], // Enter session code from leader (copayer1)
          [KEYSTROKES.ENTER], // Confirm decoded join code looks correct
          [KEYSTROKES.ENTER], // Yes, continue with keyshare export
          [...Array(50).fill(KEYSTROKES.BACKSPACE), `${TEMP_DIR}/${walletName2}-export.json`, KEYSTROKES.ENTER], // Export keyshare backup file to temp dir
          ['exportpassword', KEYSTROKES.ENTER], // Password for exported keyshare backup file
          ['testpassword', KEYSTROKES.ENTER], // Unlock wallet
        ];
        const step = {
          [walletName1]: 0,
          [walletName2]: 0
        };
        const checkpointOutput = {
          [walletName1]: '',
          [walletName2]: ''
        };
        // stepInputs indexes corresponding to checkpoints in test flow where we want to assert on CLI output
        const checkpoints = {
          [walletName1]: new Set([7, 8]),
          [walletName2]: new Set([6, 7])
        };
        function pushInputs(walletName, stepInputs) {
          for (const input of stepInputs) {
            this.push(JSON.stringify({ walletName, chunk: input }));
          }
        }
        const io = new TssTransform({
          encoding: 'utf-8',
          transform: async function(data, encoding, respond) {
            try {
              data = JSON.parse(data.toString());
              const { walletName, chunk } = data;
              if (checkpoints[walletName].has(step[walletName])) {
                checkpointOutput[walletName] += chunk;
              } else {
                checkpointOutput[walletName] = '';
              }
              // Uncomment to see CLI output during test
              // walletName === walletName1 && process.stdout.write(chunk);
              // walletName === walletName2 && process.stdout.write(chunk);
              const stepInputs = walletName === walletName1 ? stepInputsC1 : stepInputsC2;

              const isStep = chunk.endsWith(OUTPUT_END_SEQ);
              if (isStep) {
                const lines = checkpointOutput[walletName].split('\n');
                switch (step[walletName]) {
                  default:
                    pushInputs.call(this, walletName, stepInputs[step[walletName]]);
                    break; // no-op for non-checkpoint steps
                  case Array.from(checkpoints[walletName])[0]:
                    if (walletName === walletName1) {
                      const startIdx = lines.findIndex(l => l.includes('Enter party 1\'s public key:'));
                      assert.ok(startIdx > -1);
                      const cachedStep = step[walletName]; // cache the step num so it's preserved for the promise handler
                      copayer2PubKeySet.then(() => {
                        stepInputs[cachedStep][0] = copayer2PubKey;
                        pushInputs.call(this, walletName, stepInputs[cachedStep]);
                      });
                    } else {
                      const startIdx = lines.findIndex(l => l.includes('Give the following public key to the session leader:'));
                      const endIdx = lines.findIndex(l => l.includes('Done'));
                      assert.ok(startIdx > -1, 'Did not find expected prompt to share public key with session leader. Output was: ' + checkpointOutput);
                      copayer2PubKey = helpers.decolor(lines.slice(startIdx + 1, endIdx).map(l => l.replace('│', '').trim()).join(''));
                      assert.match(copayer2PubKey, /^[0-9a-f]{66}$/, 'Invalid copayer2 public key. Got: ' + copayer2PubKey); // 66 byte hex pubkey string
                      emitter.emit('copayer2PubKey');
                      pushInputs.call(this, walletName, stepInputs[step[walletName]]);
                    }
                    checkpointOutput[walletName] = '';
                    break;
                  case Array.from(checkpoints[walletName])[1]:
                    if (walletName === walletName1) {
                      const startIdx = lines.findIndex(l => l.includes('Join code for party 1:'));
                      const endIdx = lines.findIndex(l => l.includes('Continue'));
                      assert.ok(startIdx > -1, 'Did not find expected prompt to share join code with session leader. Output was: ' + checkpointOutput);
                      joinCode = helpers.decolor(lines.slice(startIdx + 1, endIdx).map(l => l.replace('│', '').trim()).join(''));
                      assert.match(joinCode, /^[0-9a-f]{400,500}$/, 'Invalid join code. Got: ' + joinCode); // hex string between 400-500 chars long (expected to be around 418 chars. Length is just a sanity check. If any data is added to join code it'll need to be adjusted)
                      emitter.emit('joinCode');
                      pushInputs.call(this, walletName, stepInputs[step[walletName]]);
                    } else {
                      const startIdx = lines.findIndex(l => l.includes('Enter the join code from the session leader:'));
                      assert.ok(startIdx > -1);
                      const cachedStep = step[walletName]; // cache the step num so it's preserved for the promise handler
                      joinCodeSet.then(() => {
                        stepInputs[cachedStep][0] = joinCode;
                        pushInputs.call(this, walletName, stepInputs[cachedStep]);
                      });
                    }
                    checkpointOutput[walletName] = '';
                    break;
                }
                
                step[walletName]++;
              } else if (chunk.includes('Error:')) {
                return respond(chunk);
              } else if (chunk.endsWith(' created successfully!\n\n')) {
                this.push(JSON.stringify({ walletName, endIt: true })); // send EOF to child so it can exit cleanly
              }

              respond();
            } catch (e) {
              respond(e);
            }
          }
        });

        startTssWallets(io, [walletName1, walletName2], commonOpts);
        io.on('error', (e) => {
          done(e);
        });
        io.on('allClosed', (exitCodes: number[]) => {
          try {
            assert.deepEqual(exitCodes, [0, 0]);
            // Wallet 1
            const wallet1 = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, walletName1 + '.json'), 'utf-8'));
            assert.strictEqual(wallet1.credentials.chain, 'eth');
            assert.strictEqual(wallet1.credentials.network, 'testnet');
            // Still treated as single sig wallet
            assert.strictEqual(wallet1.credentials.m, 1);
            assert.strictEqual(wallet1.credentials.n, 1);
            // Ensure that sensitive wallet key properties are encrypted and not present in plaintext
            assert.ok(Object.hasOwn(wallet1.key, 'mnemonicEncrypted'));
            assert.ok(!Object.hasOwn(wallet1.key, 'mnemonic'));
            assert.ok(Object.hasOwn(wallet1.key, 'xPrivKeyEncrypted'));
            assert.ok(!Object.hasOwn(wallet1.key, 'xPrivKey'));
            assert.ok(Object.hasOwn(wallet1.key, 'xPrivKeyEDDSAEncrypted'));
            assert.ok(!Object.hasOwn(wallet1.key, 'xPrivKeyEDDSA'));
            // Ensure TSS fields are present and encrypted
            assert.ok(Object.hasOwn(wallet1, 'key'), 'No key property found on wallet');
            assert.ok(Object.hasOwn(wallet1.key, 'keychain'), 'No key.keychain property found on wallet');
            assert.strictEqual(typeof wallet1.key.keychain.commonKeyChain, 'string');
            assert.ok(wallet1.key.keychain.privateKeyShare == null, 'privateKeyShare should not be present on wallet keychain');
            assert.strictEqual(typeof wallet1.key.keychain.privateKeyShareEncrypted, 'string');
            assert.ok(wallet1.key.keychain.privateKeyShareEncrypted.startsWith('{"iv":"'), 'privateKeyShareEncrypted should be encrypted');
            assert.ok(wallet1.key.keychain.reducedPrivateKeyShare == null, 'reducedPrivateKeyShare should not be present on wallet keychain');
            assert.strictEqual(typeof wallet1.key.keychain.reducedPrivateKeyShareEncrypted, 'string');
            assert.ok(wallet1.key.keychain.reducedPrivateKeyShareEncrypted.startsWith('{"iv":"'), 'reducedPrivateKeyShareEncrypted should be encrypted');
            assert.ok(Object.hasOwn(wallet1.key, 'metadata'), 'No key.metadata property found on wallet');
            assert.strictEqual(typeof wallet1.key.metadata.id, 'string');
            assert.strictEqual(wallet1.key.metadata.m, 2);
            assert.strictEqual(wallet1.key.metadata.n, 2);

            // Wallet 2
            const wallet2 = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, walletName2 + '.json'), 'utf-8'));
            assert.strictEqual(wallet2.credentials.chain, 'eth');
            assert.strictEqual(wallet2.credentials.network, 'testnet');
            // Still treated as single sig wallet
            assert.strictEqual(wallet2.credentials.m, 1);
            assert.strictEqual(wallet2.credentials.n, 1);
            // Ensure that sensitive wallet key properties are encrypted and not present in plaintext
            assert.ok(Object.hasOwn(wallet2.key, 'mnemonicEncrypted'));
            assert.ok(!Object.hasOwn(wallet2.key, 'mnemonic'));
            assert.ok(Object.hasOwn(wallet2.key, 'xPrivKeyEncrypted'));
            assert.ok(!Object.hasOwn(wallet2.key, 'xPrivKey'));
            assert.ok(Object.hasOwn(wallet2.key, 'xPrivKeyEDDSAEncrypted'));
            assert.ok(!Object.hasOwn(wallet2.key, 'xPrivKeyEDDSA'));
            // Ensure TSS fields are present and encrypted
            assert.ok(Object.hasOwn(wallet2, 'key'), 'No key property found on wallet');
            assert.ok(Object.hasOwn(wallet2.key, 'keychain'), 'No key.keychain property found on wallet');
            assert.strictEqual(typeof wallet2.key.keychain.commonKeyChain, 'string');
            assert.ok(wallet2.key.keychain.privateKeyShare == null, 'privateKeyShare should not be present on wallet keychain');
            assert.strictEqual(typeof wallet2.key.keychain.privateKeyShareEncrypted, 'string');
            assert.ok(wallet2.key.keychain.privateKeyShareEncrypted.startsWith('{"iv":"'), 'privateKeyShareEncrypted should be encrypted');
            assert.ok(wallet2.key.keychain.reducedPrivateKeyShare == null, 'reducedPrivateKeyShare should not be present on wallet keychain');
            assert.strictEqual(typeof wallet2.key.keychain.reducedPrivateKeyShareEncrypted, 'string');
            assert.ok(wallet2.key.keychain.reducedPrivateKeyShareEncrypted.startsWith('{"iv":"'), 'reducedPrivateKeyShareEncrypted should be encrypted');
            assert.ok(Object.hasOwn(wallet2.key, 'metadata'), 'No key.metadata property found on wallet');
            assert.strictEqual(typeof wallet2.key.metadata.id, 'string');
            assert.strictEqual(wallet2.key.metadata.m, 2);
            assert.strictEqual(wallet2.key.metadata.n, 2);

            // Check wallets are copayers of the same wallet
            assert.strictEqual(wallet1.credentials.walletId, wallet2.credentials.walletId, 'Wallet IDs do not match');
            assert.strictEqual(wallet1.key.metadata.id, wallet2.key.metadata.id, 'Key metadata IDs do not match');
            assert.strictEqual(wallet1.key.keychain.commonKeyChain, wallet2.key.keychain.commonKeyChain, 'Common key chains do not match');

            // Check keyshare backup files
            const keyshareBackup1 = path.join(TEMP_DIR, walletName1 + '-export.json');
            assert.ok(fs.existsSync(keyshareBackup1), 'Keyshare backup file not found for wallet 1');
            const keyshare1 = JSON.parse(fs.readFileSync(keyshareBackup1, 'utf-8'));
            assert.ok(keyshare1.iv && keyshare1.mode && keyshare1.cipher && keyshare1.ct, 'Keyshare backup 1 does not appear to be encrypted');
            assert.strictEqual(keyshare1.cipher + keyshare1.mode, 'aesgcm', 'Expected keyshare backup 1 to be encrypted with AES-GCM');
            const keyshareBackup2 = path.join(TEMP_DIR, walletName2 + '-export.json');
            assert.ok(fs.existsSync(keyshareBackup2), 'Keyshare backup file not found for wallet 2');
            const keyshare2 = JSON.parse(fs.readFileSync(keyshareBackup2, 'utf-8'));
            assert.ok(keyshare2.iv && keyshare2.mode && keyshare2.cipher && keyshare2.ct, 'Keyshare backup 2 does not appear to be encrypted');
            assert.strictEqual(keyshare2.cipher + keyshare2.mode, 'aesgcm', 'Expected keyshare backup 2 to be encrypted with AES-GCM');

            done();
          } catch (e) {
            done(e);
          }
        });
      });
    });

    describe('XRP', function() {
      const walletName1 = 'xrp-tss-temp1';
      const walletName2 = 'xrp-tss-temp2';

      it('should create a threshold XRP wallet', function(done) {
        let copayer2PubKey: string;
        let joinCode: string;
        const emitter = new EventEmitter();
        const copayer2PubKeySet = new Promise(r => emitter.once('copayer2PubKey', r));
        const joinCodeSet = new Promise(r => emitter.once('joinCode', r));

        const stepInputsC1 = [
          [KEYSTROKES.ENTER], // Create Wallet
          ['xrp', KEYSTROKES.ENTER], // Chain: xrp
          ['testnet', KEYSTROKES.ENTER], // Network: testnet
          [KEYSTROKES.ARROW_LEFT, KEYSTROKES.ENTER], // Multi-party? Yes
          // No scheme prompt since TSS is the only option for XRP
          ['2-2', KEYSTROKES.ENTER], // M-N: 2-2
          ['copayer1', KEYSTROKES.ENTER], // Copayer name
          // No address type prompt here since XRP only has 1 address type
          ['testpassword', KEYSTROKES.ENTER], // Password
          // Checkpoint1: Wait for copayer2's pubkey
          [copayer2PubKey, KEYSTROKES.ENTER], // Done sharing -- (checkpoint1)
          // Checkpoint2: Extract join code to share with copayer2
          [KEYSTROKES.ENTER], // Done sharing -- (checkpoint2)
          [KEYSTROKES.ENTER], // Yes, continue with keyshare export
          [...Array(50).fill(KEYSTROKES.BACKSPACE), `${TEMP_DIR}/${walletName1}-export.json`, KEYSTROKES.ENTER], // Export keyshare backup file to temp dir
          ['exportpassword', KEYSTROKES.ENTER], // Password for exported keyshare backup file
          ['testpassword', KEYSTROKES.ENTER], // Unlock wallet
        ];
        const stepInputsC2 = [
          [KEYSTROKES.ARROW_DOWN], // Create Wallet -> Join Wallet
          [KEYSTROKES.ENTER], // Join Wallet
          ['xrp', KEYSTROKES.ENTER], // Chain: xrp
          // No scheme prompt since TSS is the only option for XRP
          ['testnet', KEYSTROKES.ENTER], // Network: testnet
          ['copayer2', KEYSTROKES.ENTER], // Copayer name
          ['testpassword', KEYSTROKES.ENTER], // Password
          // Checkpoint1: Extract pubkey to give to session leader (copayer1)
          [KEYSTROKES.ENTER], // Done sharing -- (checkpoint1)
          // Checkpoint2: Wait for and enter join code from copayer1 to join session
          [joinCode, KEYSTROKES.ENTER], // Enter session code from leader (copayer1)
          [KEYSTROKES.ENTER], // Confirm decoded join code looks correct
          [KEYSTROKES.ENTER], // Yes, continue with keyshare export
          [...Array(50).fill(KEYSTROKES.BACKSPACE), `${TEMP_DIR}/${walletName2}-export.json`, KEYSTROKES.ENTER], // Export keyshare backup file to temp dir
          ['exportpassword', KEYSTROKES.ENTER], // Password for exported keyshare backup file
          ['testpassword', KEYSTROKES.ENTER], // Unlock wallet
        ];
        const step = {
          [walletName1]: 0,
          [walletName2]: 0
        };
        const checkpointOutput = {
          [walletName1]: '',
          [walletName2]: ''
        };
        // stepInputs indexes corresponding to checkpoints in test flow where we want to assert on CLI output
        const checkpoints = {
          [walletName1]: new Set([7, 8]),
          [walletName2]: new Set([6, 7])
        };
        function pushInputs(walletName, stepInputs) {
          for (const input of stepInputs) {
            this.push(JSON.stringify({ walletName, chunk: input }));
          }
        }
        const io = new TssTransform({
          encoding: 'utf-8',
          transform: async function(data, encoding, respond) {
            try {
              data = JSON.parse(data.toString());
              const { walletName, chunk } = data;
              if (checkpoints[walletName].has(step[walletName])) {
                checkpointOutput[walletName] += chunk;
              } else {
                checkpointOutput[walletName] = '';
              }
              // Uncomment to see CLI output during test
              // walletName === walletName1 && process.stdout.write(chunk);
              const stepInputs = walletName === walletName1 ? stepInputsC1 : stepInputsC2;

              const isStep = chunk.endsWith(OUTPUT_END_SEQ);
              if (isStep) {
                const lines = checkpointOutput[walletName].split('\n');
                switch (step[walletName]) {
                  default:
                    pushInputs.call(this, walletName, stepInputs[step[walletName]]);
                    break; // no-op for non-checkpoint steps
                  case Array.from(checkpoints[walletName])[0]:
                    if (walletName === walletName1) {
                      const startIdx = lines.findIndex(l => l.includes('Enter party 1\'s public key:'));
                      assert.ok(startIdx > -1);
                      const cachedStep = step[walletName]; // cache the step num so it's preserved for the promise handler
                      copayer2PubKeySet.then(() => {
                        stepInputs[cachedStep][0] = copayer2PubKey;
                        pushInputs.call(this, walletName, stepInputs[cachedStep]);
                      });
                    } else {
                      const startIdx = lines.findIndex(l => l.includes('Give the following public key to the session leader:'));
                      const endIdx = lines.findIndex(l => l.includes('Done'));
                      assert.ok(startIdx > -1, 'Did not find expected prompt to share public key with session leader. Output was: ' + checkpointOutput);
                      copayer2PubKey = helpers.decolor(lines.slice(startIdx + 1, endIdx).map(l => l.replace('│', '').trim()).join(''));
                      assert.match(copayer2PubKey, /^[0-9a-f]{66}$/, 'Invalid copayer2 public key. Got: ' + copayer2PubKey); // 66 byte hex pubkey string
                      emitter.emit('copayer2PubKey');
                      pushInputs.call(this, walletName, stepInputs[step[walletName]]);
                    }
                    checkpointOutput[walletName] = '';
                    break;
                  case Array.from(checkpoints[walletName])[1]:
                    if (walletName === walletName1) {
                      const startIdx = lines.findIndex(l => l.includes('Join code for party 1:'));
                      const endIdx = lines.findIndex(l => l.includes('Continue'));
                      assert.ok(startIdx > -1, 'Did not find expected prompt to share join code with session leader. Output was: ' + checkpointOutput);
                      joinCode = helpers.decolor(lines.slice(startIdx + 1, endIdx).map(l => l.replace('│', '').trim()).join(''));
                      assert.match(joinCode, /^[0-9a-f]{400,500}$/, 'Invalid join code. Got: ' + joinCode); // hex string between 400-500 chars long (expected to be around 418 chars. Length is just a sanity check. If any data is added to join code it'll need to be adjusted)
                      emitter.emit('joinCode');
                      pushInputs.call(this, walletName, stepInputs[step[walletName]]);
                    } else {
                      const startIdx = lines.findIndex(l => l.includes('Enter the join code from the session leader:'));
                      assert.ok(startIdx > -1);
                      const cachedStep = step[walletName]; // cache the step num so it's preserved for the promise handler
                      joinCodeSet.then(() => {
                        stepInputs[cachedStep][0] = joinCode;
                        pushInputs.call(this, walletName, stepInputs[cachedStep]);
                      });
                    }
                    checkpointOutput[walletName] = '';
                    break;
                }
                
                step[walletName]++;
              } else if (chunk.includes('Error:')) {
                return respond(chunk);
              } else if (chunk.endsWith(' created successfully!\n\n')) {
                this.push(JSON.stringify({ walletName, endIt: true })); // send EOF to child so it can exit cleanly
              }

              respond();
            } catch (e) {
              respond(e);
            }
          }
        });

        startTssWallets(io, [walletName1, walletName2], commonOpts);
        io.on('error', (e) => {
          done(e);
        });
        io.on('allClosed', (exitCodes: number[]) => {
          try {
            assert.deepEqual(exitCodes, [0, 0]);
            // Wallet 1
            const wallet1 = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, walletName1 + '.json'), 'utf-8'));
            assert.strictEqual(wallet1.credentials.chain, 'xrp');
            assert.strictEqual(wallet1.credentials.network, 'testnet');
            // Still treated as single sig wallet
            assert.strictEqual(wallet1.credentials.m, 1);
            assert.strictEqual(wallet1.credentials.n, 1);
            // Ensure that sensitive wallet key properties are encrypted and not present in plaintext
            assert.ok(Object.hasOwn(wallet1.key, 'mnemonicEncrypted'));
            assert.ok(!Object.hasOwn(wallet1.key, 'mnemonic'));
            assert.ok(Object.hasOwn(wallet1.key, 'xPrivKeyEncrypted'));
            assert.ok(!Object.hasOwn(wallet1.key, 'xPrivKey'));
            assert.ok(Object.hasOwn(wallet1.key, 'xPrivKeyEDDSAEncrypted'));
            assert.ok(!Object.hasOwn(wallet1.key, 'xPrivKeyEDDSA'));
            // Ensure TSS fields are present and encrypted
            assert.ok(Object.hasOwn(wallet1, 'key'), 'No key property found on wallet');
            assert.ok(Object.hasOwn(wallet1.key, 'keychain'), 'No key.keychain property found on wallet');
            assert.strictEqual(typeof wallet1.key.keychain.commonKeyChain, 'string');
            assert.ok(wallet1.key.keychain.privateKeyShare == null, 'privateKeyShare should not be present on wallet keychain');
            assert.strictEqual(typeof wallet1.key.keychain.privateKeyShareEncrypted, 'string');
            assert.ok(wallet1.key.keychain.privateKeyShareEncrypted.startsWith('{"iv":"'), 'privateKeyShareEncrypted should be encrypted');
            assert.ok(wallet1.key.keychain.reducedPrivateKeyShare == null, 'reducedPrivateKeyShare should not be present on wallet keychain');
            assert.strictEqual(typeof wallet1.key.keychain.reducedPrivateKeyShareEncrypted, 'string');
            assert.ok(wallet1.key.keychain.reducedPrivateKeyShareEncrypted.startsWith('{"iv":"'), 'reducedPrivateKeyShareEncrypted should be encrypted');
            assert.ok(Object.hasOwn(wallet1.key, 'metadata'), 'No key.metadata property found on wallet');
            assert.strictEqual(typeof wallet1.key.metadata.id, 'string');
            assert.strictEqual(wallet1.key.metadata.m, 2);
            assert.strictEqual(wallet1.key.metadata.n, 2);

            // Wallet 2
            const wallet2 = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, walletName2 + '.json'), 'utf-8'));
            assert.strictEqual(wallet2.credentials.chain, 'xrp');
            assert.strictEqual(wallet2.credentials.network, 'testnet');
            // Still treated as single sig wallet
            assert.strictEqual(wallet2.credentials.m, 1);
            assert.strictEqual(wallet2.credentials.n, 1);
            // Ensure that sensitive wallet key properties are encrypted and not present in plaintext
            assert.ok(Object.hasOwn(wallet2.key, 'mnemonicEncrypted'));
            assert.ok(!Object.hasOwn(wallet2.key, 'mnemonic'));
            assert.ok(Object.hasOwn(wallet2.key, 'xPrivKeyEncrypted'));
            assert.ok(!Object.hasOwn(wallet2.key, 'xPrivKey'));
            assert.ok(Object.hasOwn(wallet2.key, 'xPrivKeyEDDSAEncrypted'));
            assert.ok(!Object.hasOwn(wallet2.key, 'xPrivKeyEDDSA'));
            // Ensure TSS fields are present and encrypted
            assert.ok(Object.hasOwn(wallet2, 'key'), 'No key property found on wallet');
            assert.ok(Object.hasOwn(wallet2.key, 'keychain'), 'No key.keychain property found on wallet');
            assert.strictEqual(typeof wallet2.key.keychain.commonKeyChain, 'string');
            assert.ok(wallet2.key.keychain.privateKeyShare == null, 'privateKeyShare should not be present on wallet keychain');
            assert.strictEqual(typeof wallet2.key.keychain.privateKeyShareEncrypted, 'string');
            assert.ok(wallet2.key.keychain.privateKeyShareEncrypted.startsWith('{"iv":"'), 'privateKeyShareEncrypted should be encrypted');
            assert.ok(wallet2.key.keychain.reducedPrivateKeyShare == null, 'reducedPrivateKeyShare should not be present on wallet keychain');
            assert.strictEqual(typeof wallet2.key.keychain.reducedPrivateKeyShareEncrypted, 'string');
            assert.ok(wallet2.key.keychain.reducedPrivateKeyShareEncrypted.startsWith('{"iv":"'), 'reducedPrivateKeyShareEncrypted should be encrypted');
            assert.ok(Object.hasOwn(wallet2.key, 'metadata'), 'No key.metadata property found on wallet');
            assert.strictEqual(typeof wallet2.key.metadata.id, 'string');
            assert.strictEqual(wallet2.key.metadata.m, 2);
            assert.strictEqual(wallet2.key.metadata.n, 2);

            // Check wallets are copayers of the same wallet
            assert.strictEqual(wallet1.credentials.walletId, wallet2.credentials.walletId, 'Wallet IDs do not match');
            assert.strictEqual(wallet1.key.metadata.id, wallet2.key.metadata.id, 'Key metadata IDs do not match');
            assert.strictEqual(wallet1.key.keychain.commonKeyChain, wallet2.key.keychain.commonKeyChain, 'Common key chains do not match');

            // Check keyshare backup files
            const keyshareBackup1 = path.join(TEMP_DIR, walletName1 + '-export.json');
            assert.ok(fs.existsSync(keyshareBackup1), 'Keyshare backup file not found for wallet 1');
            const keyshare1 = JSON.parse(fs.readFileSync(keyshareBackup1, 'utf-8'));
            assert.ok(keyshare1.iv && keyshare1.mode && keyshare1.cipher && keyshare1.ct, 'Keyshare backup 1 does not appear to be encrypted');
            assert.strictEqual(keyshare1.cipher + keyshare1.mode, 'aesgcm', 'Expected keyshare backup 1 to be encrypted with AES-GCM');
            const keyshareBackup2 = path.join(TEMP_DIR, walletName2 + '-export.json');
            assert.ok(fs.existsSync(keyshareBackup2), 'Keyshare backup file not found for wallet 2');
            const keyshare2 = JSON.parse(fs.readFileSync(keyshareBackup2, 'utf-8'));
            assert.ok(keyshare2.iv && keyshare2.mode && keyshare2.cipher && keyshare2.ct, 'Keyshare backup 2 does not appear to be encrypted');
            assert.strictEqual(keyshare2.cipher + keyshare2.mode, 'aesgcm', 'Expected keyshare backup 2 to be encrypted with AES-GCM');

            done();
          } catch (e) {
            done(e);
          }
        });
      });
    });
  });
});