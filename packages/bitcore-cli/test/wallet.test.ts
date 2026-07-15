import { spawn } from 'child_process';
import assert from 'assert';
import sinon from 'sinon';
import fs from 'fs';
import os from 'os';
import { Transform } from 'stream';
import * as helpers from './helpers';
import * as walletData from './data/walletsData';
import { Utils } from '../src/utils';

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
});