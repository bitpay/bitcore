import * as chai from 'chai';
import { BitcoreLibCash } from '@bitpay-labs/crypto-wallet-core';
import { Utils } from '../src/lib/common';
import { Key } from '../src/lib/key';

chai.should();

describe('BCH escrow amount types', function() {
  it('should build the same escrow tx from string and number amounts', function() {
    const key = new Key({
      seedType: 'mnemonic',
      seedData: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    });
    const credentials = key.createCredentials(null, { coin: 'bch', chain: 'bch', network: 'livenet', account: 0, n: 1 });
    credentials.addWalletInfo('escrow-wallet', 'escrow wallet', 1, 1, 'copayer');
    const address = Utils.deriveAddress('P2PKH', credentials.publicKeyRing, 'm/0/0', 1, 'livenet', 'bch');
    const txp: any = {
      version: 3,
      coin: 'bch',
      chain: 'bch',
      network: 'livenet',
      addressType: 'P2PKH',
      requiredSignatures: 1,
      inputs: [{
        txid: 'ab'.repeat(32),
        vout: 0,
        satoshis: 3000000,
        scriptPubKey: BitcoreLibCash.Script.buildPublicKeyHashOut(address.address).toHex(),
        path: address.path
      }],
      outputs: [{ toAddress: address.address, amount: 1000000 }],
      changeAddress: Utils.deriveAddress('P2PKH', credentials.publicKeyRing, 'm/1/0', 1, 'livenet', 'bch'),
      outputOrder: [2, 0, 1],
      fee: 200,
      instantAcceptanceEscrow: 1000
    };
    txp.escrowAddress = {
      ...Utils.deriveAddress('P2SH', credentials.publicKeyRing, 'm/1/1', 1, 'livenet', 'bch', txp.inputs),
      type: 'P2SH'
    };

    const fromNumbers = Utils.buildTx(txp).uncheckedSerialize();
    txp.instantAcceptanceEscrow = '1000';
    txp.fee = '200';

    Utils.buildTx(txp).uncheckedSerialize().should.equal(fromNumbers);
  });
});
