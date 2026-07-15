import BIP32Factory from 'bip32';
import { Psbt, payments } from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import Ledger from '../../src/ledger.js';

const ledger = new Ledger();
await ledger.connect();

const bip32 = BIP32Factory(ecc);
const psbt = new Psbt();

// Derive the specific child key for external chain (0), address index (0)
const childNode = bip32.fromBase58(await ledger.getPublicKey({ index: 0 })).derive(0).derive(0);
const pubkey = Buffer.from(childNode.publicKey);

// Compute the P2WPKH scriptPubKey from the derived child key
const p2wpkh = payments.p2wpkh({ pubkey: pubkey });
const script = p2wpkh.output!;

const masterFingerprint = await ledger.getMasterKeyFingerprint();
psbt.addInput({
  hash: '78519a191327dfdc0c2ea64a04d09d87c3909ce8365d0e0c0dbd0bc80d0405b4',
  index: 0,
  witnessUtxo: {
    script,
    value: 1000,
  },
  bip32Derivation: [{
    masterFingerprint: Buffer.from(masterFingerprint.buffer, masterFingerprint.byteOffset, masterFingerprint.byteLength),
    pubkey,
    path: "m/84'/0'/0'/0/0",
  }],
});

psbt.addOutputs([{ address: 'bc1qj86hpgprdudkks84y52vdenz86kd26stkssrcq', value: 900 }]);

console.log(await ledger.sign(psbt));
await ledger.disconnect();
process.exit(0);
