/**
 * benchmark.js
 * Baseline performance measurement for ECDSA and Schnorr signing + verification
 * using the current `elliptic` + `bn.js` backend.
 *
 * No external dependencies — uses only Node.js built-in perf_hooks.
 *
 * Run this NOW to capture current speeds, then re-run after refactoring
 * to quantify performance regressions or improvements.
 */

const { performance } = require('perf_hooks');
const bitcore = require('../index');

const PrivateKey = bitcore.PrivateKey;
const ECDSA = bitcore.crypto.ECDSA;
const Schnorr = bitcore.crypto.Schnorr;
const Random = bitcore.crypto.Random;
const BN = bitcore.crypto.BN;
const Point = bitcore.crypto.Point;

// Warm-up iterations (lets V8 JIT compile hot paths)
const WARM_UP = 50;
// Main benchmark iterations per operation
const BENCH_ITERS = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run fn `warmUp` times to warm the JIT, then measure `n` iterations. */
function bench(fn, warmUp, n) {
  // warm-up
  for (let i = 0; i < warmUp; i++) fn();

  const times = [];
  for (let i = 0; i < n; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  const sorted = times.slice().sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mean = times.reduce((s, t) => s + t, 0) / times.length;
  const median = sorted[Math.floor(n / 2)];
  // simple std-dev
  const variance = times.reduce((s, t) => s + (t - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  return { opsPerSec: (n / (times.reduce((s, t) => s + t, 0))) * 1000, mean, median, min, max, stdDev };
}

// ---------------------------------------------------------------------------
// Pre-generate test fixtures (so timing only covers crypto, not fixture setup)
// ---------------------------------------------------------------------------

console.log('[Setup] Generating test fixtures...');

const fixtureKeys = [];
const fixtureMsgs = [];
const fixtureAUXs = [];

for (let i = 0; i < 10; i++) {
  const pk = new PrivateKey();
  const msg = Random.getRandomBuffer(32);
  const aux = Random.getRandomBuffer(32);
  fixtureKeys.push({ privateKey: pk, msgHash: msg, aux });
}

console.log(`[Setup] ${fixtureKeys.length} fixtures ready.\n`);

// ---------------------------------------------------------------------------
// Benchmark ECDSA
// ---------------------------------------------------------------------------

console.log('═══════════════════════════════════════════════════════');
console.log('  ECDSA Benchmarks  (elliptic + bn.js backend)');
console.log('═══════════════════════════════════════════════════════\n');

// --- ECDSA Sign ---
console.log(`  Signing (random key, random 32-byte hash) — ${BENCH_ITERS} iterations`);
const signResults = bench(() => {
  for (let i = 0; i < fixtureKeys.length; i++) {
    const { privateKey, msgHash } = fixtureKeys[i];
    ECDSA.sign(msgHash, privateKey, { randomK: false });
  }
}, WARM_UP, BENCH_ITERS);

// Normalize per-key
const signPerKey = { ...signResults };
signPerKey.opsPerSec /= fixtureKeys.length;
signPerKey.mean /= fixtureKeys.length;
signPerKey.median /= fixtureKeys.length;
signPerKey.min /= fixtureKeys.length;
signPerKey.max /= fixtureKeys.length;
signPerKey.stdDev /= fixtureKeys.length;
console.log(`    ops/sec: ${signPerKey.opsPerSec.toFixed(1)}`);
console.log(`    mean:    ${signPerKey.mean.toFixed(3)} ms`);
console.log(`    median:  ${signPerKey.median.toFixed(3)} ms`);
console.log(`    min/max: ${signPerKey.min.toFixed(3)} / ${signPerKey.max.toFixed(3)} ms`);
console.log(`    stdDev:  ${signPerKey.stdDev.toFixed(3)} ms`);

// --- ECDSA Verify ---
console.log(`  Verifying (sign + verify each) — ${BENCH_ITERS} iterations`);
const verifyResults = bench(() => {
  for (let i = 0; i < fixtureKeys.length; i++) {
    const { privateKey, msgHash } = fixtureKeys[i];
    const sig = ECDSA.sign(msgHash, privateKey, { randomK: false });
    const pub = privateKey.toPublicKey();
    ECDSA.verify(msgHash, sig, pub);
  }
}, WARM_UP, BENCH_ITERS);

const verifyPerKey = { ...verifyResults };
verifyPerKey.opsPerSec /= fixtureKeys.length;
verifyPerKey.mean /= fixtureKeys.length;
verifyPerKey.median /= fixtureKeys.length;
verifyPerKey.min /= fixtureKeys.length;
verifyPerKey.max /= fixtureKeys.length;
verifyPerKey.stdDev /= fixtureKeys.length;
console.log(`    ops/sec: ${verifyPerKey.opsPerSec.toFixed(1)}`);
console.log(`    mean:    ${verifyPerKey.mean.toFixed(3)} ms`);
console.log(`    median:  ${verifyPerKey.median.toFixed(3)} ms`);
console.log(`    min/max: ${verifyPerKey.min.toFixed(3)} / ${verifyPerKey.max.toFixed(3)} ms`);
console.log(`    stdDev:  ${verifyPerKey.stdDev.toFixed(3)} ms`);

// --- ECDSA Sign (deterministic k, low-S) ---
console.log(`  Signing with low-S enforcement — ${BENCH_ITERS} iterations`);
const signLowSResults = bench(() => {
  for (let i = 0; i < fixtureKeys.length; i++) {
    const { privateKey, msgHash } = fixtureKeys[i];
    const sig = ECDSA.sign(msgHash, privateKey, { randomK: false });
    // low-S is already enforced inside ECDSA.sign, but verify it
    const N = Point.getN();
    const halfN = new BN('7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0', 'hex');
    if (sig.s.cmp(halfN) > 0) {
      // This shouldn't happen, but if it does, normalize
    }
  }
}, WARM_UP, BENCH_ITERS);

const signLowSPerKey = { ...signLowSResults };
signLowSPerKey.opsPerSec /= fixtureKeys.length;
signLowSPerKey.mean /= fixtureKeys.length;
signLowSPerKey.median /= fixtureKeys.length;
signLowSPerKey.min /= fixtureKeys.length;
signLowSPerKey.max /= fixtureKeys.length;
signLowSPerKey.stdDev /= fixtureKeys.length;
console.log(`    ops/sec: ${signLowSPerKey.opsPerSec.toFixed(1)}`);
console.log(`    mean:    ${signLowSPerKey.mean.toFixed(3)} ms`);
console.log(`    median:  ${signLowSPerKey.median.toFixed(3)} ms`);
console.log(`    min/max: ${signLowSPerKey.min.toFixed(3)} / ${signLowSPerKey.max.toFixed(3)} ms`);
console.log(`    stdDev:  ${signLowSPerKey.stdDev.toFixed(3)} ms`);

// --- ECDSA Recovery ---
console.log(`  Key recovery (sign + calci) — ${BENCH_ITERS} iterations`);
const recoveryResults = bench(() => {
  for (let i = 0; i < fixtureKeys.length; i++) {
    const { privateKey, msgHash } = fixtureKeys[i];
    const sig = ECDSA.sign(msgHash, privateKey, { randomK: false });
    try {
      ECDSA.calci(msgHash, sig, privateKey.toPublicKey());
    } catch (_) {}
  }
}, WARM_UP, BENCH_ITERS);

const recoveryPerKey = { ...recoveryResults };
recoveryPerKey.opsPerSec /= fixtureKeys.length;
recoveryPerKey.mean /= fixtureKeys.length;
recoveryPerKey.median /= fixtureKeys.length;
recoveryPerKey.min /= fixtureKeys.length;
recoveryPerKey.max /= fixtureKeys.length;
recoveryPerKey.stdDev /= fixtureKeys.length;
console.log(`    ops/sec: ${recoveryPerKey.opsPerSec.toFixed(1)}`);
console.log(`    mean:    ${recoveryPerKey.mean.toFixed(3)} ms`);
console.log(`    median:  ${recoveryPerKey.median.toFixed(3)} ms`);
console.log(`    min/max: ${recoveryPerKey.min.toFixed(3)} / ${recoveryPerKey.max.toFixed(3)} ms`);
console.log(`    stdDev:  ${recoveryPerKey.stdDev.toFixed(3)} ms`);

// ---------------------------------------------------------------------------
// Benchmark Schnorr
// ---------------------------------------------------------------------------

console.log('\n═══════════════════════════════════════════════════════');
console.log('  Schnorr Benchmarks  (elliptic + bn.js backend)');
console.log('═══════════════════════════════════════════════════════\n');

// --- Schnorr Sign ---
console.log(`  Signing (random key, random 32-byte msg, random aux) — ${BENCH_ITERS} iterations`);
const schnorrSignResults = bench(() => {
  for (let i = 0; i < fixtureKeys.length; i++) {
    const { privateKey, msgHash, aux } = fixtureKeys[i];
    Schnorr.sign(privateKey.toBuffer(), msgHash, aux);
  }
}, WARM_UP, BENCH_ITERS);

const schnorrSignPerKey = { ...schnorrSignResults };
schnorrSignPerKey.opsPerSec /= fixtureKeys.length;
schnorrSignPerKey.mean /= fixtureKeys.length;
schnorrSignPerKey.median /= fixtureKeys.length;
schnorrSignPerKey.min /= fixtureKeys.length;
schnorrSignPerKey.max /= fixtureKeys.length;
schnorrSignPerKey.stdDev /= fixtureKeys.length;
console.log(`    ops/sec: ${schnorrSignPerKey.opsPerSec.toFixed(1)}`);
console.log(`    mean:    ${schnorrSignPerKey.mean.toFixed(3)} ms`);
console.log(`    median:  ${schnorrSignPerKey.median.toFixed(3)} ms`);
console.log(`    min/max: ${schnorrSignPerKey.min.toFixed(3)} / ${schnorrSignPerKey.max.toFixed(3)} ms`);
console.log(`    stdDev:  ${schnorrSignPerKey.stdDev.toFixed(3)} ms`);

// --- Schnorr Verify ---
console.log(`  Verify (sign + verify each) — ${BENCH_ITERS} iterations`);
const schnorrVerifyResults = bench(() => {
  for (let i = 0; i < fixtureKeys.length; i++) {
    const { privateKey, msgHash, aux } = fixtureKeys[i];
    const sig = Schnorr.sign(privateKey.toBuffer(), msgHash, aux);
    const pubKey = privateKey.toPublicKey();
    const pubX = pubKey.point.getX().toBuffer({ size: 32 });
    Schnorr.verify(pubX, msgHash, sig);
  }
}, WARM_UP, BENCH_ITERS);

const schnorrVerifyPerKey = { ...schnorrVerifyResults };
schnorrVerifyPerKey.opsPerSec /= fixtureKeys.length;
schnorrVerifyPerKey.mean /= fixtureKeys.length;
schnorrVerifyPerKey.median /= fixtureKeys.length;
schnorrVerifyPerKey.min /= fixtureKeys.length;
schnorrVerifyPerKey.max /= fixtureKeys.length;
schnorrVerifyPerKey.stdDev /= fixtureKeys.length;
console.log(`    ops/sec: ${schnorrVerifyPerKey.opsPerSec.toFixed(1)}`);
console.log(`    mean:    ${schnorrVerifyPerKey.mean.toFixed(3)} ms`);
console.log(`    median:  ${schnorrVerifyPerKey.median.toFixed(3)} ms`);
console.log(`    min/max: ${schnorrVerifyPerKey.min.toFixed(3)} / ${schnorrVerifyPerKey.max.toFixed(3)} ms`);
console.log(`    stdDev:  ${schnorrVerifyPerKey.stdDev.toFixed(3)} ms`);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n═══════════════════════════════════════════════════════');
console.log('  Summary');
console.log('═══════════════════════════════════════════════════════\n');

console.log(`  Backend: elliptic ^6.5.3 + bn.js ^4.11.8`);
console.log(`  Node.js: ${process.version}`);
console.log(`  Platform: ${process.platform} ${process.arch}`);
console.log(`  Benchmarks: ${BENCH_ITERS} iterations per test`);
console.log(`  Warm-up:   ${WARM_UP} iterations`);
console.log(`  Fixtures:  ${fixtureKeys.length} pre-generated key/msg/aux sets`);
console.log(`  Output:    ${__dirname}/benchmark_results.json\n`);

const summary = {
  timestamp: new Date().toISOString(),
  backend: { elliptic: require('../node_modules/elliptic/package.json').version, bnjs: require('../node_modules/bn.js/package.json').version },
  node: process.version,
  platform: `${process.platform} ${process.arch}`,
  iters: BENCH_ITERS,
  warmup: WARM_UP,
  fixtures: fixtureKeys.length,
  ecdsa: {
    sign: signPerKey,
    verify: verifyPerKey,
    signLowS: signLowSPerKey,
    recovery: recoveryPerKey,
  },
  schnorr: {
    sign: schnorrSignPerKey,
    verify: schnorrVerifyPerKey,
  },
};

require('fs').writeFileSync(
  require('path').join(__dirname, 'benchmark_results.json'),
  JSON.stringify(summary, null, 2),
  'utf8'
);

console.log('Results written to:', require('path').join(__dirname, 'benchmark_results.json'));
console.log('\n[Done] Re-run this script after refactoring to compare results.');
