import 'source-map-support/register.js';
import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import Ledger from '../../src/ledger/wallet.js';

const { HDPublicKey, Script, Transaction } = BitcoreLib;

const ledger = new Ledger();
await ledger.connect();

const publickey = new HDPublicKey(await ledger.getPublicKey({ chain: 'BTC' })).derive('m/0/0').publicKey;

const tx = new Transaction()
  .from({
    address: 'bc1q0wsc0l2pzfn55ra67kr0vm40rjlllyh3a5kf88',
    txId: 'a78dbd15bde4d8678c7e01451d6e54e92629395c9b76de7d37bf464514c8bc04',
    outputIndex: 0,
    script: Script.buildWitnessV0Out(publickey.toAddress()),
    satoshis: 9290
  });

console.log(`Sign ${tx}`);
const signedTransaction = await ledger.sign({
  chain: 'BTC',
  tx
});
console.log(signedTransaction);
await ledger.disconnect();

console.log('Signed transaction');
process.exit(0);
