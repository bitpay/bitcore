import bitcore from '@bitpay-labs/bitcore-lib';
import Ledger from '../../src/ledger.js';

const { HDPublicKey, Script, Transaction } = bitcore;

const ledger = new Ledger();
await ledger.connect();

const publickey = new HDPublicKey(await ledger.getPublicKey({ index: 0 })).derive('m/0/0').publicKey;

const tx = new Transaction()
  .from({
    address: 'bc1q0wsc0l2pzfn55ra67kr0vm40rjlllyh3a5kf88',
    txId: 'a78dbd15bde4d8678c7e01451d6e54e92629395c9b76de7d37bf464514c8bc04',
    outputIndex: 0,
    script: Script.buildWitnessV0Out(publickey.toAddress()),
    satoshis: 9290
  });

const signedTransaction = await ledger.sign(tx);
console.log(signedTransaction);
console.log(signedTransaction.toBuffer().toString('hex'));
await ledger.disconnect();

console.log('Signed transaction');
process.exit(0);
