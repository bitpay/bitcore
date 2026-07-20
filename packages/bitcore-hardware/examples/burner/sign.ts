import bitcore from '@bitpay-labs/bitcore-lib';
import Burner from '../../src/burner.js';

const { Transaction, PublicKey, crypto } = bitcore;

const burner = new Burner('btc');
burner.connect();

const utxo = {
  txId: '115e8f72f39fad874cfab0deed11a80f24f967a84079fb56ddf53ea02e308986',
  outputIndex: 0,
  address: '17XBj6iFEsf8kzDMGQk5ghZipxX49VXuaV',
  script: '76a91447862fe165e6121af80d5dde1ecb478ed170565b88ac',
  satoshis: 500
};

const transaction = new Transaction()
  .from(utxo)
  .to('1Gokm82v6DmtwKEB8AiVhm82hyFSsEvBDK', 150)
  .toString();

console.log('Tap burner wallet on an NFC reader to sign a transaction');
const result: any = await burner.sign({ index: 9, message: transaction.toString(), password: '123456' });

console.log(result);
console.log('Signed transaction');

const sig = crypto.Signature.fromString(result.signature.der);
const digest = Buffer.from(result.input.digest, 'hex');
const publicKey = new PublicKey(result.publicKey);

const verify = crypto.ECDSA.verify(digest, sig, publicKey);
console.log(verify ? 'Verified signature' : 'Invalid signature');

process.exit(0);
