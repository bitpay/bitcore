/**
 * generate_vectors.js
 * Run this script BEFORE beginning the rewrite to capture the exact mathematical
 * output behaviors of the 'elliptic' + 'bn.js' backend.
 */

const fs = require('fs');
const path = require('path');

// Ensure we are pulling the local un-refactored library components
const bitcore = require('../index');

const PrivateKey = bitcore.PrivateKey;
const PublicKey = bitcore.PublicKey;
const ECDSA = bitcore.crypto.ECDSA;
const Schnorr = bitcore.crypto.Schnorr;
const Signature = bitcore.crypto.Signature;
const Random = bitcore.crypto.Random;
const BN = bitcore.crypto.BN;
const Point = bitcore.crypto.Point;

const VECTOR_COUNT = 1000;

// Remove the old orphaned output if it exists from a prior run
const OLD_FILE = path.join(__dirname, 'test_vectors.json');
if (fs.existsSync(OLD_FILE)) {
  try { fs.unlinkSync(OLD_FILE); } catch {/** no op */}
}

// ============================================================
// PART 1: ECDSA vectors
// ============================================================
console.log(`[Phase 0.2a] Initializing capture of ${VECTOR_COUNT} ECDSA differential test vectors...`);

const ecdsaVectors = [];

for (let i = 0; i < VECTOR_COUNT; i++) {
  // 1. Generate a completely random 32-byte private key
  //    PrivateKey() with no args generates a random valid key (defaults: livenet, compressed)
  let privateKey;
  try {
    privateKey = new PrivateKey();
  } catch (e) {
    console.error(`Failed to generate PrivateKey #${i}: ${e.message}`);
    continue;
  }
  const privHex = privateKey.toString();

  // 2. Generate public keys — both compressed and uncompressed forms
  //    Compressed: via PrivateKey.toPublicKey() which internally uses PublicKey.fromPrivateKey(this)
  let pubKeyCompressed, pubKeyUncompressed;
  try {
    pubKeyCompressed = privateKey.toPublicKey();
    // For uncompressed, we must explicitly construct via fromPoint with compressed=false
    // because PublicKey.fromPrivateKey inherits the PrivateKey's compressed flag (true by default)
    pubKeyUncompressed = PublicKey.fromPoint(
      pubKeyCompressed.point,
      false
    );
  } catch (e) {
    console.error(`Failed to generate PublicKey #${i}: ${e.message}`);
    continue;
  }

  // Capture point coordinates directly from the underlying implementation
  const pointCompressedHex = pubKeyCompressed.toString();  // DER-encoded hex
  const pointUncompressedHex = pubKeyUncompressed.toString();  // DER-encoded hex (uncompressed form)
  const pointX = pubKeyCompressed.point.getX().toString(16);
  const pointY = pubKeyCompressed.point.getY().toString(16);

  // 3. Generate a random 32-byte cryptographic message hash payload
  const msgHashBuf = Random.getRandomBuffer(32);
  const msgHashHex = msgHashBuf.toString('hex');

  // 4. Sign using ECDSA.sign() — the correct static API
  //    ECDSA.sign(hashbuf, privkey, opts) returns a Signature instance
  //    opts.randomK: if false (default), uses deterministic RFC6979 k generation
  let sig;
  try {
    sig = ECDSA.sign(msgHashBuf, privateKey, { randomK: false });
  } catch (e) {
    console.error(`Failed to sign #${i}: ${e.message}`);
    continue;
  }

  // Validate the signature has proper r and s values before recording
  if (!sig.r || !sig.s) {
    console.error(`Signature #${i} has invalid r/s: r=${sig.r}, s=${sig.s}`);
    continue;
  }
  if (sig.r.cmp(BN.Zero) <= 0 || sig.s.cmp(BN.Zero) <= 0) {
    console.error(`Signature #${i} has r or s <= 0`);
    continue;
  }

  // BIP62 low-S check
  const N = Point.getN();
  if (sig.s.cmp(N) >= 0) {
    console.error(`Signature #${i} has s >= N`);
    continue;
  }

  // 5. Serialize the signature in both DER and compact forms
  const sigDERHex = sig.toDER().toString('hex');
  // sig.toCompact() requires a valid recovery param (0..3) or sig.i to be set.
  // Since ECDSA.sign() does NOT set sig.i, we pass an explicit value of 0
  // to get a valid compact encoding. The actual recovery id is computed later.
  const sigCompactBuf = sig.toCompact(0);
  const sigCompactHex = sigCompactBuf.toString('hex');

  // 6. Attempt to compute the recovery parameter (only valid after verification)
  //    ECDSA.calci attaches sig.i to the signature object. It will throw if
  //    no recovery id in [0..3] matches.
  let recoveryParam = undefined;
  try {
    ECDSA.calci(msgHashBuf, sig, privateKey.toPublicKey());
    recoveryParam = sig.i;
  } catch (e) {
    // Recovery param not computable — leave as undefined
    recoveryParam = undefined;
  }

  // 7. Verify the signature against the public key to confirm it's valid
  const pubKeyForVerify = privateKey.toPublicKey();
  const valid = ECDSA.verify(msgHashBuf, sig, pubKeyForVerify);
  if (!valid) {
    console.error(`Signature #${i} FAILED verification! Skipping.`);
    continue;
  }

  // 8. Package the data
  ecdsaVectors.push({
    id: i,
    input: {
      privateKeyHex: privHex,
      messageHashHex: msgHashHex
    },
    expected: {
      point: {
        x: pointX,
        y: pointY,
        compressedHex: pointCompressedHex,
        uncompressedHex: pointUncompressedHex
      },
      signature: {
        r: sig.r.toString(16),
        s: sig.s.toString(16),
        recoveryParam: recoveryParam,
        derHex: sigDERHex,
        compactHex: sigCompactHex
      },
      verified: true
    }
  });

  if ((i + 1) % 200 === 0) {
    console.log(`   Captured ${i + 1}/${VECTOR_COUNT} ECDSA states...`);
  }
}

