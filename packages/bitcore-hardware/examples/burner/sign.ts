import bitcore from '@bitpay-labs/bitcore-lib';
import BitcoreHardware from '../../src/index.js';

const wallet = new BitcoreHardware('burner', 'btc');
wallet.connect();

const utxo = {
  txId: '115e8f72f39fad874cfab0deed11a80f24f967a84079fb56ddf53ea02e308986',
  outputIndex: 0,
  address: '17XBj6iFEsf8kzDMGQk5ghZipxX49VXuaV',
  script: '76a91447862fe165e6121af80d5dde1ecb478ed170565b88ac',
  satoshis: 500
};

const transaction = new bitcore.Transaction()
  .from(utxo)
  .to('1Gokm82v6DmtwKEB8AiVhm82hyFSsEvBDK', 150)
  .toString();

console.log('Tap burner wallet on an NFC reader to sign a transaction');
console.log(await wallet.sign({ index: 9, message: transaction, password: '123456' }));

console.log('Signed transaction with burner wallet, exiting...');
process.exit(0);
