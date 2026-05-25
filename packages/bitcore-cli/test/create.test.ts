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
      });
    });

    it('should create an SOL wallet', function(done) {
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
                  assert.ok(startIdx > -1);
                  secret = helpers.decolor(lines[startIdx + 1].trim());
                  assert.match(secret, /^[0-9A-z]{64,}$/); // base58 string at least 64 chars long
                  assert.ok(secret.endsWith('Tbtc')); // testnet btc
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
            assert.equal(code, 1); // Exit code 1 since flow is cancelled with ctrl+c
            // No wallet file should have been created or saved
            assert.ok(!fs.existsSync(path.join(TEMP_DIR, walletName + '.json')));
            done();
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
          [KEYSTROKES.ENTER], // View mnemonic
          [':', 'q', KEYSTROKES.ENTER] // vim input to quit viewing mnemonic
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
          [KEYSTROKES.ENTER], // View mnemonic
          [':', 'q', KEYSTROKES.ENTER] // vim input to quit viewing mnemonic
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

            const isStep = chunk.endsWith(OUTPUT_END_SEQ) || step[walletName] == stepInputs.length - 1; // viewing mnemonic
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
                    assert.ok(startIdx > -1);
                    copayer2PubKey = helpers.decolor(lines[startIdx + 1].trim());
                    assert.match(copayer2PubKey, /^[0-9a-f]{66}$/); // 66 byte hex pubkey string
                    emitter.emit('copayer2PubKey');
                    pushInputs.call(this, walletName, stepInputs[step[walletName]]);
                  }
                  checkpointOutput[walletName] = '';
                  break;
                case Array.from(checkpoints[walletName])[1]:
                  if (walletName === walletName1) {
                    const startIdx = lines.findIndex(l => l.includes('Join code for party 1:'));
                    assert.ok(startIdx > -1);
                    joinCode = helpers.decolor(lines[startIdx + 1].trim());
                    assert.match(joinCode, /^[0-9a-f]{400,500}$/); // hex string between 400-500 chars long (expected to be around 418 chars. Length is just a sanity check. If any data is added to join code it'll need to be adjusted)
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
          }
        });

        startTssWallets(io, [walletName1, walletName2], commonOpts);
        io.on('error', (e) => {
          done(e);
        });
        io.on('allClosed', (exitCodes: number[]) => {
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

          done();
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
          [KEYSTROKES.ENTER], // View mnemonic
          [':', 'q', KEYSTROKES.ENTER] // vim input to quit viewing mnemonic
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
          [KEYSTROKES.ENTER], // View mnemonic
          [':', 'q', KEYSTROKES.ENTER] // vim input to quit viewing mnemonic
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

            const isStep = chunk.endsWith(OUTPUT_END_SEQ) || step[walletName] == stepInputs.length - 1; // viewing mnemonic
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
                    assert.ok(startIdx > -1);
                    copayer2PubKey = helpers.decolor(lines[startIdx + 1].trim());
                    assert.match(copayer2PubKey, /^[0-9a-f]{66}$/); // 66 byte hex pubkey string
                    emitter.emit('copayer2PubKey');
                    pushInputs.call(this, walletName, stepInputs[step[walletName]]);
                  }
                  checkpointOutput[walletName] = '';
                  break;
                case Array.from(checkpoints[walletName])[1]:
                  if (walletName === walletName1) {
                    const startIdx = lines.findIndex(l => l.includes('Join code for party 1:'));
                    assert.ok(startIdx > -1);
                    joinCode = helpers.decolor(lines[startIdx + 1].trim());
                    assert.match(joinCode, /^[0-9a-f]{400,500}$/); // hex string between 400-500 chars long (expected to be around 418 chars. Length is just a sanity check. If any data is added to join code it'll need to be adjusted)
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
          }
        });

        startTssWallets(io, [walletName1, walletName2], commonOpts);
        io.on('error', (e) => {
          done(e);
        });
        io.on('allClosed', (exitCodes: number[]) => {
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

          done();
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
          [KEYSTROKES.ENTER], // View mnemonic
          [':', 'q', KEYSTROKES.ENTER] // vim input to quit viewing mnemonic
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
          [KEYSTROKES.ENTER], // View mnemonic
          [':', 'q', KEYSTROKES.ENTER] // vim input to quit viewing mnemonic
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

            const isStep = chunk.endsWith(OUTPUT_END_SEQ) || step[walletName] == stepInputs.length - 1; // viewing mnemonic
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
                    assert.ok(startIdx > -1);
                    copayer2PubKey = helpers.decolor(lines[startIdx + 1].trim());
                    assert.match(copayer2PubKey, /^[0-9a-f]{66}$/); // 66 byte hex pubkey string
                    emitter.emit('copayer2PubKey');
                    pushInputs.call(this, walletName, stepInputs[step[walletName]]);
                  }
                  checkpointOutput[walletName] = '';
                  break;
                case Array.from(checkpoints[walletName])[1]:
                  if (walletName === walletName1) {
                    const startIdx = lines.findIndex(l => l.includes('Join code for party 1:'));
                    assert.ok(startIdx > -1);
                    joinCode = helpers.decolor(lines[startIdx + 1].trim());
                    assert.match(joinCode, /^[0-9a-f]{400,500}$/); // hex string between 400-500 chars long (expected to be around 418 chars. Length is just a sanity check. If any data is added to join code it'll need to be adjusted)
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
          }
        });

        startTssWallets(io, [walletName1, walletName2], commonOpts);
        io.on('error', (e) => {
          done(e);
        });
        io.on('allClosed', (exitCodes: number[]) => {
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

          done();
        });
      });
    });
  });
});