// Flush ECDSA vectors
const ecdsaOutputFile = path.join(__dirname, 'ecdsa_test_vectors.json');
const dir = path.dirname(ecdsaOutputFile);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}
fs.writeFileSync(ecdsaOutputFile, JSON.stringify(ecdsaVectors, null, 2), 'utf8');
console.log(`\n[ECDSA Success] ${ecdsaOutputFile}`);
console.log(`ECDSA vectors recorded: ${ecdsaVectors.length} (from ${VECTOR_COUNT} attempts)`);

// ============================================================
// PART 2: Schnorr vectors
// ============================================================
console.log(`\n[Phase 0.2b] Initializing capture of ${VECTOR_COUNT} Schnorr differential test vectors...`);

const schnorrVectors = [];

for (let i = 0; i < VECTOR_COUNT; i++) {
  // 1. Generate a completely random 32-byte private key
  let privateKey;
  try {
    privateKey = new PrivateKey();
  } catch (e) {
    console.error(`Failed to generate PrivateKey #${i}: ${e.message}`);
    continue;
  }
  const privHex = privateKey.toString();

  // 2. Compute the public key as a 32-byte x-only coordinate (BIP-0340 format)
  //    Schnorr works with x-only pubkeys — the y-parity is implicit from the signing process
  let pubKey;
  try {
    pubKey = privateKey.toPublicKey();
  } catch (e) {
    console.error(`Failed to generate PublicKey #${i}: ${e.message}`);
    continue;
  }
  const pubKeyXOnly = pubKey.point.getX().toBuffer({ size: 32 });
  const pubKeyXOnlyHex = pubKeyXOnly.toString('hex');

  // 3. Generate a random 32-byte message hash
  const msgHashBuf = Random.getRandomBuffer(32);
  const msgHashHex = msgHashBuf.toString('hex');

  // 4. Generate a random 32-byte aux value (required by BIP-0340 signing)
  const auxBuf = Random.getRandomBuffer(32);
  const auxHex = auxBuf.toString('hex');

  // 5. Sign using Schnorr.sign(privkey, message, aux)
  //    Returns a raw 64-byte Buffer [R_x || s]
  let schnorrSigBuf;
  try {
    schnorrSigBuf = Schnorr.sign(privateKey.toBuffer(), msgHashBuf, auxBuf);
  } catch (e) {
    console.error(`Failed to Schnorr-sign #${i}: ${e.message}`);
    continue;
  }

  // Validate: Schnorr signatures are always exactly 64 bytes
  if (!schnorrSigBuf || schnorrSigBuf.length !== 64) {
    console.error(`Schnorr signature #${i} has invalid length: ${schnorrSigBuf ? schnorrSigBuf.length : 'null'}`);
    continue;
  }

  // Split into r (x-coordinate of R) and s
  const schnorrRHex = schnorrSigBuf.slice(0, 32).toString('hex');
  const schnorrSHex = schnorrSigBuf.slice(32, 64).toString('hex');

  // 6. Verify the signature against the x-only public key
  const verified = Schnorr.verify(pubKeyXOnly, msgHashBuf, schnorrSigBuf);
  if (!verified) {
    console.error(`Schnorr signature #${i} FAILED verification! Skipping.`);
    continue;
  }

  // 7. Package the data
  schnorrVectors.push({
    id: i,
    input: {
      privateKeyHex: privHex,
      messageHashHex: msgHashHex,
      auxHex: auxHex
    },
    expected: {
      point: {
        xOnlyHex: pubKeyXOnlyHex
      },
      signature: {
        rHex: schnorrRHex,
        sHex: schnorrSHex,
        derHex: schnorrSigBuf.toString('hex'),  // raw 64-byte hex, no DER encoding
        length: schnorrSigBuf.length
      },
      verified: true
    }
  });

  if ((i + 1) % 200 === 0) {
    console.log(`   Captured ${i + 1}/${VECTOR_COUNT} Schnorr states...`);
  }
}

// Flush Schnorr vectors
const schnorrOutputFile = path.join(__dirname, 'schnorr_test_vectors.json');
const schnorrDir = path.dirname(schnorrOutputFile);
if (!fs.existsSync(schnorrDir)) {
  fs.mkdirSync(schnorrDir, { recursive: true });
}
fs.writeFileSync(schnorrOutputFile, JSON.stringify(schnorrVectors, null, 2), 'utf8');
console.log(`\n[Schnorr Success] ${schnorrOutputFile}`);
console.log(`Schnorr vectors recorded: ${schnorrVectors.length} (from ${VECTOR_COUNT} attempts)`);

console.log('\n[Phase 0.2 Complete] Both ECDSA and Schnorr golden master vectors captured.');
console.log('Proceed with refactoring primitives. Use these JSON payloads to run validations during upcoming phases.');
