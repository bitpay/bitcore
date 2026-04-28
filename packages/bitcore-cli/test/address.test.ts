import { spawn } from 'child_process';
import assert from 'assert';
import { Transform } from 'stream';
import * as helpers from './helpers';
import * as walletData from './data/walletsData';
import * as addressesData from './data/addressesData';

describe('Address', function() {
  this.timeout(Math.max(this['_timeout'] || 0, 5000));
  const { KEYSTROKES, WALLETS, OUTPUT_END_SEQ } = helpers.CONSTANTS;
  const { CLI_EXEC, CLI_OPTS, COMMON_OPTS, DIR } = WALLETS;
  const cmdOpts = [...COMMON_OPTS, '--dir', DIR];

  before(async function() {
    await helpers.startBws();
    await helpers.loadWalletData(walletData.btcSingleSigWallet);
  });

  after(async function() {
    await helpers.stopBws();
  });

  it('should show no addresses for a new wallet', function(done) {
    const stepInputs = [
      [KEYSTROKES.ARROW_UP], // Proposals -> Exit
      [KEYSTROKES.ARROW_UP], // Exit -> Show Advanced
      [KEYSTROKES.ENTER], // Show Advanced Options ...-> Message
      [KEYSTROKES.ARROW_DOWN], // Message -> Addresses
      [KEYSTROKES.ENTER], // Addresses
      // Checkpoint1: Addresses view shows no addresses for a new wallet
      ['x'], // Page Controls: Close -- (checkpoint1)
      [KEYSTROKES.ARROW_DOWN], // Main Menu -> Exit
      [KEYSTROKES.ENTER], // Exit
    ];
    let step = 0;
    let checkpointOutput = '';
    // stepInputs indexes corresponding to checkpoints in test flow where we want to assert on CLI output
    const checkpoints = new Set([5]);
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
          for (const input of stepInputs[step]) {
            this.push(input);
          }
          if (step === Array.from(checkpoints)[0]) {
            // Assert addresses output contains expected info for no addresses
            assert.match(checkpointOutput, /Addresses \(Page 1\)/);
            assert.doesNotMatch(checkpointOutput, /bcrt1/);
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
      assert.equal(code, 0);
      done();
    });
  });


  it('should generate new addresses', function(done) {
    const stepInputs = [
      [KEYSTROKES.ARROW_DOWN], // Proposals -> Send
      [KEYSTROKES.ARROW_DOWN], // Send -> Recieve
      [KEYSTROKES.ENTER], // Recieve
      // Checkpoint1: Address view shows first generated address (m/0/0)
      [KEYSTROKES.ENTER], // Main Menu -- (checkpoint1)
      [KEYSTROKES.ARROW_DOWN], // Proposals -> Send
      [KEYSTROKES.ARROW_DOWN], // Send -> Recieve
      [KEYSTROKES.ENTER], // Recieve
      // Checkpoint2: Address view shows second generated address (m/0/1)
      [KEYSTROKES.ENTER], // Main Menu -- (checkpoint2)
      [KEYSTROKES.ARROW_UP], // Proposals -> Exit
      [KEYSTROKES.ARROW_UP], // Exit -> Show Advanced
      [KEYSTROKES.ENTER], // Show Advanced Options ...-> Message
      [KEYSTROKES.ARROW_DOWN], // Message -> Addresses
      [KEYSTROKES.ENTER], // Addresses
      // Checkpoint3: Addresses view shows both generated addresses (m/0/0 and m/0/1)
      ['x'], // Page Controls: Close -- (checkpoint3)
      [KEYSTROKES.ARROW_DOWN], // Main Menu -> Exit
      [KEYSTROKES.ENTER], // Exit
    ];
    let step = 0;
    let checkpointOutput = '';
    // stepInputs indexes corresponding to checkpoints in test flow where we want to assert on CLI output
    const checkpoints = new Set([3, 7, 13]);
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
          for (const input of stepInputs[step]) {
            this.push(input);
          }
          switch (step) {
            default:
              break; // no-op for non-checkpoint steps
            case Array.from(checkpoints)[0]:
              // Assert address output contains expected info for first generated address
              assert.match(checkpointOutput, /Address \(m\/0\/0\)/);
              assert.match(checkpointOutput, /tb1q/);
              break;
            case Array.from(checkpoints)[1]:
              // Assert address output contains expected info for second generated address
              assert.match(checkpointOutput, /Address \(m\/0\/1\)/);
              assert.match(checkpointOutput, /tb1q/);
              break;
            case Array.from(checkpoints)[2]:
              // Assert addresses output contains expected info for both generated addresses
              assert.match(checkpointOutput, /Addresses \(Page 1\)/);
              assert.match(checkpointOutput, /tb1q[a-z0-9]+ \(m\/0\/0\)/);
              assert.match(checkpointOutput, /tb1q[a-z0-9]+ \(m\/0\/1\)/);
              break;
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
      assert.equal(code, 0);
      done();
    });
  });

  describe('Pagination', function() {
    beforeEach(async function() {
      await helpers.loadWalletAddressData(walletData.btcSingleSigWallet, addressesData.addressesBtcSingleSig.filter(a => parseInt(a.path.split('/')[2]) > 1));
    });
    it('should paginate addresses', function(done) {
      const stepInputs = [
        [KEYSTROKES.ARROW_UP], // Proposals -> Exit
        [KEYSTROKES.ARROW_UP], // Exit -> Show Advanced
        [KEYSTROKES.ENTER], // Show Advanced Options ...-> Message
        [KEYSTROKES.ARROW_DOWN], // Message -> Addresses
        [KEYSTROKES.ENTER], // Addresses
        // Checkpoint1: Addresses view shows addresses (page 1)
        ['n'], // Page 1 -> Page 2 -- (checkpoint1)
        // Checkpoint2: Addresses view shows addresses (page 2)
        ['x'], // Page Controls: Close -- (checkpoint2)
        [KEYSTROKES.ARROW_DOWN], // Main Menu -> Exit
        [KEYSTROKES.ENTER], // Exit
      ];
      let step = 0;
      let checkpointOutput = '';
      // stepInputs indexes corresponding to checkpoints in test flow where we want to assert on CLI output
      const checkpoints = new Set([5, 6]);
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
            for (const input of stepInputs[step]) {
              this.push(input);
            }
            switch (step) {
              default:
                break; // no-op for non-checkpoint steps
              case Array.from(checkpoints)[0]:
                // Assert addresses output contains expected info for both generated addresses
                assert.match(checkpointOutput, /Addresses \(Page 1\)/);
                assert.match(checkpointOutput, /tb1q6l953jevexkqrvvah8729nud289djcpamvtm3u \(m\/0\/0\)/);
                assert.match(checkpointOutput, /tb1qdq929kz9r7adapvruevgz0nkkqd3cpfv278ryd \(m\/0\/1\)/);
                assert.match(checkpointOutput, /tb1qqr57cev8t25sph9qksdvslf80v9vy2nraghs5t \(m\/0\/2\)/);
                assert.match(checkpointOutput, /tb1quug3ztz5hgqe053hs2jzds70n0uynppugksfkc \(m\/0\/3\)/);
                assert.match(checkpointOutput, /tb1q0xp8938csu3rg9zxru7xfxer25ynzjztng66dw \(m\/0\/4\)/);
                assert.match(checkpointOutput, /tb1qpn6lwuj30vdhjrl86pkxashmgf923c0jp98p33 \(m\/0\/5\)/);
                assert.match(checkpointOutput, /tb1qqz5lc5wttuk2u5ntf0ptjjrpexs8n4upypk6es \(m\/0\/6\)/);
                assert.match(checkpointOutput, /tb1qdgv30yrsmlu790j40nm3mk895296va4xsdes5r \(m\/0\/7\)/);
                assert.match(checkpointOutput, /tb1q3s69dnlf2jnm50eaxxp2xyy8h5t7tah8xggeze \(m\/0\/8\)/);
                assert.match(checkpointOutput, /tb1qk93dstvzpyk5vpj9zt4gxzvsayuqvhkvcfhacs \(m\/0\/9\)/);
                assert.doesNotMatch(checkpointOutput, /tb1qng4qgjrdqxx8n87pk5mnzvm2u6k3xjvg3zkh40 \(m\/0\/10\)/);
                break;
              case Array.from(checkpoints)[1]:
                // Assert addresses output contains expected info for both generated addresses
                assert.match(checkpointOutput, /Addresses \(Page 2\)/);
                assert.match(checkpointOutput, /tb1qng4qgjrdqxx8n87pk5mnzvm2u6k3xjvg3zkh40 \(m\/0\/10\)/);
                assert.match(checkpointOutput, /tb1q7kle0glqvheed9rykchzfs7nksfznnqy2z2zvd \(m\/0\/11\)/);
                assert.doesNotMatch(checkpointOutput, /bcrt1q[a-z0-9]+ \(m\/0\/12\)/);
                break;
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
        assert.equal(code, 0);
        done();
      });
    });
  });
});