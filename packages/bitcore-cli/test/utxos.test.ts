import { spawn } from 'child_process';
import assert from 'assert';
import sinon from 'sinon';
import { Transform } from 'stream';
import * as helpers from './helpers';
import * as walletData from './data/walletsData';
import * as addressesData from './data/addressesData';

describe('UTXOs', function() {
  this.timeout(Math.max(this['_timeout'] || 0, 5000));
  const { KEYSTROKES, WALLETS, OUTPUT_END_SEQ } = helpers.CONSTANTS;
  const { CLI_EXEC, CLI_OPTS, COMMON_OPTS, DIR } = WALLETS;
  const cmdOpts = [...COMMON_OPTS, '--dir', DIR];

  before(async function() {
    await helpers.startBws();
    await helpers.loadWalletData(walletData.btcSingleSigWallet);
    await helpers.loadWalletAddressData(walletData.btcSingleSigWallet, addressesData.addressesBtcSingleSig);
    sinon.stub(process, 'exit').throws(new Error('process.exit was called')); // prevent accidental exits during test
  });

  after(async function() {
    await helpers.stopBws();
    sinon.restore();
  });

  it('should show zero UTXOs', function(done) {
    helpers.blockchainExplorerMock.utxos = []; // clear any existing UTXOs
    const stepInputs = [
      [KEYSTROKES.ARROW_UP], // Proposals -> Exit
      [KEYSTROKES.ARROW_UP], // Exit -> Show Advanced
      [KEYSTROKES.ENTER], // Show Advanced Options ...-> Message
      [KEYSTROKES.ARROW_DOWN], // Message -> Addresses
      [KEYSTROKES.ARROW_DOWN], // Addresses -> UTXOs
      [KEYSTROKES.ENTER], // UTXOs
      // Checkpoint1: UTXOs view shows expected UTXOs
      [KEYSTROKES.ARROW_DOWN], // Main Menu -> Exit (checkpoint1)
      [KEYSTROKES.ENTER], // Exit
    ];
    let step = 0;
    let checkpointOutput = '';
    // stepInputs indexes corresponding to checkpoints in test flow where we want to assert on CLI output
    const checkpoints = new Set([6]);
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
            for (const input of stepInputs[step]) {
              this.push(input);
            }
            if (step === Array.from(checkpoints)[0]) {
              // Assert UTXOs output contains expected info for no UTXOs
              assert.match(checkpointOutput, /No UTXOs found for this wallet./);
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
          respond(e);
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

  it('should show UTXOs', function(done) {
    helpers.blockchainExplorerMock.setUtxo(addressesData.addressesBtcSingleSig[0], 0.456, 1, 20);
    helpers.blockchainExplorerMock.setUtxo(addressesData.addressesBtcSingleSig[1], 4.123, 1, 10);

    const stepInputs = [
      [KEYSTROKES.ARROW_UP], // Proposals -> Exit
      [KEYSTROKES.ARROW_UP], // Exit -> Show Advanced
      [KEYSTROKES.ENTER], // Show Advanced Options ...-> Message
      [KEYSTROKES.ARROW_DOWN], // Message -> Addresses
      [KEYSTROKES.ARROW_DOWN], // Addresses -> UTXOs
      [KEYSTROKES.ENTER], // UTXOs
      // Checkpoint1: UTXOs view shows expected UTXOs
      ['x'], // Exit UTXOs view (checkpoint1)
      [KEYSTROKES.ARROW_DOWN], // Main Menu -> Exit
      [KEYSTROKES.ENTER], // Exit
    ];
    let step = 0;
    let checkpointOutput = '';
    // stepInputs indexes corresponding to checkpoints in test flow where we want to assert on CLI output
    const checkpoints = new Set([6]);
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
            for (const input of stepInputs[step]) {
              this.push(input);
            }
            if (step === Array.from(checkpoints)[0]) {
              // Assert UTXOs output contains expected info for non-zero UTXOs
              assert.match(checkpointOutput, /◇ {2}UTXOs ─────/);
              assert.match(checkpointOutput, /\[[0-9a-f]+\.{3}[0-9a-f]+:0\] 0.456 BTC/);
              assert.match(checkpointOutput, /\[[0-9a-f]+\.{3}[0-9a-f]+:0\] 4.123 BTC/);
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
          respond(e);
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