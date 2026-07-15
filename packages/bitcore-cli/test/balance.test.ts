import { spawn } from 'child_process';
import assert from 'assert';
import sinon from 'sinon';
import { Transform } from 'stream';
import * as helpers from './helpers';
import * as walletData from './data/walletsData';
import * as addressesData from './data/addressesData';

describe('Balance', function() {
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

  it('should show balances of zero', function(done) {
    const stepInputs = [
      [KEYSTROKES.ARROW_DOWN], // Proposals -> Send
      [KEYSTROKES.ARROW_DOWN], // Send -> Receive
      [KEYSTROKES.ARROW_DOWN], // Receive -> History
      [KEYSTROKES.ARROW_DOWN], // History -> Balance
      [KEYSTROKES.ENTER], // Balance
      // Checkpoint1: Balance view shows expected balances
      [KEYSTROKES.ARROW_DOWN], // Main Menu -> Exit (checkpoint1)
      [KEYSTROKES.ENTER], // Exit
    ];
    let step = 0;
    let checkpointOutput = '';
    // stepInputs indexes corresponding to checkpoints in test flow where we want to assert on CLI output
    const checkpoints = new Set([5]);
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
              // Assert balance output contains expected info for no balance
              assert.match(checkpointOutput, /BTC Balance/);
              assert.match(checkpointOutput, /Total: 0 BTC/);
              assert.match(checkpointOutput, /Confirmed: 0 BTC/);
              assert.match(checkpointOutput, /Available: 0 BTC/);
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

  it('should show non-zero balances', function(done) {
    helpers.blockchainExplorerMock.setUtxo(addressesData.addressesBtcSingleSig[0], 0.456);
    helpers.blockchainExplorerMock.setUtxo(addressesData.addressesBtcSingleSig[1], 4.123);

    const stepInputs = [
      [KEYSTROKES.ARROW_DOWN], // Proposals -> Send
      [KEYSTROKES.ARROW_DOWN], // Send -> Receive
      [KEYSTROKES.ARROW_DOWN], // Receive -> History
      [KEYSTROKES.ARROW_DOWN], // History -> Balance
      [KEYSTROKES.ENTER], // Balance
      // Checkpoint1: Balance view shows expected balances
      [KEYSTROKES.ARROW_DOWN], // Main Menu -> Exit (checkpoint1)
      [KEYSTROKES.ENTER], // Exit
    ];
    let step = 0;
    let checkpointOutput = '';
    // stepInputs indexes corresponding to checkpoints in test flow where we want to assert on CLI output
    const checkpoints = new Set([5]);
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
              // Assert balance output contains expected info for non-zero balances
              assert.match(checkpointOutput, /BTC Balance/);
              assert.match(checkpointOutput, /Total: 4.579 BTC/);
              assert.match(checkpointOutput, /Confirmed: 4.579 BTC/);
              assert.match(checkpointOutput, /Available: 4.579 BTC/);
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