import { strict as assert } from 'assert';
import { Deriver } from '@bitpay-labs/crypto-wallet-core';
import { Key } from '../src/lib/key';
import { TssKey } from '../src/lib/tsskey';

describe('TssKey encryption', function() {
  this.timeout(20000);

  it('should not export a plaintext EDDSA root after password encryption', function() {
    // Generate a fresh base Key containing both algorithms.
    const baseKey = new Key({ seedType: 'new' });
    const original = baseKey.toObj();
    assert.equal(typeof original.xPrivKeyEDDSA, 'string');

    // Synthetic shares isolate encryption/export; no real DKG is performed.
    const fullShare = Buffer.from('audit-only full share');
    const reducedShare = Buffer.from('audit-only reduced share');
    const tssKey = new TssKey({
      ...original,
      keychain: {
        // encrypt zeroes its inputs; retain copies for round-trip checks.
        privateKeyShare: Buffer.from(fullShare),
        reducedPrivateKeyShare: Buffer.from(reducedShare),
        commonKeyChain:
          '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798' +
          '00'.repeat(32),
      },
      metadata: { id: 'audit-only', m: 2, n: 3, partyId: 0 },
    });

    const password = 'audit-only-password';
    tssKey.encrypt(password); // Use default password-encryption parameters.
    const backup = JSON.parse(JSON.stringify(tssKey.toObj()));

    // Verify that the ECDSA root, mnemonic, and both shares are encrypted.
    assert.ok(backup.xPrivKey == null);
    assert.ok(backup.mnemonic == null);
    assert.ok(backup.keychain.privateKeyShare == null);
    assert.ok(backup.keychain.reducedPrivateKeyShare == null);
    assert.ok(backup.xPrivKeyEncrypted);
    assert.ok(backup.mnemonicEncrypted);
    assert.ok(backup.keychain.privateKeyShareEncrypted);
    assert.ok(backup.keychain.reducedPrivateKeyShareEncrypted);

    const restored = tssKey.get(password);
    assert.ok(restored.xPrivKey === original.xPrivKey, 'ECDSA root round-trip failed');
    assert.ok(restored.mnemonic === original.mnemonic, 'Mnemonic round-trip failed');
    assert.deepEqual(restored.keychain.privateKeyShare, fullShare);
    assert.deepEqual(restored.keychain.reducedPrivateKeyShare, reducedShare);

    // Derive a SOL child using only the exported EDDSA field and a public path.
    // The original key is used only as an assertion reference.
    const solPath = "m/44'/501'/0'/0'";
    let sameSolPrivateKeyWithoutPassword = false;
    if (typeof backup.xPrivKeyEDDSA === 'string') {
      const expected = Deriver.derivePrivateKeyWithPath(
        'SOL', 'livenet', original.xPrivKeyEDDSA, solPath, null
      );
      const fromBackup = Deriver.derivePrivateKeyWithPath(
        'SOL', 'livenet', backup.xPrivKeyEDDSA, solPath, null
      );
      sameSolPrivateKeyWithoutPassword =
        fromBackup.privKey === expected.privKey &&
        fromBackup.pubKey === expected.pubKey;
      assert.ok(sameSolPrivateKeyWithoutPassword,
        'Exported EDDSA material did not reproduce the original SOL child key');
    }

    // Log booleans only; do not print secret material.
    console.log({
      ecdsaAndSharesRoundTrip: true,
      eddsaRootStillPlaintext:
        typeof backup.xPrivKeyEDDSA === 'string' &&
        backup.xPrivKeyEDDSA === original.xPrivKeyEDDSA,
      sameSolPrivateKeyWithoutPassword,
    });

    // Security regression: this assertion fails on the vulnerable implementation.
    assert.ok(backup.xPrivKeyEDDSA == null,
      'encrypted TssKey export still contains plaintext xPrivKeyEDDSA');
  });
});
