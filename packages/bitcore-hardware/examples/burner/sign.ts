import bitcore from '@bitpay-labs/bitcore-lib';
import Burner from '../../src/burner.js';

const { Transaction, PublicKey, Script, crypto } = bitcore;

const burner = new Burner('btc');
burner.connect();

console.log('Tap burner for public key (used for the address and verifying the signature)');
const publicKey = new PublicKey(await burner.getPublicKey({ index: 9 }));
const address = publicKey.toAddress();

const utxo = {
  txId: '115e8f72f39fad874cfab0deed11a80f24f967a84079fb56ddf53ea02e308986',
  outputIndex: 0,
  address: address.toString(),
  script: Script.buildWitnessV0Out(address),
  satoshis: 1100
};

const tx = new Transaction()
  .from(utxo)
  .to('1Gokm82v6DmtwKEB8AiVhm82hyFSsEvBDK', 1000);


console.log('Tap burner wallet on an NFC reader to sign a transaction');
const result: any = await burner.sign({ index: 9, tx, password: '123456' });

console.log(result);
console.log('Signed transaction');

const sig = crypto.Signature.fromString(result.signature.der);
const digest = Buffer.from(result.input.digest, 'hex');

const verify = crypto.ECDSA.verify(digest, sig, publicKey);
console.log(verify ? 'Verified signature' : 'Invalid signature');

const signature = {
  signature: sig,
  publicKey,
  sigtype: crypto.Signature.SIGHASH_ALL,
  inputIndex: 0
};

tx.applySignature(signature);

console.log(tx.serialize());
process.exit(0);
