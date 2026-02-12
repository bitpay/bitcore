import { spawn } from 'child_process';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { Transform } from 'stream';
import * as helpers from './helpers';

describe('Create', function() {
  const KEYSTROKES = {
    ENTER: '\r',        // Enter/Return
    ARROW_UP: '\x1b[A',    // Arrow Up
    ARROW_DOWN: '\x1b[B',    // Arrow Down
    ARROW_RIGHT: '\x1b[C',    // Arrow Right
    ARROW_LEFT: '\x1b[D',    // Arrow Left
    DELETE: '\x1b[3~',   // Delete
    BACKSPACE: '\x7f',      // Backspace
    CTRL_C: '\x03',      // Ctrl+C
  };
  const cliDotJs = 'build/src/cli.js';
  const tempWalletDir = path.join(__dirname, './wallets/temp');
  const commonOpts = ['--verbose', '--host', 'http://localhost:3232', '--dir', tempWalletDir];

  function cleanupWallets() {
    if (fs.existsSync(tempWalletDir)) {
      fs.rmdirSync(tempWalletDir, { recursive: true });
    }
  }

  before(async function() {
    cleanupWallets();
    await helpers.startBws();
  });

  after(async function() {
    await helpers.stopBws();
    cleanupWallets();

  });

  describe('Single Sig', function() {
    it('should create a BTC wallet', function(done) {
      const stepInputs = [
        [KEYSTROKES.ENTER], // Create Wallet
        [KEYSTROKES.ENTER], // Chain: btc
        ['regtest', KEYSTROKES.ENTER], // Network: regtest
        [KEYSTROKES.ENTER], // Multi-party? No
        [KEYSTROKES.ENTER], // Address Type: default
        ['testpassword', KEYSTROKES.ENTER], // Password

      ];
      let step = 0;
      const io = new Transform({
        encoding: 'utf-8',
        transform(chunk, encoding, respond) {
          chunk = chunk.toString();
          // Uncomment to see CLI output during test
          // process.stdout.write(chunk);

          const isStep = chunk.endsWith('└\n');// chunk.includes('What would you like to do?') || chunk.includes('Network:');
          if (isStep) {
            for (const input of stepInputs[step]) {
              this.push(input);
            }
            step++;
          } else if (chunk.includes('Error:')) {
            return respond(chunk);
          }
          respond();
        }
      });
      const child = spawn('node', [cliDotJs, 'btc-temp', ...commonOpts]);
      child.stderr.pipe(process.stderr);
      child.stdout.pipe(io).pipe(child.stdin);
      let err;
      io.on('error', (e) => {
        err = e;
      });
      io.on('close', () => {
        done(err);
      });
    });
  });
});