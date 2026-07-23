import CWC from '@bitpay-labs/crypto-wallet-core';
import Burner from '../../src/burner.js';

const { Transaction, PublicKey, Script } = CWC.BitcoreLib;

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
const signedTransaction: any = await burner.sign({ index: 9, tx, password: '123456' });

console.log(signedTransaction);
console.log('Signed transaction');

console.log(signedTransaction.serialize());
process.exit(0);
