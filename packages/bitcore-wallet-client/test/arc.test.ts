import { expect } from 'chai';
import * as CWC from '@bitpay-labs/crypto-wallet-core';
import Client from '../src';
import { Utils } from '../src/lib/common';

describe('Arc wallet client', () => {
  it('should derive EVM credentials and identify native USDC', () => {
    const key = new Client.Key({ seedType: 'mnemonic', seedData: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about' });
    for (const network of ['livenet', 'testnet'] as const) {
      const credentials = key.createCredentials(null, { chain: 'arc', network, account: 0, n: 1 });
      expect(credentials.getRootPath()).to.equal("m/44'/60'/0'");
      expect(credentials.chain).to.equal('arc');
      expect(credentials.coin).to.equal('arc');
      expect(Utils.getCurrencyCodeFromCoinAndChain(credentials.coin, credentials.chain)).to.equal('USDC_arc');
    }
    expect(Utils.formatAmount(1e18, 'arc')).to.equal('1.00');
  });

  it('should apply an Arc signature without changing its amount or chain ID', () => {
    const key = new CWC.BitcoreLib.PrivateKey('1'.padStart(64, '0'));
    for (const [network, chainId] of [['livenet', 5042n], ['testnet', 5042002n]] as const) {
      const raw = CWC.Transactions.create({ chain: 'ARC', network, nonce: 0, gasPrice: 25000000000,
        gasLimit: 21000, recipients: [{ address: '0x0000000000000000000000000000000000000001', amount: '1000000000000000000' }] });
      const signature = CWC.Transactions.getSignature({ chain: 'ARC', tx: raw, key: { privKey: key.toString(), pubKey: key.publicKey.toString() } });
      const txp = { chain: 'arc', network };
      const tx = { uncheckedSerialize: () => [raw], id: '' };
      new Client()._addSignaturesToBitcoreTx(txp, tx, [signature], '');
      const signed = CWC.ethers.Transaction.from(tx.uncheckedSerialize()[0]);
      expect(signed.isSigned()).to.equal(true);
      expect(signed.chainId).to.equal(chainId);
      expect(signed.value).to.equal(1000000000000000000n);
      expect(tx.id).to.equal(signed.hash);
    }
  });
});
