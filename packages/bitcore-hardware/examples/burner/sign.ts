import 'source-map-support/register.js';
import CWC from '@bitpay-labs/crypto-wallet-core';
import Burner from '../../src/burner.js';

const { PublicKey, Script } = CWC.BitcoreLib;

const burner = new Burner('btc');
burner.connect();

// Predefined for now. For other wallets:
// const publicKey = new PublicKey(await burner.getPublicKey({ index: 9 }))
const publicKey = new PublicKey('04161f62f9778a44bd3d07009b1f2e9df7ab1dc57e74665db7ed8baa95780452ab39f4975099f3ae36f7b6a874b46edd79d1d88573a325b9976fd8f120bed704aa');
const address = publicKey.toAddress();

const utxos = [{
  txId: '115e8f72f39fad874cfab0deed11a80f24f967a84079fb56ddf53ea02e308986',
  outputIndex: 0,
  address: address.toString(),
  script: Script.buildWitnessV0Out(address),
  satoshis: 1100
}];

const tx = CWC.Transactions.create({
  chain: 'BTC',
  recipients: [{ address: '1Gokm82v6DmtwKEB8AiVhm82hyFSsEvBDK', amount: 1000 }],
  utxos
});

console.log('Tap burner wallet on an NFC reader to sign a transaction');
const signedTransaction: any = await burner.sign({ tx, utxos, index: 9, password: '123456' });

console.log('Signed transaction');
console.log(signedTransaction);

process.exit(0);
