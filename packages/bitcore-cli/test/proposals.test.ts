import { spawn } from 'child_process';
import assert from 'assert';
import { Transform } from 'stream';
import * as helpers from './helpers';
import * as walletData from './data/walletsData';
import * as proposalData from './data/proposalsData';
import { Utils } from '../src/utils';

describe('Proposals', function() {
  this.timeout(Math.max(this['_timeout'] || 0, 5000));
  const { KEYSTROKES, WALLETS } = helpers.CONSTANTS;
  const { CLI_EXEC, COMMON_OPTS, DIR } = WALLETS;
  const cmdOpts = [...COMMON_OPTS, '--dir', DIR];

  before(async function() {
    await helpers.startBws();
    await helpers.loadWalletData(walletData.btcSingleSigWallet);
  });

  after(async function() {
    await helpers.stopBws();
  });

  it('should show no pending proposals', function(done) {
    const stepInputs = [
      [KEYSTROKES.ENTER], // Proposals
      // Checkpoint1: Proposals view shows no more proposals
      ['x'], // Close -- (checkpoint1)
      [KEYSTROKES.ARROW_UP], // Proposals -> Exit
      [KEYSTROKES.ENTER], // Exit
    ];
    let step = 0;
    let checkpointOutput = '';
    // stepInputs indexes corresponding to checkpoints in test flow where we want to assert on CLI output
    const checkpoints = new Set([1]);
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

        const isStep = chunk.endsWith('└\n');
        if (isStep) {
          for (const input of stepInputs[step]) {
            this.push(input);
          }
          if (checkpoints.has(step)) {
            // Assert proposals output contains expected info for no pending proposals
            assert.match(checkpointOutput, /No more proposals/);
          }
          step++;
        } else if (chunk.includes('Error:')) {
          return respond(chunk);
        }
        if (chunk.includes('👋')) {
          child.stdin.end(); // send EOF to child so it can exit cleanly
        }
        respond();
      }
    });
    const child = spawn('node', [CLI_EXEC, WALLETS.BTC.SINGLE_SIG, ...cmdOpts]);
    child.stderr.pipe(process.stderr);
    child.stdout.pipe(io).pipe(child.stdin);
    io.on('error', (e) => {
      done(e);
    });
    child.on('error', (e) => {
      done(e);
    });
    child.on('close', (code) => {
      assert.equal(code, 0);
      done();
    });
  });

  describe('Pending Proposals', function() {
    beforeEach(async function() {
      await helpers.loadWalletProposalData(proposalData.btcSingleSigProposal);
    });

    it('should show 1 pending proposal', function(done) {
      const stepInputs = [
        // Checkpoint1: Proposals option should show 1 pending proposal
        [KEYSTROKES.ENTER], // Proposals -- (checkpoint1)
        // Checkpoint2: Proposals view shows pending proposal
        ['x'], // Close -- (checkpoint2)
        [KEYSTROKES.ARROW_UP], // Proposals -> Exit
        [KEYSTROKES.ENTER], // Exit
      ];
      let step = 0;
      let checkpointOutput = '';
      // stepInputs indexes corresponding to checkpoints in test flow where we want to assert on CLI output
      const checkpoints = new Set([0, 1]);
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

          const isStep = chunk.endsWith('└\n');
          if (isStep) {
            for (const input of stepInputs[step]) {
              this.push(input);
            }
            switch (step) {
              default:
                break; // no-op for non-checkpoint steps
              case Array.from(checkpoints)[0]:
                // Assert there's an indication of a pending proposal in main menu
                assert.ok(checkpointOutput.includes(`Proposals${Utils.colorText(' (1)', 'yellow')}`));
                break;
              case Array.from(checkpoints)[1]:
                const lines = checkpointOutput.split('\n');
                const startIdx = lines.findIndex(l => l.includes('ID: e43b0fe2-c2d2-43c2-afaa-7fb28f212230 '));
                assert.ok(startIdx > -1);
                assert.ok(lines[startIdx + 2].includes('Chain: BTC'));
                assert.ok(lines[startIdx + 3].includes('Network: Regtest'));
                assert.ok(lines[startIdx + 4].includes('Amount: 0.123 BTC'));
                assert.ok(lines[startIdx + 5].includes('Fee: 0.00000141 BTC'));
                assert.ok(lines[startIdx + 6].includes('Total Amount: 0.12300141 BTC'));
                assert.ok(lines[startIdx + 7].includes('Fee Rate: 1 sat/B'));
                assert.ok(lines[startIdx + 8].includes('Status: pending'));
                assert.ok(lines[startIdx + 9].includes('Creator: kjoseph'));
                assert.ok(lines[startIdx + 10].includes('Created: Tue Mar 24 2026 16:02:23 EDT'));
                assert.ok(lines[startIdx + 11].includes('---------------------------'));
                assert.ok(lines[startIdx + 12].includes('Recipients:'));
                assert.ok(lines[startIdx + 13].includes('→ bcrt1qdq929kz9r7adapvruevgz0nkkqd3cpfvgh7wny: 0.123 BTC'));
                assert.ok(lines[startIdx + 14].includes('↲ bcrt1q9nh7nzrcgzm96r4ms0mm9xvl3whfrucvdh0akr (change - m/1/0)'));
                assert.ok(lines[startIdx + 15].includes('---------------------------'));
                assert.ok(lines[startIdx + 16].includes(Utils.colorText('Missing Signatures: 1', 'yellow')));
                break;
            }
            step++;
          }
          if (chunk.includes('👋')) {
            child.stdin.end(); // send EOF to child so it can exit cleanly
          }
          respond();
        }
      });
      const child = spawn('node', [CLI_EXEC, WALLETS.BTC.SINGLE_SIG, ...cmdOpts]);
      child.stderr.pipe(process.stderr);
      child.stdout.pipe(io).pipe(child.stdin);
      io.on('error', (e) => {
        done(e);
      });
      child.on('error', (e) => {
        done(e);
      });
      child.on('close', (code) => {
        assert.equal(code, 0);
        done();
      });
    });

    it('should accept 1 pending proposal', function(done) {
      const stepInputs = [
        // Checkpoint1: Proposals option should show 1 pending proposal
        [KEYSTROKES.ENTER], // Proposals -- (checkpoint1)
        ['a'], // Accept
        // Checkpoint2: Proposals view shows accepted proposal
        ['x'], // Close -- (checkpoint2)
        [KEYSTROKES.ARROW_UP], // Proposals -> Exit
        [KEYSTROKES.ENTER], // Exit
      ];
      let step = 0;
      let checkpointOutput = '';
      // stepInputs indexes corresponding to checkpoints in test flow where we want to assert on CLI output
      const checkpoints = new Set([0, 2]);
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

          const isStep = chunk.endsWith('└\n');
          if (isStep) {
            for (const input of stepInputs[step]) {
              this.push(input);
            }
            switch (step) {
              default:
                break; // no-op for non-checkpoint steps
              case Array.from(checkpoints)[0]:
                // Assert there's an indication of a pending proposal in main menu
                // eslint-disable-next-line no-control-regex
                assert.match(checkpointOutput, /Proposals\x1B\[33m \(1\)\x1B\[0m/);
                break;
              case Array.from(checkpoints)[1]:
                assert.ok(checkpointOutput.includes(`Broadcasted txid: ${Utils.colorText('5ba5df9de6c7f6043de8ade09c2dab08a1fb60724320f8cb4f00c9df2ec73035', 'green')}`));
                break;
            }
            step++;
          }
          if (chunk.includes('👋')) {
            child.stdin.end(); // send EOF to child so it can exit cleanly
          }
          respond();
        }
      });
      const child = spawn('node', [CLI_EXEC, WALLETS.BTC.SINGLE_SIG, ...cmdOpts]);
      child.stderr.pipe(process.stderr);
      child.stdout.pipe(io).pipe(child.stdin);
      io.on('error', (e) => {
        done(e);
      });
      child.on('error', (e) => {
        done(e);
      });
      child.on('close', (code) => {
        assert.equal(code, 0);
        done();
      });
    });

    it('should reject 1 pending proposal', function(done) {
      const stepInputs = [
        // Checkpoint1: Proposals option should show 1 pending proposal
        [KEYSTROKES.ENTER], // Proposals -- (checkpoint1)
        ['j'], // Reject
        // Checkpoint2: Should prompt for rejection reason
        ['This proposal sux', KEYSTROKES.ENTER], // Enter rejection reason -- (checkpoint2)
        // Checkpoint3: Should show rejected proposal
        ['x'], // Close -- (checkpoint3)
        // Checkpoint4: Main menu should show no pending proposals
        [KEYSTROKES.ENTER], // Proposals -- (checkpoint4)
        // Checkpoint5: Should show no more proposals
        ['x'], // Close -- (checkpoint5)
        [KEYSTROKES.ARROW_UP], // Proposals -> Exit
        [KEYSTROKES.ENTER], // Exit
      ];
      let step = 0;
      let checkpointOutput = '';
      // stepInputs indexes corresponding to checkpoints in test flow where we want to assert on CLI output
      const checkpoints = new Set([0, 2, 3, 4, 5]);
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

          const isStep = chunk.endsWith('└\n');
          if (isStep) {
            for (const input of stepInputs[step]) {
              this.push(input);
            }
            switch (step) {
              default:
                break; // no-op for non-checkpoint steps
              case Array.from(checkpoints)[0]:
                // Assert there's an indication of a pending proposal in main menu
                // eslint-disable-next-line no-control-regex
                assert.match(checkpointOutput, /Proposals\x1B\[33m \(1\)\x1B\[0m/);
                break;
              case Array.from(checkpoints)[1]:
                assert.match(checkpointOutput, /Enter rejection reason:/);
                break;
              case Array.from(checkpoints)[2]:
                const lines = checkpointOutput.split('\n');
                const startIdx = lines.findIndex(l => l.includes('◆  Page Controls:'));
                assert.ok(startIdx > -1);
                assert.ok(lines[startIdx + 1].includes('r  Print Raw Object'));
                assert.ok(lines[startIdx + 2].includes('e  Export'));
                assert.ok(lines[startIdx + 3].includes('x  Close'));
                assert.ok(lines.findIndex(l => l.includes('n  Next Page')) === -1);
                assert.ok(lines.findIndex(l => l.includes('p  Previous Page')) === -1);
                assert.ok(lines.findIndex(l => l.includes('a  Accept')) === -1);
                assert.ok(lines.findIndex(l => l.includes('j  Reject')) === -1);
                assert.ok(lines.findIndex(l => l.includes('d  Delete')) === -1);
                break;
              case Array.from(checkpoints)[3]:
                // No pending proposals indicator
                assert.match(checkpointOutput, /Proposals \(Get pending transaction proposals\)/);
                break;
              case Array.from(checkpoints)[4]:
                assert.match(checkpointOutput, /No more proposals/);
                break;
            }
            step++;
          }
          if (chunk.includes('👋')) {
            child.stdin.end(); // send EOF to child so it can exit cleanly
          }
          respond();
        }
      });
      const child = spawn('node', [CLI_EXEC, WALLETS.BTC.SINGLE_SIG, ...cmdOpts]);
      child.stderr.pipe(process.stderr);
      child.stdout.pipe(io).pipe(child.stdin);
      io.on('error', (e) => {
        done(e);
      });
      child.on('error', (e) => {
        done(e);
      });
      child.on('close', (code) => {
        assert.equal(code, 0);
        done();
      });
    });

    it('should delete 1 pending proposal', function(done) {
      const stepInputs = [
        // Checkpoint1: Proposals option should show 1 pending proposal
        [KEYSTROKES.ENTER], // Proposals -- (checkpoint1)
        ['d'], // Delete
        [KEYSTROKES.ENTER], // Delete
        // Checkpoint2: Should ask for confirmation
        [KEYSTROKES.ENTER], // Default: No -- (checkpoint2)
        ['d'], // Delete
        // Checkpoint3: Should ask for confirmation again
        [KEYSTROKES.ARROW_LEFT, KEYSTROKES.ENTER], // No -> Yes -- (checkpoint3)
        // Checkpoint4: Should show no more proposals
        ['x'], // Close -- (checkpoint4)
        [KEYSTROKES.ARROW_UP], // Proposals -> Exit
        [KEYSTROKES.ENTER], // Exit
      ];
      let step = 0;
      let checkpointOutput = '';
      // stepInputs indexes corresponding to checkpoints in test flow where we want to assert on CLI output
      const checkpoints = new Set([0, 3, 5, 6]);
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

          const isStep = chunk.endsWith('└\n');
          if (isStep) {
            for (const input of stepInputs[step]) {
              this.push(input);
            }
            switch (step) {
              default:
                break; // no-op for non-checkpoint steps
              case Array.from(checkpoints)[0]:
                // Assert there's an indication of a pending proposal in main menu
                // eslint-disable-next-line no-control-regex
                assert.match(checkpointOutput, /Proposals\x1B\[33m \(1\)\x1B\[0m/);
                break;
              case Array.from(checkpoints)[1]:
              case Array.from(checkpoints)[2]:
                assert.match(checkpointOutput, /Are you sure you want to delete proposal/);
                break;
              case Array.from(checkpoints)[3]:
                assert.match(checkpointOutput, /Proposal e43b0fe2-c2d2-43c2-afaa-7fb28f212230 deleted/);
                break;
            }
            step++;
          }
          if (chunk.includes('👋')) {
            child.stdin.end(); // send EOF to child so it can exit cleanly
          }
          respond();
        }
      });
      const child = spawn('node', [CLI_EXEC, WALLETS.BTC.SINGLE_SIG, ...cmdOpts]);
      child.stderr.pipe(process.stderr);
      child.stdout.pipe(io).pipe(child.stdin);
      io.on('error', (e) => {
        done(e);
      });
      child.on('error', (e) => {
        done(e);
      });
      child.on('close', (code) => {
        assert.equal(code, 0);
        done();
      });
    });

    it('should navigate multiple pending proposals', function(done) {
      const txp2 = { ...proposalData.btcSingleSigProposal, id: '2d7cb6e5-68b2-4791-bf9a-045bf0d34e06', _id: undefined };
      txp2['toObject'] = () => txp2;
      helpers.loadWalletProposalData(txp2)
        .then(() => {
          const stepInputs = [
            // Checkpoint1: Proposals option should show 2 pending proposals
            [KEYSTROKES.ENTER], // Proposals (2) -- (checkpoint1)
            // Checkpoint2: Should show first proposal
            ['n'], // Next Page
            // Checkpoint3: Should show second proposal
            ['p'], // Previous Page -- (checkpoint3)
            // Checkpoint4: Should show first proposal again
            ['d'], // Delete (first proposal) -- (checkpoint4)
            // Checkpoint5: Should ask for confirmation
            [KEYSTROKES.ARROW_LEFT, KEYSTROKES.ENTER], // No -> Yes -- (checkpoint5)
            ['n'], // Next Page
            ['a'], // Accept (second proposal)
            // Checkpoint6: Should show txid
            ['p'], // Previous Page -- (checkpoint6)
            // Checkpoint7: Should show deleted proposal
            ['x'], // Close -- (checkpoint7)
            [KEYSTROKES.ARROW_UP], // Proposals -> Exit
            [KEYSTROKES.ENTER], // Exit
          ];
          let step = 0;
          let checkpointOutput = '';
          // stepInputs indexes corresponding to checkpoints in test flow where we want to assert on CLI output
          const checkpoints = new Set([0, 1, 2, 3, 4, 7, 8]);
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

              const isStep = chunk.endsWith('└\n');
              if (isStep) {
                for (const input of stepInputs[step]) {
                  this.push(input);
                }
                const lines = checkpointOutput.split('\n');
                switch (step) {
                  default:
                    break; // no-op for non-checkpoint steps
                  case Array.from(checkpoints)[0]:
                    // Assert there's an indication of a pending proposal in main menu
                    // eslint-disable-next-line no-control-regex
                    assert.match(checkpointOutput, /Proposals\x1B\[33m \(2\)\x1B\[0m/);
                    checkpointOutput = ''; // reset output to avoid false positives in next checkpoints
                    break;
                  case Array.from(checkpoints)[1]:
                  case Array.from(checkpoints)[3]:
                  case Array.from(checkpoints)[6]:
                    assert.match(checkpointOutput, /ID: e43b0fe2-c2d2-43c2-afaa-7fb28f212230 /);
                    assert.doesNotMatch(checkpointOutput, /ID: 2d7cb6e5-68b2-4791-bf9a-045bf0d34e06 /);
                    const startIdx = lines.findIndex(l => l.includes('◆  Page Controls:'));
                    assert.ok(startIdx > -1);
                    assert.ok(lines[startIdx + 1].includes('n  Next Page'));
                    assert.doesNotMatch(checkpointOutput, /p {2}Previous Page/);
                    if (step < Array.from(checkpoints)[6]) {
                      assert.ok(checkpointOutput.includes('Status: pending'));
                    } else {
                      assert.ok(checkpointOutput.includes('Status: deleted'));
                    }
                    checkpointOutput = ''; // reset output to avoid false positives in next checkpoints
                    break;
                  case Array.from(checkpoints)[2]:
                    assert.doesNotMatch(checkpointOutput, /ID: e43b0fe2-c2d2-43c2-afaa-7fb28f212230 /);
                    assert.match(checkpointOutput, /ID: 2d7cb6e5-68b2-4791-bf9a-045bf0d34e06 /);
                    assert.ok(checkpointOutput.includes('p  Previous Page'));
                    assert.doesNotMatch(checkpointOutput, /p {2}Next Page/);
                    checkpointOutput = ''; // reset output to avoid false positives in next checkpoints
                    break;
                  case Array.from(checkpoints)[4]:
                    assert.match(checkpointOutput, /Are you sure you want to delete proposal/);
                    checkpointOutput = ''; // reset output to avoid false positives in next checkpoints
                    break;
                  case Array.from(checkpoints)[5]:
                    assert.ok(checkpointOutput.includes(`Broadcasted txid: ${Utils.colorText('5ba5df9de6c7f6043de8ade09c2dab08a1fb60724320f8cb4f00c9df2ec73035', 'green')}`));
                    checkpointOutput = ''; // reset output to avoid false positives in next checkpoints
                    break;
                }
                step++;
              }
              if (chunk.includes('👋')) {
                child.stdin.end(); // send EOF to child so it can exit cleanly
              }
              respond();
            }
          });
          const child = spawn('node', [CLI_EXEC, WALLETS.BTC.SINGLE_SIG, ...cmdOpts]);
          child.stderr.pipe(process.stderr);
          child.stdout.pipe(io).pipe(child.stdin);
          io.on('error', (e) => {
            done(e);
          });
          child.on('error', (e) => {
            done(e);
          });
          child.on('close', (code) => {
            assert.equal(code, 0);
            done();
          });
        })
        .catch(done);
    });
  });
});